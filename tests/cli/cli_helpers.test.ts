/**
 * CLI Helper Tests
 * Tests for mapVulnerabilitiesToOWASP, saveSessionMetadata, loadSessionMetadata,
 * and sessionMetadataPath exported from src/cli/index.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    mapVulnerabilitiesToOWASP,
    saveSessionMetadata,
    loadSessionMetadata,
    sessionMetadataPath,
    withTimeout,
    type SessionMetadata,
} from '../../src/cli/helpers.js';

// =============================================================================
// mapVulnerabilitiesToOWASP
// =============================================================================

describe('mapVulnerabilitiesToOWASP', () => {
    it('maps prompt_injection → LLM01_PROMPT_INJECTION', () => {
        expect(mapVulnerabilitiesToOWASP(['prompt_injection'])).toContain('LLM01_PROMPT_INJECTION');
    });

    it('maps insecure_output → LLM02_INSECURE_OUTPUT', () => {
        expect(mapVulnerabilitiesToOWASP(['insecure_output'])).toContain('LLM02_INSECURE_OUTPUT');
    });

    it('maps rag_poisoning → LLM03_TRAINING_DATA_POISONING', () => {
        expect(mapVulnerabilitiesToOWASP(['rag_poisoning'])).toContain('LLM03_TRAINING_DATA_POISONING');
    });

    it('maps denial_of_service → LLM04_MODEL_DOS', () => {
        expect(mapVulnerabilitiesToOWASP(['denial_of_service'])).toContain('LLM04_MODEL_DOS');
    });

    it('maps supply_chain → LLM05_SUPPLY_CHAIN', () => {
        expect(mapVulnerabilitiesToOWASP(['supply_chain'])).toContain('LLM05_SUPPLY_CHAIN');
    });

    it('maps data_exfiltration → LLM06_SENSITIVE_INFO_DISCLOSURE', () => {
        expect(mapVulnerabilitiesToOWASP(['data_exfiltration'])).toContain('LLM06_SENSITIVE_INFO_DISCLOSURE');
    });

    it('maps tool_abuse → LLM07_INSECURE_PLUGIN', () => {
        expect(mapVulnerabilitiesToOWASP(['tool_abuse'])).toContain('LLM07_INSECURE_PLUGIN');
    });

    it('maps auth_bypass → LLM07_INSECURE_PLUGIN', () => {
        expect(mapVulnerabilitiesToOWASP(['auth_bypass'])).toContain('LLM07_INSECURE_PLUGIN');
    });

    it('maps excessive_agency → LLM08_EXCESSIVE_AGENCY', () => {
        expect(mapVulnerabilitiesToOWASP(['excessive_agency'])).toContain('LLM08_EXCESSIVE_AGENCY');
    });

    it('maps multiple categories in a single call', () => {
        const result = mapVulnerabilitiesToOWASP([
            'prompt_injection',
            'data_exfiltration',
            'tool_abuse',
        ]);
        expect(result).toContain('LLM01_PROMPT_INJECTION');
        expect(result).toContain('LLM06_SENSITIVE_INFO_DISCLOSURE');
        expect(result).toContain('LLM07_INSECURE_PLUGIN');
        expect(result).toHaveLength(3);
    });

    it('deduplicates when two categories share the same VulnerabilityType', () => {
        const result = mapVulnerabilitiesToOWASP(['tool_abuse', 'auth_bypass']);
        const count = result.filter(v => v === 'LLM07_INSECURE_PLUGIN').length;
        expect(count).toBe(1);
    });

    it('silently drops unknown category strings', () => {
        const result = mapVulnerabilitiesToOWASP(['unknown_category', 'prompt_injection']);
        expect(result).toContain('LLM01_PROMPT_INJECTION');
        expect(result).toHaveLength(1);
    });

    it('returns empty array for empty input', () => {
        expect(mapVulnerabilitiesToOWASP([])).toHaveLength(0);
    });

    it('returns empty array when all categories are unknown', () => {
        expect(mapVulnerabilitiesToOWASP(['foo', 'bar', 'baz'])).toHaveLength(0);
    });

    it('maps all known categories without duplicates', () => {
        const all = [
            'prompt_injection',
            'insecure_output',
            'rag_poisoning',
            'denial_of_service',
            'supply_chain',
            'data_exfiltration',
            'tool_abuse',
            'excessive_agency',
        ];
        const result = mapVulnerabilitiesToOWASP(all);
        expect(result.length).toBe(8);
        expect(new Set(result).size).toBe(8);
    });
});

// =============================================================================
// sessionMetadataPath
// =============================================================================

describe('sessionMetadataPath', () => {
    it('returns a path ending in session.json', () => {
        expect(sessionMetadataPath('./audit-logs', 'abc123').endsWith('session.json')).toBe(true);
    });

    it('includes the sessionId segment', () => {
        expect(sessionMetadataPath('./audit-logs', 'my-session-id')).toContain('my-session-id');
    });

    it('includes the outputDir segment', () => {
        expect(sessionMetadataPath('/custom/output', 'sid')).toContain('/custom/output');
    });
});

// =============================================================================
// saveSessionMetadata / loadSessionMetadata
// =============================================================================

describe('saveSessionMetadata and loadSessionMetadata', () => {
    let tmpDir: string;

    const baseMeta: Omit<SessionMetadata, 'outputDir'> = {
        sessionId: 'sess-abc-123',
        targetName: 'Example Bot',
        targetUrl: 'https://chatbot.example.com',
        startedAt: '2026-04-27T10:00:00.000Z',
    };

    beforeEach(() => {
        tmpDir = join(tmpdir(), `valyrian-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('round-trips all fields correctly', () => {
        const meta: SessionMetadata = { ...baseMeta, outputDir: tmpDir };
        saveSessionMetadata(meta);

        const loaded = loadSessionMetadata(tmpDir, meta.sessionId);
        expect(loaded).not.toBeNull();
        expect(loaded?.sessionId).toBe(meta.sessionId);
        expect(loaded?.targetName).toBe(meta.targetName);
        expect(loaded?.targetUrl).toBe(meta.targetUrl);
        expect(loaded?.startedAt).toBe(meta.startedAt);
        expect(loaded?.outputDir).toBe(meta.outputDir);
    });

    it('creates the session subdirectory automatically', () => {
        const meta: SessionMetadata = { ...baseMeta, sessionId: 'new-sess', outputDir: tmpDir };
        const sessionDir = join(tmpDir, meta.sessionId);

        expect(existsSync(sessionDir)).toBe(false);
        saveSessionMetadata(meta);
        expect(existsSync(sessionDir)).toBe(true);
    });

    it('returns null when session file does not exist', () => {
        expect(loadSessionMetadata(tmpDir, 'nonexistent-session')).toBeNull();
    });

    it('returns null when session file contains invalid JSON', () => {
        const sessionDir = join(tmpDir, 'bad-sess');
        mkdirSync(sessionDir, { recursive: true });
        writeFileSync(join(sessionDir, 'session.json'), 'NOT_VALID_JSON', 'utf-8');

        expect(loadSessionMetadata(tmpDir, 'bad-sess')).toBeNull();
    });

    it('written JSON file contains all required fields', () => {
        const meta: SessionMetadata = { ...baseMeta, sessionId: 'field-check', outputDir: tmpDir };
        saveSessionMetadata(meta);

        const raw = readFileSync(sessionMetadataPath(tmpDir, meta.sessionId), 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        expect(parsed['sessionId']).toBe(meta.sessionId);
        expect(parsed['targetName']).toBe(meta.targetName);
        expect(parsed['targetUrl']).toBe(meta.targetUrl);
        expect(parsed['startedAt']).toBe(meta.startedAt);
        expect(parsed['outputDir']).toBe(meta.outputDir);
    });

    it('overwriting an existing session file replaces the data', () => {
        const meta: SessionMetadata = { ...baseMeta, targetName: 'Original', outputDir: tmpDir };
        saveSessionMetadata(meta);

        saveSessionMetadata({ ...meta, targetName: 'Updated' });

        expect(loadSessionMetadata(tmpDir, meta.sessionId)?.targetName).toBe('Updated');
    });

    it('handles multiple sessions in the same outputDir independently', () => {
        const meta1: SessionMetadata = { ...baseMeta, sessionId: 'sess-1', targetName: 'Bot A', outputDir: tmpDir };
        const meta2: SessionMetadata = { ...baseMeta, sessionId: 'sess-2', targetName: 'Bot B', outputDir: tmpDir };

        saveSessionMetadata(meta1);
        saveSessionMetadata(meta2);

        expect(loadSessionMetadata(tmpDir, 'sess-1')?.targetName).toBe('Bot A');
        expect(loadSessionMetadata(tmpDir, 'sess-2')?.targetName).toBe('Bot B');
    });
});

// =============================================================================
// withTimeout
// =============================================================================

describe('withTimeout', () => {
    it('resolves with the promise value when it completes before the timeout', async () => {
        const fast = Promise.resolve('done');
        await expect(withTimeout(fast, 5000, 'timed out')).resolves.toBe('done');
    });

    it('rejects with the timeout message when the promise is too slow', async () => {
        const slow = new Promise<string>(resolve => setTimeout(() => resolve('late'), 5000));
        await expect(withTimeout(slow, 10, 'operation timed out')).rejects.toThrow('operation timed out');
    });

    it('propagates rejection from the original promise before timeout', async () => {
        const failing = Promise.reject(new Error('original error'));
        await expect(withTimeout(failing, 5000, 'should not see this')).rejects.toThrow('original error');
    });

    it('rejects immediately when timeoutMs is 0', async () => {
        const never = new Promise<never>(() => { /* never resolves */ });
        await expect(withTimeout(never, 0, 'zero timeout')).rejects.toThrow('zero timeout');
    });

    it('resolves with the correct type', async () => {
        const typed = Promise.resolve(42);
        const result = await withTimeout(typed, 1000, 'timeout');
        expect(result).toBe(42);
        // TypeScript: result is inferred as number — verified at compile time by tsc
    });
});
