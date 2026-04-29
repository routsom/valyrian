/**
 * Valyrian Edge - CLI Helper Utilities
 * Pure helper functions extracted from the CLI entry point so tests can
 * import them without triggering commander's program.parse().
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { VulnerabilityType } from '../types/index.js';

// =============================================================================
// VULNERABILITY CATEGORY MAPPING
// =============================================================================

/** Map config vulnerability-category strings to OWASP VulnerabilityType strings. */
export function mapVulnerabilitiesToOWASP(categories: string[]): VulnerabilityType[] {
    const mapping: Record<string, VulnerabilityType> = {
        prompt_injection: 'LLM01_PROMPT_INJECTION',
        insecure_output: 'LLM02_INSECURE_OUTPUT',
        rag_poisoning: 'LLM03_TRAINING_DATA_POISONING',
        denial_of_service: 'LLM04_MODEL_DOS',
        supply_chain: 'LLM05_SUPPLY_CHAIN',
        data_exfiltration: 'LLM06_SENSITIVE_INFO_DISCLOSURE',
        tool_abuse: 'LLM07_INSECURE_PLUGIN',
        auth_bypass: 'LLM07_INSECURE_PLUGIN',
        excessive_agency: 'LLM08_EXCESSIVE_AGENCY',
    };
    return [
        ...new Set(
            categories
                .map(c => mapping[c])
                .filter((v): v is VulnerabilityType => v !== undefined),
        ),
    ];
}

// =============================================================================
// SESSION METADATA
// =============================================================================

export interface SessionMetadata {
    sessionId: string;
    targetName: string;
    targetUrl: string;
    /** ISO-8601 timestamp, e.g. "2026-04-27T10:00:00.000Z" */
    startedAt: string;
    outputDir: string;
}

export function sessionMetadataPath(outputDir: string, sessionId: string): string {
    return join(outputDir, sessionId, 'session.json');
}

export function saveSessionMetadata(meta: SessionMetadata): void {
    const dir = join(meta.outputDir, meta.sessionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        sessionMetadataPath(meta.outputDir, meta.sessionId),
        JSON.stringify(meta, null, 2),
        'utf-8',
    );
}

export function loadSessionMetadata(outputDir: string, sessionId: string): SessionMetadata | null {
    const path = sessionMetadataPath(outputDir, sessionId);
    if (!existsSync(path)) return null;
    try {
        return JSON.parse(readFileSync(path, 'utf-8')) as SessionMetadata;
    } catch {
        return null;
    }
}

// =============================================================================
// TIMEOUT HELPER
// =============================================================================

/**
 * Race a promise against a timeout.
 * Rejects with an Error containing `message` if `timeoutMs` elapses first.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    const timer = new Promise<never>((_, reject) => {
        const id = setTimeout(() => reject(new Error(message)), timeoutMs);
        // Allow Node to exit if this is the only pending timer
        if (id.unref) id.unref();
    });
    return Promise.race([promise, timer]);
}
