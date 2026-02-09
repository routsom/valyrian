/**
 * Test Fixtures and Helpers
 */

import { expect } from 'vitest';
import type { LLMConfig, ScanScope } from '../../src/types/index.js';

export const mockLLMConfig: LLMConfig = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: 'test-api-key',
    temperature: 0.7,
    maxTokens: 4096,
};

export const mockTargetConfig = {
    name: 'Test Chatbot',
    type: 'api' as const,
    endpoints: {
        chat: 'http://localhost:3000/chat',
    },
    authentication: {
        type: 'api_key' as const,
        credentials: {
            apiKey: 'test-target-key',
        },
    },
};

export const mockScanScope: ScanScope = {
    vulnerabilityTypes: ['LLM01_PROMPT_INJECTION', 'LLM06_SENSITIVE_INFO_DISCLOSURE'],
    maxTurns: 10,
    stealthLevel: 'medium',
    enableExploitation: false,
    generatePoC: false,
};

export function createMockAgentContext() {
    return {
        sessionId: 'test-session-123',
        target: mockTargetConfig,
        scope: mockScanScope,
        outputDir: '/tmp/test-output',
        llm: {} as any, // Mock LLM client
        logger: {
            info: () => { },
            warn: () => { },
            error: () => { },
            debug: () => { },
        } as any,
    };
}

export function expectVulnerabilityFound(
    analysis: any,
    minConfidence = 0.5
): void {
    expect(analysis).toBeDefined();
    expect(analysis.attackVectors).toBeDefined();
    expect(analysis.attackVectors.length).toBeGreaterThan(0);

    const exploitable = analysis.attackVectors.filter(
        (v: any) => v.exploitable && v.confidence >= minConfidence
    );
    expect(exploitable.length).toBeGreaterThan(0);
}

export function expectNoVulnerability(analysis: any): void {
    expect(analysis).toBeDefined();
    const exploitable = (analysis.attackVectors || []).filter(
        (v: any) => v.exploitable
    );
    expect(exploitable.length).toBe(0);
}
