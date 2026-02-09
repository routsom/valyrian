/**
 * Valyrian Edge - HTTP Client Tool
 * HTTP client for interacting with target chatbots
 */

import { EventEmitter } from 'node:events';

// =============================================================================
// TYPES
// =============================================================================

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
    followRedirects?: boolean;
}

export interface Response {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    json<T = unknown>(): T;
    ok: boolean;
    elapsed: number;
}

export interface SessionConfig {
    baseUrl: string;
    defaultHeaders?: Record<string, string>;
    timeout?: number;
    cookies?: Record<string, string>;
    authToken?: string;
    retries?: number;
    retryDelay?: number;
}

// =============================================================================
// HTTP CLIENT
// =============================================================================

export class HttpClient extends EventEmitter {
    private session: SessionConfig;
    private cookieJar: Map<string, string> = new Map();
    private requestCount = 0;

    constructor(config: SessionConfig) {
        super();
        this.session = {
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            ...config,
        };

        // Initialize cookies
        if (config.cookies) {
            for (const [key, value] of Object.entries(config.cookies)) {
                this.cookieJar.set(key, value);
            }
        }
    }

    // ===========================================================================
    // PUBLIC API
    // ===========================================================================

    async request(path: string, options: RequestOptions = {}): Promise<Response> {
        const url = this.buildUrl(path);
        const headers = this.buildHeaders(options.headers);
        const method = options.method ?? 'GET';

        let lastError: Error | null = null;
        const retries = this.session.retries ?? 3;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await this.executeRequest(url, method, headers, options);
                this.requestCount++;
                return response;
            } catch (error) {
                lastError = error as Error;
                if (attempt < retries - 1) {
                    await this.delay(this.session.retryDelay ?? 1000);
                }
            }
        }

        throw lastError ?? new Error('Request failed');
    }

    async get(path: string, options?: Omit<RequestOptions, 'method'>): Promise<Response> {
        return this.request(path, { ...options, method: 'GET' });
    }

    async post(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<Response> {
        return this.request(path, { ...options, method: 'POST', body });
    }

    async put(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<Response> {
        return this.request(path, { ...options, method: 'PUT', body });
    }

    async delete(path: string, options?: Omit<RequestOptions, 'method'>): Promise<Response> {
        return this.request(path, { ...options, method: 'DELETE' });
    }

    // ===========================================================================
    // CHAT-SPECIFIC METHODS
    // ===========================================================================

    async sendChatMessage(endpoint: string, message: string, conversationId?: string): Promise<{
        response: string;
        conversationId?: string;
        metadata?: Record<string, unknown>;
    }> {
        const body: Record<string, unknown> = { message };
        if (conversationId) {
            body['conversation_id'] = conversationId;
        }

        const response = await this.post(endpoint, body);

        if (!response.ok) {
            throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
        }

        const data = response.json<{
            response?: string;
            message?: string;
            content?: string;
            conversation_id?: string;
            id?: string;
            [key: string]: unknown;
        }>();

        return {
            response: data.response ?? data.message ?? data.content ?? JSON.stringify(data),
            conversationId: data.conversation_id ?? data.id ?? conversationId,
            metadata: data,
        };
    }

    async streamChatMessage(
        endpoint: string,
        message: string,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        const url = this.buildUrl(endpoint);
        const headers = this.buildHeaders({ 'Accept': 'text/event-stream' });

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message, stream: true }),
        });

        if (!response.ok) {
            throw new Error(`Stream request failed: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            fullResponse += chunk;
            onChunk(chunk);
        }

        return fullResponse;
    }

    // ===========================================================================
    // SESSION MANAGEMENT
    // ===========================================================================

    setCookie(name: string, value: string): void {
        this.cookieJar.set(name, value);
    }

    getCookie(name: string): string | undefined {
        return this.cookieJar.get(name);
    }

    clearCookies(): void {
        this.cookieJar.clear();
    }

    setAuthToken(token: string): void {
        this.session.authToken = token;
    }

    setHeader(name: string, value: string): void {
        this.session.defaultHeaders = {
            ...this.session.defaultHeaders,
            [name]: value,
        };
    }

    getRequestCount(): number {
        return this.requestCount;
    }

    // ===========================================================================
    // INTERNAL METHODS
    // ===========================================================================

    private buildUrl(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        return `${this.session.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }

    private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...this.session.defaultHeaders,
            ...customHeaders,
        };

        // Add auth token
        if (this.session.authToken) {
            headers['Authorization'] = `Bearer ${this.session.authToken}`;
        }

        // Add cookies
        if (this.cookieJar.size > 0) {
            const cookieString = Array.from(this.cookieJar.entries())
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
            headers['Cookie'] = cookieString;
        }

        return headers;
    }

    private async executeRequest(
        url: string,
        method: string,
        headers: Record<string, string>,
        options: RequestOptions
    ): Promise<Response> {
        const controller = new AbortController();
        const timeout = options.timeout ?? this.session.timeout ?? 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const startTime = Date.now();

        try {
            const fetchOptions: RequestInit = {
                method,
                headers,
                signal: controller.signal,
                redirect: options.followRedirects === false ? 'manual' : 'follow',
            };

            if (options.body && method !== 'GET') {
                fetchOptions.body = typeof options.body === 'string'
                    ? options.body
                    : JSON.stringify(options.body);
            }

            const response = await fetch(url, fetchOptions);
            const elapsed = Date.now() - startTime;
            const body = await response.text();

            // Extract cookies from response
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) {
                this.parseCookies(setCookie);
            }

            // Convert headers
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            this.emit('response', { url, method, status: response.status, elapsed });

            return {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body,
                ok: response.ok,
                elapsed,
                json<T = unknown>(): T {
                    return JSON.parse(body) as T;
                },
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private parseCookies(setCookieHeader: string): void {
        const cookies = setCookieHeader.split(',').map(c => c.trim());
        for (const cookie of cookies) {
            const parts = cookie.split(';')[0];
            if (parts) {
                const [name, value] = parts.split('=');
                if (name && value) {
                    this.cookieJar.set(name.trim(), value.trim());
                }
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createHttpClient(config: SessionConfig): HttpClient {
    return new HttpClient(config);
}

export default HttpClient;
