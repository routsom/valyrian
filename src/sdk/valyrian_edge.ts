/**
 * Valyrian Edge - SDK Entry Class
 * Main programmatic API. Wraps DirectRunner or TemporalRunner behind a
 * consistent interface so callers never need to touch Temporal directly.
 *
 * @example
 * const valyrian = new ValyrianEdge({ mode: 'direct' });
 * const session = await valyrian.scan(options);
 * const report  = await session.waitForCompletion();
 */

import { DirectRunner } from './direct_runner.js';
import { TemporalRunner } from './temporal_runner.js';
import type {
    ScanOptions,
    ScanRunner,
    ValyrianEdgeOptions,
    SecurityReport,
} from './types.js';

// =============================================================================
// SCAN SESSION
// =============================================================================

/**
 * Represents a live or completed scan. Returned by ValyrianEdge.scan().
 */
export class ScanSession {
    constructor(
        public readonly sessionId: string,
        private readonly runner: ScanRunner,
        private readonly timeoutMs: number,
    ) {}

    /** Poll current status. */
    async status(): Promise<{ phase: string; progress: number; currentActivity?: string }> {
        return this.runner.getStatus(this.sessionId);
    }

    /** Poll current findings summary. */
    async findings(): Promise<Array<{ type: string; severity: string; count: number }>> {
        return this.runner.getFindings(this.sessionId);
    }

    /** Wait for the scan to complete and return the full report. */
    async waitForCompletion(): Promise<SecurityReport> {
        return this.runner.waitForCompletion(this.sessionId, this.timeoutMs);
    }

    /** Cancel the scan. */
    async cancel(): Promise<void> {
        return this.runner.cancel(this.sessionId);
    }
}

// =============================================================================
// VALYRIAN EDGE
// =============================================================================

export class ValyrianEdge {
    private readonly runner: ScanRunner;

    constructor(opts: ValyrianEdgeOptions = {}) {
        const mode = opts.mode ?? 'direct';

        if (mode === 'temporal') {
            this.runner = new TemporalRunner({
                address: opts.temporalAddress,
                namespace: opts.temporalNamespace,
            });
        } else {
            this.runner = new DirectRunner();
        }
    }

    /**
     * Start a new scan and return a ScanSession handle.
     *
     * @param options - Scan configuration
     * @returns ScanSession with status/findings/waitForCompletion methods
     */
    async scan(options: ScanOptions): Promise<ScanSession> {
        const timeoutMs = options.timeoutMs ?? 600_000;
        const sessionId = await this.runner.start(options);
        return new ScanSession(sessionId, this.runner, timeoutMs);
    }

    /**
     * Convenience wrapper: start a scan and immediately wait for completion.
     *
     * @param options - Scan configuration
     * @returns Completed SecurityReport
     */
    async scanAndWait(options: ScanOptions): Promise<SecurityReport> {
        const session = await this.scan(options);
        return session.waitForCompletion();
    }
}
