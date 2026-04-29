/**
 * Valyrian Edge - Direct Runner
 * In-process runner that calls Temporal activities directly without Temporal.
 * Use this mode for testing, CI, or environments where Temporal is unavailable.
 */

import { nanoid } from 'nanoid';
import type { ScanOptions, ScanRunner, ScanState, ScanStatus } from './types.js';
import type { SecurityReport, Finding } from '../types/index.js';
import {
    runReconnaissance,
    runPromptInjectionAnalysis,
    runToolAbuseAnalysis,
    runDataExfiltrationAnalysis,
    runInsecureOutputAnalysis,
    runRAGPoisoningAnalysis,
    runDoSAnalysis,
    runSupplyChainAnalysis,
    runExcessiveAgencyAnalysis,
    runOverrelianceAnalysis,
    runModelTheftAnalysis,
    generateReport,
    type AnalysisResult,
} from '../orchestrator/activities.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('direct-runner');

type AnalysisInput = Parameters<typeof runPromptInjectionAnalysis>[0];

const ANALYSIS_ACTIVITIES: Record<string, (input: AnalysisInput) => Promise<AnalysisResult>> = {
    LLM01_PROMPT_INJECTION: runPromptInjectionAnalysis,
    LLM02_INSECURE_OUTPUT: runInsecureOutputAnalysis,
    LLM03_TRAINING_DATA_POISONING: runRAGPoisoningAnalysis,
    LLM04_MODEL_DOS: runDoSAnalysis,
    LLM05_SUPPLY_CHAIN: runSupplyChainAnalysis,
    LLM06_SENSITIVE_INFO_DISCLOSURE: runDataExfiltrationAnalysis,
    LLM07_INSECURE_PLUGIN: runToolAbuseAnalysis,
    LLM08_EXCESSIVE_AGENCY: runExcessiveAgencyAnalysis,
    LLM09_OVERRELIANCE: runOverrelianceAnalysis,
    LLM10_MODEL_THEFT: runModelTheftAnalysis,
};

export class DirectRunner implements ScanRunner {
    private readonly sessions = new Map<string, ScanState>();

    async start(options: ScanOptions): Promise<string> {
        const sessionId = nanoid();

        const state: ScanState = {
            sessionId,
            status: 'running',
            phase: 'reconnaissance',
            progress: 0,
            findings: [],
            startedAt: new Date(),
        };
        this.sessions.set(sessionId, state);

        // Run asynchronously — callers use waitForCompletion() to get the result
        this.runScan(sessionId, options).catch(err => {
            const s = this.sessions.get(sessionId);
            if (s) {
                s.status = 'failed';
                s.error = String(err);
                s.completedAt = new Date();
            }
            logger.error({ sessionId, err }, 'Direct scan failed');
        });

        logger.info({ sessionId, target: options.target.name }, 'Direct scan started');
        return sessionId;
    }

    async getStatus(sessionId: string): Promise<{ phase: string; progress: number; currentActivity?: string }> {
        const state = this.sessions.get(sessionId);
        if (!state) throw new Error(`Unknown session: ${sessionId}`);
        return { phase: state.phase, progress: state.progress };
    }

    async getFindings(sessionId: string): Promise<Array<{ type: string; severity: string; count: number }>> {
        const state = this.sessions.get(sessionId);
        if (!state) throw new Error(`Unknown session: ${sessionId}`);

        const summary = new Map<string, { severity: string; count: number }>();
        for (const f of state.findings) {
            const key = f.owaspCategory;
            const existing = summary.get(key);
            if (existing) {
                existing.count++;
            } else {
                summary.set(key, { severity: f.severity, count: 1 });
            }
        }
        return Array.from(summary.entries()).map(([type, v]) => ({ type, ...v }));
    }

    async waitForCompletion(sessionId: string, timeoutMs = 600_000): Promise<SecurityReport> {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const state = this.sessions.get(sessionId);
            if (!state) throw new Error(`Unknown session: ${sessionId}`);

            const s = state.status as ScanStatus;
            if (s === 'completed' && state.report) {
                return state.report;
            }
            if (s === 'failed') {
                throw new Error(state.error ?? 'Scan failed');
            }
            if (s === 'cancelled') {
                throw new Error('Scan was cancelled');
            }

            await new Promise(r => setTimeout(r, 500));
        }

        throw new Error(`Scan timed out after ${timeoutMs}ms`);
    }

    async cancel(sessionId: string): Promise<void> {
        const state = this.sessions.get(sessionId);
        if (!state) throw new Error(`Unknown session: ${sessionId}`);
        state.status = 'cancelled';
        state.completedAt = new Date();
    }

    // ---------------------------------------------------------------------------
    // Internal scan execution
    // ---------------------------------------------------------------------------

    private async runScan(sessionId: string, options: ScanOptions): Promise<void> {
        const state = this.sessions.get(sessionId)!;
        const { target, llm, vulnerabilities } = options;

        // Phase 1 — Reconnaissance
        state.phase = 'reconnaissance';
        state.progress = 10;
        const reconOutput = await runReconnaissance({ target, llmConfig: llm, sessionId });

        if ((state.status as ScanStatus) === 'cancelled') return;

        // Phase 2 — Analysis
        state.phase = 'analysis';
        const analysisResults: AnalysisResult[] = [];
        const step = Math.floor(50 / Math.max(vulnerabilities.length, 1));

        for (const vulnType of vulnerabilities) {
            if ((state.status as ScanStatus) === 'cancelled') return;

            const activity = ANALYSIS_ACTIVITIES[vulnType];
            if (!activity) {
                logger.warn({ vulnType }, 'No activity for vulnerability type — skipping');
                continue;
            }

            const result = await activity({ target, llmConfig: llm, sessionId, reconOutput });
            analysisResults.push(result);

            for (const f of result.findings) {
                state.findings.push(f as Finding);
            }

            state.progress = Math.min(60, state.progress + step);
        }

        if ((state.status as ScanStatus) === 'cancelled') return;

        // Phase 3 — Report
        state.phase = 'reporting';
        state.progress = 80;
        const report = await generateReport({
            sessionId,
            target,
            reconOutput,
            analysisResults,
        });

        state.report = report;
        state.status = 'completed';
        state.phase = 'completed';
        state.progress = 100;
        state.completedAt = new Date();

        logger.info({ sessionId, findingCount: state.findings.length }, 'Direct scan completed');
    }
}
