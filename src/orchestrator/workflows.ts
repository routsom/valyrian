/**
 * Valyrian Edge - Pentest Workflow
 * Main Temporal workflow for orchestrating penetration tests
 */

import {
    proxyActivities,
    sleep,
    defineSignal,
    defineQuery,
    setHandler,
} from '@temporalio/workflow';
import type {
    ReconOutput,
    SecurityReport,
    TargetProfile,
    LLMConfig,
    VulnerabilityType,
    Severity,
} from '../types/index.js';
import type { pentestActivities, AnalysisResult } from './activities.js';

// =============================================================================
// ACTIVITY PROXIES
// =============================================================================

const activities = proxyActivities<typeof pentestActivities>({
    startToCloseTimeout: '5 minutes',
    retry: {
        maximumAttempts: 3,
        initialInterval: '1 second',
        backoffCoefficient: 2,
    },
});

// =============================================================================
// SIGNALS AND QUERIES
// =============================================================================

export const cancelSignal = defineSignal('cancel');
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');

export const statusQuery = defineQuery<PentestStatus>('status');
export const progressQuery = defineQuery<number>('progress');
export const findingsQuery = defineQuery<VulnerabilitySummary[]>('findings');

// =============================================================================
// TYPES
// =============================================================================

export interface PentestWorkflowInput {
    sessionId: string;
    target: TargetProfile;
    llmConfig: LLMConfig;
    scope: {
        vulnerabilities: VulnerabilityType[];
        enableExploitation: boolean;
        generateReport: boolean;
    };
}

export interface PentestStatus {
    phase: 'initializing' | 'reconnaissance' | 'analysis' | 'exploitation' | 'reporting' | 'completed' | 'cancelled' | 'failed';
    progress: number;
    currentActivity?: string;
    startedAt: Date;
    updatedAt: Date;
    error?: string;
}

export interface VulnerabilitySummary {
    type: string;
    severity: Severity;
    count: number;
}

// =============================================================================
// MAIN WORKFLOW
// =============================================================================

export async function pentestWorkflow(input: PentestWorkflowInput): Promise<SecurityReport> {
    // State
    let cancelled = false;
    let paused = false;
    let status: PentestStatus = {
        phase: 'initializing',
        progress: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
    };
    let reconOutput: ReconOutput | null = null;
    let analysisResults: AnalysisResult[] = [];

    // Signal handlers
    setHandler(cancelSignal, () => {
        cancelled = true;
        status.phase = 'cancelled';
        status.updatedAt = new Date();
    });

    setHandler(pauseSignal, () => {
        paused = true;
        status.updatedAt = new Date();
    });

    setHandler(resumeSignal, () => {
        paused = false;
        status.updatedAt = new Date();
    });

    // Query handlers
    setHandler(statusQuery, () => status);
    setHandler(progressQuery, () => status.progress);
    setHandler(findingsQuery, () => {
        const summary: VulnerabilitySummary[] = [];
        for (const result of analysisResults) {
            if (result.findings.length > 0) {
                summary.push({
                    type: result.vulnerabilityType,
                    severity: result.severity,
                    count: result.findings.length,
                });
            }
        }
        return summary;
    });

    // Helper to check state
    const checkState = async () => {
        if (cancelled) throw new Error('Workflow cancelled');
        while (paused) {
            await sleep(1000);
            if (cancelled) throw new Error('Workflow cancelled');
        }
    };

    try {
        // ===========================================================================
        // PHASE 1: RECONNAISSANCE
        // ===========================================================================
        await checkState();
        status = { ...status, phase: 'reconnaissance', progress: 10, currentActivity: 'Running reconnaissance', updatedAt: new Date() };

        reconOutput = await activities.runReconnaissance({
            target: input.target,
            llmConfig: input.llmConfig,
            sessionId: input.sessionId,
        });

        // ===========================================================================
        // PHASE 2: ANALYSIS (run in parallel)
        // ===========================================================================
        await checkState();
        status = { ...status, phase: 'analysis', progress: 30, currentActivity: 'Running vulnerability analysis', updatedAt: new Date() };

        const analysisPromises: Promise<AnalysisResult>[] = [];

        // Prompt Injection Analysis
        if (input.scope.vulnerabilities.includes('LLM01_PROMPT_INJECTION')) {
            analysisPromises.push(
                activities.runPromptInjectionAnalysis({
                    target: input.target,
                    llmConfig: input.llmConfig,
                    sessionId: input.sessionId,
                    reconOutput,
                })
            );
        }

        // Tool Abuse Analysis
        if (input.scope.vulnerabilities.includes('LLM07_INSECURE_PLUGIN')) {
            analysisPromises.push(
                activities.runToolAbuseAnalysis({
                    target: input.target,
                    llmConfig: input.llmConfig,
                    sessionId: input.sessionId,
                    reconOutput,
                })
            );
        }

        // Data Exfiltration Analysis
        if (input.scope.vulnerabilities.includes('LLM06_SENSITIVE_INFO_DISCLOSURE')) {
            analysisPromises.push(
                activities.runDataExfiltrationAnalysis({
                    target: input.target,
                    llmConfig: input.llmConfig,
                    sessionId: input.sessionId,
                    reconOutput,
                })
            );
        }

        // Wait for all analyses to complete
        analysisResults = await Promise.all(analysisPromises);
        status.progress = 80;
        status.updatedAt = new Date();

        // ===========================================================================
        // PHASE 3: REPORT GENERATION
        // ===========================================================================
        await checkState();
        status = { ...status, phase: 'reporting', progress: 90, currentActivity: 'Generating report', updatedAt: new Date() };

        const report = await activities.generateReport({
            sessionId: input.sessionId,
            target: input.target,
            reconOutput,
            analysisResults,
        });

        // ===========================================================================
        // COMPLETE
        // ===========================================================================
        status = { ...status, phase: 'completed', progress: 100, currentActivity: undefined, updatedAt: new Date() };

        return report;

    } catch (error) {
        status = {
            ...status,
            phase: cancelled ? 'cancelled' : 'failed',
            error: String(error),
            updatedAt: new Date()
        };
        throw error;
    }
}
