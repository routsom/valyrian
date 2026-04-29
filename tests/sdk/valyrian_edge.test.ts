/**
 * SDK Tests — ValyrianEdge, ScanSession, DirectRunner, TemporalRunner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScanOptions, SecurityReport, ScanRunner } from '../../src/sdk/types.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockTarget = {
    id: 'tgt-001',
    name: 'Test Bot',
    baseUrl: 'https://bot.example.com',
    endpoints: { chat: '/api/chat' },
};

const mockLlm = {
    provider: 'anthropic' as const,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.1,
    maxTokens: 1024,
    apiKey: 'sk-test',
};

const mockReport: Partial<SecurityReport> = {
    metadata: {
        reportId: 'rpt-001',
        title: 'Test Report',
        assessmentDate: new Date('2026-04-27'),
        generatedAt: new Date('2026-04-27'),
        durationMinutes: 5,
        llmCostUsd: 0.01,
        version: '1.0.0',
    },
    findings: [],
    executiveSummary: {
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0,
        keyRisks: [],
        immediateActions: [],
        overallRisk: 'low',
    },
} as unknown as SecurityReport;

const defaultScanOptions: ScanOptions = {
    target: mockTarget as ScanOptions['target'],
    llm: mockLlm,
    vulnerabilities: ['LLM01_PROMPT_INJECTION'],
    enableExploitation: false,
    timeoutMs: 5000,
};

// ---------------------------------------------------------------------------
// Mock ScanRunner
// ---------------------------------------------------------------------------

function makeMockRunner(overrides: Partial<ScanRunner> = {}): ScanRunner {
    return {
        start: vi.fn().mockResolvedValue('sess-mock-001'),
        getStatus: vi.fn().mockResolvedValue({ phase: 'analysis', progress: 50 }),
        getFindings: vi.fn().mockResolvedValue([{ type: 'LLM01_PROMPT_INJECTION', severity: 'high', count: 1 }]),
        waitForCompletion: vi.fn().mockResolvedValue(mockReport),
        cancel: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// ScanSession
// ---------------------------------------------------------------------------

describe('ScanSession', () => {
    it('status() delegates to runner.getStatus', async () => {
        const { ScanSession } = await import('../../src/sdk/valyrian_edge.js');
        const runner = makeMockRunner();
        const session = new ScanSession('sess-001', runner, 5000);

        const s = await session.status();
        expect(runner.getStatus).toHaveBeenCalledWith('sess-001');
        expect(s.phase).toBe('analysis');
        expect(s.progress).toBe(50);
    });

    it('findings() delegates to runner.getFindings', async () => {
        const { ScanSession } = await import('../../src/sdk/valyrian_edge.js');
        const runner = makeMockRunner();
        const session = new ScanSession('sess-002', runner, 5000);

        const findings = await session.findings();
        expect(runner.getFindings).toHaveBeenCalledWith('sess-002');
        expect(findings).toHaveLength(1);
        expect(findings[0]?.type).toBe('LLM01_PROMPT_INJECTION');
    });

    it('waitForCompletion() passes sessionId and timeoutMs to runner', async () => {
        const { ScanSession } = await import('../../src/sdk/valyrian_edge.js');
        const runner = makeMockRunner();
        const session = new ScanSession('sess-003', runner, 12_000);

        await session.waitForCompletion();
        expect(runner.waitForCompletion).toHaveBeenCalledWith('sess-003', 12_000);
    });

    it('cancel() delegates to runner.cancel', async () => {
        const { ScanSession } = await import('../../src/sdk/valyrian_edge.js');
        const runner = makeMockRunner();
        const session = new ScanSession('sess-004', runner, 5000);

        await session.cancel();
        expect(runner.cancel).toHaveBeenCalledWith('sess-004');
    });
});

// ---------------------------------------------------------------------------
// ValyrianEdge — constructor + scan()
// ---------------------------------------------------------------------------

describe('ValyrianEdge', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('scan() returns a ScanSession with the correct sessionId', async () => {
        vi.doMock('../../src/sdk/direct_runner.js', () => ({
            DirectRunner: vi.fn(() => makeMockRunner()),
        }));

        const { ValyrianEdge } = await import('../../src/sdk/valyrian_edge.js');
        const valyrian = new ValyrianEdge({ mode: 'direct' });
        const session = await valyrian.scan(defaultScanOptions);

        expect(session.sessionId).toBe('sess-mock-001');
    });

    it('scan() respects timeoutMs from options', async () => {
        const runner = makeMockRunner();
        vi.doMock('../../src/sdk/direct_runner.js', () => ({
            DirectRunner: vi.fn(() => runner),
        }));

        const { ValyrianEdge } = await import('../../src/sdk/valyrian_edge.js');
        const valyrian = new ValyrianEdge({ mode: 'direct' });
        const session = await valyrian.scan({ ...defaultScanOptions, timeoutMs: 30_000 });
        await session.waitForCompletion();

        expect(runner.waitForCompletion).toHaveBeenCalledWith('sess-mock-001', 30_000);
    });

    it('scanAndWait() resolves to the report', async () => {
        vi.doMock('../../src/sdk/direct_runner.js', () => ({
            DirectRunner: vi.fn(() => makeMockRunner()),
        }));

        const { ValyrianEdge } = await import('../../src/sdk/valyrian_edge.js');
        const valyrian = new ValyrianEdge({ mode: 'direct' });
        const report = await valyrian.scanAndWait(defaultScanOptions);

        expect(report).toEqual(mockReport);
    });

    it('defaults to mode=direct when no options given', async () => {
        const DirectRunnerCtor = vi.fn(() => makeMockRunner());
        vi.doMock('../../src/sdk/direct_runner.js', () => ({ DirectRunner: DirectRunnerCtor }));
        vi.doMock('../../src/sdk/temporal_runner.js', () => ({
            TemporalRunner: vi.fn(() => makeMockRunner()),
        }));

        const { ValyrianEdge } = await import('../../src/sdk/valyrian_edge.js');
        new ValyrianEdge();
        expect(DirectRunnerCtor).toHaveBeenCalledTimes(1);
    });

    it('uses TemporalRunner when mode=temporal', async () => {
        const TemporalRunnerCtor = vi.fn(() => makeMockRunner());
        vi.doMock('../../src/sdk/temporal_runner.js', () => ({ TemporalRunner: TemporalRunnerCtor }));
        vi.doMock('../../src/sdk/direct_runner.js', () => ({
            DirectRunner: vi.fn(() => makeMockRunner()),
        }));

        const { ValyrianEdge } = await import('../../src/sdk/valyrian_edge.js');
        new ValyrianEdge({ mode: 'temporal' });
        expect(TemporalRunnerCtor).toHaveBeenCalledTimes(1);
    });

    it('passes temporalAddress and temporalNamespace to TemporalRunner', async () => {
        const TemporalRunnerCtor = vi.fn(() => makeMockRunner());
        vi.doMock('../../src/sdk/temporal_runner.js', () => ({ TemporalRunner: TemporalRunnerCtor }));

        const { ValyrianEdge } = await import('../../src/sdk/valyrian_edge.js');
        new ValyrianEdge({
            mode: 'temporal',
            temporalAddress: 'temporal.prod:7233',
            temporalNamespace: 'prod-ns',
        });

        expect(TemporalRunnerCtor).toHaveBeenCalledWith({
            address: 'temporal.prod:7233',
            namespace: 'prod-ns',
        });
    });
});

// ---------------------------------------------------------------------------
// DirectRunner — unit tests (activities fully mocked)
// ---------------------------------------------------------------------------

describe('DirectRunner', () => {
    beforeEach(() => {
        vi.resetModules();
        // vi.unmock() does not clear vi.doMock() factories — restore real modules explicitly
        vi.doMock('../../src/sdk/direct_runner.js', async () =>
            vi.importActual('../../src/sdk/direct_runner.js'),
        );
        vi.doMock('../../src/sdk/temporal_runner.js', async () =>
            vi.importActual('../../src/sdk/temporal_runner.js'),
        );
    });

    function mockActivities(overrides: Record<string, unknown> = {}) {
        const fakeRecon = { chatbotProfile: {}, attackSurface: {}, recommendedAnalyses: [] };
        const fakeAnalysis = { vulnerabilityType: 'LLM01_PROMPT_INJECTION', severity: 'low', findings: [] };
        vi.doMock('../../src/orchestrator/activities.js', () => ({
            runReconnaissance: vi.fn().mockResolvedValue(fakeRecon),
            runPromptInjectionAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runToolAbuseAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runDataExfiltrationAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runInsecureOutputAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runRAGPoisoningAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runDoSAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runSupplyChainAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runExcessiveAgencyAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runOverrelianceAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            runModelTheftAnalysis: vi.fn().mockResolvedValue(fakeAnalysis),
            generateReport: vi.fn().mockResolvedValue(mockReport),
            ...overrides,
        }));
    }

    it('start() returns a non-empty session ID string', async () => {
        mockActivities();
        const { DirectRunner } = await import('../../src/sdk/direct_runner.js');
        const runner = new DirectRunner();
        const sessionId = await runner.start(defaultScanOptions);
        expect(typeof sessionId).toBe('string');
        expect(sessionId.length).toBeGreaterThan(0);
    });

    it('getStatus() throws for unknown session', async () => {
        mockActivities();
        const { DirectRunner } = await import('../../src/sdk/direct_runner.js');
        const runner = new DirectRunner();
        await expect(runner.getStatus('no-such-session')).rejects.toThrow('Unknown session');
    });

    it('cancel() transitions status so phase is not completed', async () => {
        mockActivities({
            runReconnaissance: vi.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ chatbotProfile: {}, attackSurface: {}, recommendedAnalyses: [] }), 100)),
            ),
        });
        const { DirectRunner } = await import('../../src/sdk/direct_runner.js');
        const runner = new DirectRunner();
        const sessionId = await runner.start(defaultScanOptions);
        await runner.cancel(sessionId);
        const status = await runner.getStatus(sessionId);
        expect(status.phase).not.toBe('completed');
    });

    it('waitForCompletion() times out when scan never finishes', async () => {
        mockActivities({
            runReconnaissance: vi.fn().mockImplementation(() => new Promise(() => { /* never */ })),
        });
        const { DirectRunner } = await import('../../src/sdk/direct_runner.js');
        const runner = new DirectRunner();
        const sessionId = await runner.start(defaultScanOptions);
        await expect(runner.waitForCompletion(sessionId, 50)).rejects.toThrow('timed out');
    }, 3000);

    it('getFindings() returns aggregated summary after scan completes', async () => {
        const fakeFinding = {
            id: 'f1', owaspCategory: 'LLM01_PROMPT_INJECTION', severity: 'high',
            title: 'PI', cvssScore: 8, exploitability: 'easy', description: '',
            impact: [], pocs: [], remediation: [], references: [], status: 'confirmed',
        };
        mockActivities({
            runPromptInjectionAnalysis: vi.fn().mockResolvedValue({
                vulnerabilityType: 'LLM01_PROMPT_INJECTION', severity: 'high', findings: [fakeFinding],
            }),
        });

        const { DirectRunner } = await import('../../src/sdk/direct_runner.js');
        const runner = new DirectRunner();
        const sessionId = await runner.start(defaultScanOptions);
        await runner.waitForCompletion(sessionId, 5000);

        const findings = await runner.getFindings(sessionId);
        expect(findings.some(f => f.type === 'LLM01_PROMPT_INJECTION')).toBe(true);
    }, 10_000);
});

// ---------------------------------------------------------------------------
// SDK index re-exports
// ---------------------------------------------------------------------------

describe('SDK index exports', () => {
    it('exports ValyrianEdge', async () => {
        const sdk = await import('../../src/sdk/index.js');
        expect(sdk.ValyrianEdge).toBeDefined();
    });

    it('exports ScanSession', async () => {
        const sdk = await import('../../src/sdk/index.js');
        expect(sdk.ScanSession).toBeDefined();
    });

    it('exports DirectRunner', async () => {
        const sdk = await import('../../src/sdk/index.js');
        expect(sdk.DirectRunner).toBeDefined();
    });

    it('exports TemporalRunner', async () => {
        const sdk = await import('../../src/sdk/index.js');
        expect(sdk.TemporalRunner).toBeDefined();
    });
});
