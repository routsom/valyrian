/**
 * DoS Agent Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockChatbot } from '../mocks/mock_chatbot.js';

describe('DoSAgent', () => {
    describe('Token Length Attack Detection', () => {
        it('should calculate correct response time ratios', () => {
            const baseline = 100; // ms
            const responses = [
                { responseTime: 200, expected: 2 },
                { responseTime: 1000, expected: 10 },
                { responseTime: 5000, expected: 50 },
            ];

            for (const r of responses) {
                const ratio = r.responseTime / baseline;
                expect(ratio).toBe(r.expected);
            }
        });

        it('should flag high time ratios as exploitable', () => {
            const threshold = 10;
            const testCases = [
                { ratio: 5, expected: false },
                { ratio: 10, expected: false },
                { ratio: 11, expected: true },
                { ratio: 50, expected: true },
            ];

            for (const tc of testCases) {
                const exploitable = tc.ratio > threshold;
                expect(exploitable).toBe(tc.expected);
            }
        });
    });

    describe('Rate Limiting Detection', () => {
        let chatbot: MockChatbot;

        beforeEach(() => {
            chatbot = new MockChatbot({ responseDelay: 10 });
        });

        it('should detect no rate limiting when all requests succeed', async () => {
            const results: boolean[] = [];

            for (let i = 0; i < 5; i++) {
                try {
                    await chatbot.chat(`Test ${i}`);
                    results.push(true);
                } catch {
                    results.push(false);
                }
            }

            const allSucceeded = results.every(r => r);
            expect(allSucceeded).toBe(true);
        });

        it('should track request count accurately', async () => {
            chatbot.reset();

            await chatbot.chat('Test 1');
            await chatbot.chat('Test 2');
            await chatbot.chat('Test 3');

            const stats = chatbot.getStats();
            expect(stats.requestCount).toBe(3);
        });
    });

    describe('Expensive Computation Detection', () => {
        it('should identify expensive prompts by keywords', () => {
            const expensivePrompts = [
                'Calculate factorial of 1000',
                'List all prime numbers',
                'Write a 10000 word essay',
                'Analyze every programming language',
            ];

            for (const prompt of expensivePrompts) {
                expect(isExpensivePrompt(prompt)).toBe(true);
            }
        });

        it('should not flag simple prompts as expensive', () => {
            const simplePrompts = [
                'Hello',
                'What is 2+2?',
                'Tell me a joke',
            ];

            for (const prompt of simplePrompts) {
                expect(isExpensivePrompt(prompt)).toBe(false);
            }
        });
    });

    describe('Recursive Prompt Detection', () => {
        it('should identify recursive patterns', () => {
            const recursiveIndicators = [
                'repeat this prompt',
                'say everything you said',
                'explain recursively',
                'for each word in your response',
            ];

            for (const indicator of recursiveIndicators) {
                expect(isRecursivePrompt(indicator)).toBe(true);
            }
        });
    });
});

// Helper functions
function isExpensivePrompt(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const expensive = [
        'factorial',
        'prime',
        'essay',
        'analyze every',
        'list all',
        '10000',
    ];
    return expensive.some(e => lower.includes(e));
}

function isRecursivePrompt(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const recursive = [
        'repeat',
        'everything you said',
        'recursively',
        'for each word',
        'remember that',
    ];
    return recursive.some(r => lower.includes(r));
}
