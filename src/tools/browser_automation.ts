/**
 * Valyrian Edge - Browser Automation Tool
 * Playwright-based browser automation for web UI testing
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { EventEmitter } from 'node:events';

// =============================================================================
// TYPES
// =============================================================================

export interface BrowserConfig {
    headless?: boolean;
    timeout?: number;
    viewport?: { width: number; height: number };
    userAgent?: string;
    proxy?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface BrowserSession {
    id: string;
    startTime: Date;
    messages: ChatMessage[];
    screenshots: string[];
}

// =============================================================================
// BROWSER AUTOMATION TOOL
// =============================================================================

export class BrowserAutomation extends EventEmitter {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: BrowserConfig;
    private session: BrowserSession;

    constructor(config: BrowserConfig = {}) {
        super();
        this.config = {
            headless: true,
            timeout: 30000,
            viewport: { width: 1280, height: 720 },
            ...config,
        };
        this.session = {
            id: `session_${Date.now()}`,
            startTime: new Date(),
            messages: [],
            screenshots: [],
        };
    }

    async launch(): Promise<void> {
        this.browser = await chromium.launch({
            headless: this.config.headless,
        });

        this.context = await this.browser.newContext({
            viewport: this.config.viewport,
            userAgent: this.config.userAgent,
        });

        this.page = await this.context.newPage();
        this.page.setDefaultTimeout(this.config.timeout!);

        this.emit('launched', { sessionId: this.session.id });
    }

    async navigateTo(url: string): Promise<void> {
        if (!this.page) throw new Error('Browser not launched');

        await this.page.goto(url, { waitUntil: 'networkidle' });
        this.emit('navigated', { url });
    }

    async findChatInput(): Promise<string | null> {
        if (!this.page) throw new Error('Browser not launched');

        // Common selectors for chat inputs
        const selectors = [
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="Message"]',
            'textarea[placeholder*="chat"]',
            'input[type="text"][placeholder*="message"]',
            'textarea[data-testid="chat-input"]',
            'textarea[aria-label*="message"]',
            'div[contenteditable="true"]',
            '#chat-input',
            '.chat-input',
            'textarea',
        ];

        for (const selector of selectors) {
            const element = await this.page.$(selector);
            if (element) {
                return selector;
            }
        }

        return null;
    }

    async findSendButton(): Promise<string | null> {
        if (!this.page) throw new Error('Browser not launched');

        const selectors = [
            'button[type="submit"]',
            'button[aria-label*="send"]',
            'button[aria-label*="Send"]',
            'button[data-testid="send-button"]',
            'button:has(svg)',
            '.send-button',
            '#send-button',
        ];

        for (const selector of selectors) {
            const element = await this.page.$(selector);
            if (element) {
                return selector;
            }
        }

        return null;
    }

    async sendMessage(message: string): Promise<string> {
        if (!this.page) throw new Error('Browser not launched');

        const inputSelector = await this.findChatInput();
        if (!inputSelector) {
            throw new Error('Could not find chat input');
        }

        // Clear and type message
        await this.page.fill(inputSelector, message);

        // Find and click send button, or press Enter
        const sendSelector = await this.findSendButton();
        if (sendSelector) {
            await this.page.click(sendSelector);
        } else {
            await this.page.press(inputSelector, 'Enter');
        }

        this.session.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date(),
        });

        this.emit('messageSent', { message });

        // Wait for response
        const response = await this.waitForResponse();

        this.session.messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date(),
        });

        this.emit('responseReceived', { response });

        return response;
    }

    private async waitForResponse(): Promise<string> {
        if (!this.page) throw new Error('Browser not launched');

        // Wait for response to appear
        await this.page.waitForTimeout(1000);

        // Common selectors for chat responses
        const responseSelectors = [
            '.assistant-message:last-child',
            '.bot-message:last-child',
            '[data-message-author="assistant"]:last-child',
            '.message:last-child .content',
            '.chat-bubble:last-child',
            '[role="assistant"]:last-child',
        ];

        for (const selector of responseSelectors) {
            try {
                const element = await this.page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text) return text.trim();
                }
            } catch {
                continue;
            }
        }

        // Fallback: get all text from messages container
        const container = await this.page.$('.messages, .chat-container, #messages');
        if (container) {
            const text = await container.textContent();
            return text?.trim() || 'No response detected';
        }

        return 'Unable to extract response';
    }

    async takeScreenshot(name: string): Promise<string> {
        if (!this.page) throw new Error('Browser not launched');

        const path = `screenshots/${name}_${Date.now()}.png`;
        await this.page.screenshot({ path, fullPage: true });

        this.session.screenshots.push(path);
        this.emit('screenshot', { path });

        return path;
    }

    async extractPageContent(): Promise<{
        title: string;
        text: string;
        links: string[];
        forms: number;
    }> {
        if (!this.page) throw new Error('Browser not launched');

        const title = await this.page.title();
        const text = await this.page.textContent('body') || '';
        const links = await this.page.$$eval('a[href]', els =>
            els.map(el => el.getAttribute('href') || '').filter(Boolean)
        );
        const forms = await this.page.$$eval('form', els => els.length);

        return { title, text: text.substring(0, 5000), links, forms };
    }

    async executeScript<T>(script: string): Promise<T> {
        if (!this.page) throw new Error('Browser not launched');
        return await this.page.evaluate(script) as T;
    }

    async injectPayload(selector: string, payload: string): Promise<void> {
        if (!this.page) throw new Error('Browser not launched');
        await this.page.fill(selector, payload);
        this.emit('payloadInjected', { selector, payload });
    }

    async waitForSelector(selector: string, timeout?: number): Promise<boolean> {
        if (!this.page) throw new Error('Browser not launched');

        try {
            await this.page.waitForSelector(selector, {
                timeout: timeout || this.config.timeout
            });
            return true;
        } catch {
            return false;
        }
    }

    async clickElement(selector: string): Promise<void> {
        if (!this.page) throw new Error('Browser not launched');
        await this.page.click(selector);
    }

    getSession(): BrowserSession {
        return { ...this.session };
    }

    async close(): Promise<void> {
        if (this.page) await this.page.close();
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();

        this.page = null;
        this.context = null;
        this.browser = null;

        this.emit('closed', { sessionId: this.session.id });
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createBrowserAutomation(config?: BrowserConfig): BrowserAutomation {
    return new BrowserAutomation(config);
}
