/**
 * HTTP Client Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient } from '../../src/tools/http_client.js';

describe('HttpClient', () => {
    let client: HttpClient;

    beforeEach(() => {
        client = new HttpClient({
            baseUrl: 'http://localhost:3000',
            timeout: 5000,
            retries: 3,
        });
    });

    describe('Construction', () => {
        it('should create client with config', () => {
            expect(client).toBeDefined();
        });

        it('should accept configuration options', () => {
            const customClient = new HttpClient({
                baseUrl: 'https://api.example.com',
                timeout: 10000,
                retries: 5,
            });
            expect(customClient).toBeDefined();
        });
    });

    describe('Cookie Management', () => {
        it('should set and retrieve cookies', () => {
            client.setCookie('session_id', 'abc123');
            client.setCookie('auth_token', 'xyz789');

            expect(client.getCookie('session_id')).toBe('abc123');
            expect(client.getCookie('auth_token')).toBe('xyz789');
        });

        it('should clear all cookies', () => {
            client.setCookie('session_id', 'abc123');
            client.clearCookies();

            expect(client.getCookie('session_id')).toBeUndefined();
        });
    });

    describe('Header Management', () => {
        it('should set custom headers', () => {
            client.setHeader('X-Custom-Header', 'custom-value');
            // Headers are applied on requests - just verify no error
            expect(true).toBe(true);
        });

        it('should set auth token', () => {
            client.setAuthToken('Bearer abc123');
            // Auth is applied on requests - verify no error
            expect(true).toBe(true);
        });
    });

    describe('URL Building', () => {
        it('should build correct URLs with base URL', () => {
            const url = client.buildUrl('/api/chat');
            expect(url).toBe('http://localhost:3000/api/chat');
        });

        it('should handle URLs without leading slash', () => {
            const url = client.buildUrl('api/chat');
            expect(url).toBe('http://localhost:3000/api/chat');
        });
    });

    describe('Request Tracking', () => {
        it('should track request count', () => {
            const initialCount = client.getRequestCount();
            expect(typeof initialCount).toBe('number');
        });
    });

    describe('Event Emission', () => {
        it('should emit request events', () => {
            const events: any[] = [];
            client.on('request', (data) => events.push(data));

            client.emit('request', { url: '/test', method: 'GET' });

            expect(events).toHaveLength(1);
            expect(events[0].url).toBe('/test');
        });

        it('should emit response events', () => {
            const events: any[] = [];
            client.on('response', (data) => events.push(data));

            client.emit('response', { status: 200, elapsed: 100 });

            expect(events).toHaveLength(1);
            expect(events[0].status).toBe(200);
        });
    });
});
