/**
 * Valyrian Edge - Temporal Runner
 * SDK runner that delegates to a Temporal workflow via PentestClient.
 * Requires a running Temporal server and valyrian worker.
 */

import { nanoid } from 'nanoid';
import { PentestClient } from '../orchestrator/client.js';
import { withTimeout } from '../cli/helpers.js';
import type { ScanOptions, ScanRunner } from './types.js';
import type { SecurityReport } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('temporal-runner');

export interface TemporalRunnerOptions {
    address?: string;
    namespace?: string;
}

export class TemporalRunner implements ScanRunner {
    private readonly address: string;
    private readonly namespace: string;

    constructor(opts: TemporalRunnerOptions = {}) {
        this.address = opts.address ?? process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';
        this.namespace = opts.namespace ?? process.env['TEMPORAL_NAMESPACE'] ?? 'default';
    }

    private async getClient(): Promise<PentestClient> {
        process.env['TEMPORAL_ADDRESS'] = this.address;
        process.env['TEMPORAL_NAMESPACE'] = this.namespace;
        const { createPentestClient } = await import('../orchestrator/client.js');
        return createPentestClient();
    }

    async start(options: ScanOptions): Promise<string> {
        const client = await this.getClient();
        try {
            const sessionId = await client.startPentest({
                target: options.target,
                llmConfig: options.llm,
                scope: {
                    vulnerabilities: options.vulnerabilities,
                    enableExploitation: options.enableExploitation ?? false,
                    generateReport: true,
                },
            });
            logger.info({ sessionId, target: options.target.name }, 'Temporal scan started');
            return sessionId;
        } finally {
            await client.disconnect();
        }
    }

    async getStatus(sessionId: string): Promise<{ phase: string; progress: number; currentActivity?: string }> {
        const client = await this.getClient();
        try {
            return await client.getStatus(sessionId);
        } finally {
            await client.disconnect();
        }
    }

    async getFindings(sessionId: string): Promise<Array<{ type: string; severity: string; count: number }>> {
        const client = await this.getClient();
        try {
            return await client.getFindings(sessionId);
        } finally {
            await client.disconnect();
        }
    }

    async waitForCompletion(sessionId: string, timeoutMs = 600_000): Promise<SecurityReport> {
        const client = await this.getClient();
        try {
            const result = await withTimeout(
                client.waitForCompletion(sessionId),
                timeoutMs,
                `Timed out waiting for session ${sessionId} after ${timeoutMs}ms`,
            ) as SecurityReport;
            return result;
        } finally {
            await client.disconnect();
        }
    }

    async cancel(sessionId: string): Promise<void> {
        const client = await this.getClient();
        try {
            await client.cancelPentest(sessionId);
            logger.info({ sessionId }, 'Temporal scan cancelled');
        } finally {
            await client.disconnect();
        }
    }

    static generateSessionId(): string {
        return nanoid();
    }
}
