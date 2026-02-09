/**
 * Valyrian Edge - Temporal Activities
 * Activity implementations for the pentest workflow
 */

import type {
    ReconOutput,
    AnalysisOutput,
    TargetProfile,
    LLMConfig,
    SecurityReport,
    Finding,
    VulnerabilityType,
    Severity,
    ScanScope,
    AgentContext,
} from '../types/index.js';
import { ReconAgent } from '../agents/recon_agent.js';
import { PromptInjectionAgent } from '../agents/prompt_injection_agent.js';
import { ToolAbuseAgent } from '../agents/tool_abuse_agent.js';
import { DataExfiltrationAgent } from '../agents/data_exfiltration_agent.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('temporal-activities');

// =============================================================================
// ACTIVITY TYPES
// =============================================================================

export interface ReconActivityInput {
    target: TargetProfile;
    llmConfig: LLMConfig;
    sessionId: string;
}

export interface AnalysisActivityInput {
    target: TargetProfile;
    llmConfig: LLMConfig;
    sessionId: string;
    reconOutput: ReconOutput;
}

export interface AnalysisResult {
    vulnerabilityType: VulnerabilityType;
    severity: Severity;
    findings: Finding[];
}

export interface ReportActivityInput {
    sessionId: string;
    target: TargetProfile;
    reconOutput: ReconOutput;
    analysisResults: AnalysisResult[];
}

// =============================================================================
// HELPER TO BUILD AGENT CONTEXT
// =============================================================================

function buildAgentContext(
    sessionId: string,
    target: TargetProfile,
    llmConfig: LLMConfig,
    reconOutput?: ReconOutput
): AgentContext {
    const scope: ScanScope = {
        vulnerabilities: ['prompt_injection', 'data_exfiltration', 'tool_abuse'],
        maxTurns: 5,
        enableExploitation: true,
        generatePoC: true,
    };

    return {
        sessionId,
        target,
        llm: llmConfig,
        scope,
        outputDir: `/tmp/valyrian/${sessionId}`,
        conversationHistory: [],
        discoveredInfo: {
            chatbotProfile: reconOutput?.chatbotProfile,
            attackSurface: reconOutput?.attackSurface,
        },
    };
}

// =============================================================================
// RECONNAISSANCE ACTIVITY
// =============================================================================

export async function runReconnaissance(input: ReconActivityInput): Promise<ReconOutput> {
    logger.info({ sessionId: input.sessionId, target: input.target.name }, 'Starting reconnaissance');

    const agent = new ReconAgent();

    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig);
    await agent.initialize(context);

    const result = await agent.execute(undefined as unknown as void);

    logger.info({
        sessionId: input.sessionId,
        hasProfile: !!result.chatbotProfile,
        recommendedAnalyses: result.recommendedAnalyses.length,
    }, 'Reconnaissance complete');

    return result;
}

// =============================================================================
// ANALYSIS ACTIVITIES
// =============================================================================

export async function runPromptInjectionAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting prompt injection analysis');

    const agent = new PromptInjectionAgent();

    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({});
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    // Convert to findings
    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_pi_${Date.now()}`,
        title: 'Prompt Injection Vulnerability',
        owaspCategory: 'LLM01_PROMPT_INJECTION',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 9.8 : result.analysis.severity === 'high' ? 8.5 : 6.0,
        exploitability: exploitableVectors.length > 5 ? 'trivial' : 'easy',
        description: result.analysis.summary,
        impact: ['System prompt disclosure', 'Bypass of safety guardrails', 'Potential data exfiltration'],
        pocs: [],
        remediation: [{
            priority: 'immediate',
            action: 'Implement robust input validation',
            description: 'Add delimiter-based prompt structuring and output filtering',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({
        sessionId: input.sessionId,
        vulnerabilitiesFound: exploitableVectors.length,
        severity: result.analysis.severity,
    }, 'Prompt injection analysis complete');

    return {
        vulnerabilityType: 'LLM01_PROMPT_INJECTION',
        severity: result.analysis.severity,
        findings,
    };
}

export async function runToolAbuseAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting tool abuse analysis');

    const agent = new ToolAbuseAgent();

    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({});
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_ta_${Date.now()}`,
        title: 'Tool/Plugin Abuse Vulnerability',
        owaspCategory: 'LLM07_INSECURE_PLUGIN',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 9.8 : result.analysis.severity === 'high' ? 8.5 : 6.0,
        exploitability: 'moderate',
        description: result.analysis.summary,
        impact: ['SSRF attacks', 'Internal network access', 'Cloud metadata exposure'],
        pocs: [],
        remediation: [{
            priority: 'immediate',
            action: 'Validate and sanitize all tool inputs',
            description: 'Implement allowlisting for external URLs and add monitoring',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({
        sessionId: input.sessionId,
        vulnerabilitiesFound: exploitableVectors.length,
        severity: result.analysis.severity,
    }, 'Tool abuse analysis complete');

    return {
        vulnerabilityType: 'LLM07_INSECURE_PLUGIN',
        severity: result.analysis.severity,
        findings,
    };
}

export async function runDataExfiltrationAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting data exfiltration analysis');

    const agent = new DataExfiltrationAgent();

    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({});
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_de_${Date.now()}`,
        title: 'Sensitive Information Disclosure',
        owaspCategory: 'LLM06_SENSITIVE_INFO_DISCLOSURE',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 9.8 : result.analysis.severity === 'high' ? 8.5 : 6.0,
        exploitability: 'easy',
        description: result.analysis.summary,
        impact: ['System prompt exposure', 'PII leakage', 'Credential disclosure'],
        pocs: [],
        remediation: [{
            priority: 'immediate',
            action: 'Implement PII detection and redaction',
            description: 'Add credential scanning and minimize system prompt exposure',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({
        sessionId: input.sessionId,
        vulnerabilitiesFound: exploitableVectors.length,
        severity: result.analysis.severity,
    }, 'Data exfiltration analysis complete');

    return {
        vulnerabilityType: 'LLM06_SENSITIVE_INFO_DISCLOSURE',
        severity: result.analysis.severity,
        findings,
    };
}

// =============================================================================
// REPORT GENERATION ACTIVITY
// =============================================================================

export async function generateReport(input: ReportActivityInput): Promise<SecurityReport> {
    logger.info({ sessionId: input.sessionId }, 'Generating security report');

    const allFindings = input.analysisResults.flatMap(r => r.findings);

    const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
    const highCount = allFindings.filter(f => f.severity === 'high').length;
    const mediumCount = allFindings.filter(f => f.severity === 'medium').length;
    const lowCount = allFindings.filter(f => f.severity === 'low').length;

    // Determine overall risk
    let overallRisk: Severity = 'info';
    if (criticalCount > 0) overallRisk = 'critical';
    else if (highCount > 0) overallRisk = 'high';
    else if (mediumCount > 0) overallRisk = 'medium';
    else if (lowCount > 0) overallRisk = 'low';

    const report: SecurityReport = {
        metadata: {
            reportId: `report_${input.sessionId}`,
            title: `Security Assessment - ${input.target.name}`,
            assessmentDate: new Date(),
            generatedAt: new Date(),
            durationMinutes: 0,
            llmCostUsd: 0,
            version: '1.0.0',
        },

        executiveSummary: {
            criticalCount,
            highCount,
            mediumCount,
            lowCount,
            infoCount: 0,
            keyRisks: allFindings.map(f => f.title),
            immediateActions: allFindings.flatMap(f => f.remediation.filter(r => r.priority === 'immediate').map(r => r.action)),
            overallRisk,
        },

        scope: {
            targetDescription: input.target.name,
            targetUrl: input.target.baseUrl,
            llmProvider: input.reconOutput.chatbotProfile.llmProvider,
            architecture: input.reconOutput.chatbotProfile.architecture ?? 'unknown',
            capabilitiesTested: [],
            vulnerabilitiesInScope: input.analysisResults.map(r => r.vulnerabilityType),
        },

        chatbotProfile: input.reconOutput.chatbotProfile,
        attackSurface: input.reconOutput.attackSurface,

        findingsSummary: {
            bySeverity: {
                critical: allFindings.filter(f => f.severity === 'critical'),
                high: allFindings.filter(f => f.severity === 'high'),
                medium: allFindings.filter(f => f.severity === 'medium'),
                low: allFindings.filter(f => f.severity === 'low'),
                info: [],
            },
            byCategory: {} as Record<VulnerabilityType, Finding[]>,
            summaryTable: allFindings.map(f => ({
                id: f.id,
                title: f.title,
                severity: f.severity,
                cvss: f.cvssScore,
                status: f.status,
            })),
        },

        findings: allFindings,

        remediationPlan: {
            immediate: allFindings.flatMap(f => f.remediation.filter(r => r.priority === 'immediate')),
            shortTerm: allFindings.flatMap(f => f.remediation.filter(r => r.priority === 'short_term')),
            longTerm: allFindings.flatMap(f => f.remediation.filter(r => r.priority === 'long_term')),
        },

        appendices: {
            pocScripts: allFindings.flatMap(f => f.pocs),
            exploitChains: [],
        },
    };

    logger.info({
        sessionId: input.sessionId,
        overallRisk,
        totalFindings: allFindings.length,
    }, 'Report generated');

    return report;
}

// =============================================================================
// ACTIVITY EXPORTS (for Temporal worker registration)
// =============================================================================

export const pentestActivities = {
    runReconnaissance,
    runPromptInjectionAnalysis,
    runToolAbuseAnalysis,
    runDataExfiltrationAnalysis,
    generateReport,
};
