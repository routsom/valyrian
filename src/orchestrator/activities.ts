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
import { InsecureOutputAgent } from '../agents/insecure_output_agent.js';
import { RAGPoisoningAgent } from '../agents/rag_poisoning_agent.js';
import { DoSAgent } from '../agents/dos_agent.js';
import { SupplyChainAgent } from '../agents/supply_chain_agent.js';
import { ExcessiveAgencyAgent } from '../agents/excessive_agency_agent.js';
import { OverrelianceAgent } from '../agents/overreliance_agent.js';
import { ModelTheftAgent } from '../agents/model_theft_agent.js';
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
// LLM02 - INSECURE OUTPUT ANALYSIS
// =============================================================================

export async function runInsecureOutputAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting insecure output analysis');

    const agent = new InsecureOutputAgent();
    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({});
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_io_${Date.now()}`,
        title: 'Insecure Output Handling',
        owaspCategory: 'LLM02_INSECURE_OUTPUT',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 9.1 : result.analysis.severity === 'high' ? 7.5 : 5.0,
        exploitability: 'moderate',
        description: result.analysis.summary,
        impact: ['XSS via reflected LLM output', 'SQL injection passthrough', 'Command injection passthrough'],
        pocs: [],
        remediation: [{
            priority: 'immediate',
            action: 'Sanitize all LLM output before rendering',
            description: 'Apply context-aware output encoding; never pass raw LLM output to downstream parsers',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({ sessionId: input.sessionId, vulnerabilitiesFound: exploitableVectors.length }, 'Insecure output analysis complete');
    return { vulnerabilityType: 'LLM02_INSECURE_OUTPUT', severity: result.analysis.severity, findings };
}

// =============================================================================
// LLM03 - RAG / TRAINING DATA POISONING ANALYSIS
// =============================================================================

export async function runRAGPoisoningAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting RAG poisoning analysis');

    const agent = new RAGPoisoningAgent();
    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({});
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_rag_${Date.now()}`,
        title: 'RAG / Training Data Poisoning',
        owaspCategory: 'LLM03_TRAINING_DATA_POISONING',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 9.0 : result.analysis.severity === 'high' ? 7.8 : 5.5,
        exploitability: 'moderate',
        description: result.analysis.summary,
        impact: ['Indirect prompt injection via poisoned documents', 'Misinformation in retrieved context', 'System prompt leakage via RAG boundaries'],
        pocs: [],
        remediation: [{
            priority: 'immediate',
            action: 'Validate and sanitize documents before indexing',
            description: 'Strip executable instructions from indexed content; implement retrieval-result filtering',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({ sessionId: input.sessionId, vulnerabilitiesFound: exploitableVectors.length }, 'RAG poisoning analysis complete');
    return { vulnerabilityType: 'LLM03_TRAINING_DATA_POISONING', severity: result.analysis.severity, findings };
}

// =============================================================================
// LLM04 - MODEL DENIAL OF SERVICE ANALYSIS
// =============================================================================

export async function runDoSAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting DoS analysis');

    const agent = new DoSAgent();
    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({});
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_dos_${Date.now()}`,
        title: 'Model Denial of Service',
        owaspCategory: 'LLM04_MODEL_DOS',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 8.6 : result.analysis.severity === 'high' ? 7.5 : 5.3,
        exploitability: 'easy',
        description: result.analysis.summary,
        impact: ['Service degradation via token exhaustion', 'Excessive API cost amplification', 'Context window overflow causing unpredictable output'],
        pocs: [],
        remediation: [{
            priority: 'immediate',
            action: 'Implement input length limits and rate limiting',
            description: 'Cap max tokens per request; add per-user rate limits and circuit breakers',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({ sessionId: input.sessionId, vulnerabilitiesFound: exploitableVectors.length }, 'DoS analysis complete');
    return { vulnerabilityType: 'LLM04_MODEL_DOS', severity: result.analysis.severity, findings };
}

// =============================================================================
// LLM05 - SUPPLY CHAIN ANALYSIS
// =============================================================================

export async function runSupplyChainAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting supply chain analysis');

    const agent = new SupplyChainAgent();
    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({ targetUrl: input.target.baseUrl });
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_sc_${Date.now()}`,
        title: 'Supply Chain Vulnerability',
        owaspCategory: 'LLM05_SUPPLY_CHAIN',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 9.3 : result.analysis.severity === 'high' ? 8.0 : 5.5,
        exploitability: 'moderate',
        description: result.analysis.summary,
        impact: ['Unverified model or plugin provenance', 'Dependency confusion attacks', 'Compromised third-party integrations'],
        pocs: [],
        remediation: [{
            priority: 'short_term',
            action: 'Audit all third-party model providers and plugins',
            description: 'Verify model integrity hashes; pin plugin versions; review supply chain access controls',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({ sessionId: input.sessionId, vulnerabilitiesFound: exploitableVectors.length }, 'Supply chain analysis complete');
    return { vulnerabilityType: 'LLM05_SUPPLY_CHAIN', severity: result.analysis.severity, findings };
}

// =============================================================================
// LLM08 - EXCESSIVE AGENCY ANALYSIS
// =============================================================================

export async function runExcessiveAgencyAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting excessive agency analysis');

    const agent = new ExcessiveAgencyAgent();
    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({});
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_ea_${Date.now()}`,
        title: 'Excessive Agency',
        owaspCategory: 'LLM08_EXCESSIVE_AGENCY',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 9.5 : result.analysis.severity === 'high' ? 8.2 : 6.0,
        exploitability: 'easy',
        description: result.analysis.summary,
        impact: ['Unauthorized actions performed without user approval', 'Irreversible operations triggered via prompt injection', 'Privilege escalation through tool misuse'],
        pocs: [],
        remediation: [{
            priority: 'immediate',
            action: 'Implement human-in-the-loop for all destructive operations',
            description: 'Require explicit confirmation for writes/deletes; apply least-privilege tool permissions',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({ sessionId: input.sessionId, vulnerabilitiesFound: exploitableVectors.length }, 'Excessive agency analysis complete');
    return { vulnerabilityType: 'LLM08_EXCESSIVE_AGENCY', severity: result.analysis.severity, findings };
}

// =============================================================================
// LLM09 - OVERRELIANCE ANALYSIS
// =============================================================================

export async function runOverrelianceAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting overreliance analysis');

    const agent = new OverrelianceAgent();
    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({ targetUrl: input.target.baseUrl });
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_or_${Date.now()}`,
        title: 'Overreliance on LLM Output',
        owaspCategory: 'LLM09_OVERRELIANCE',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 7.5 : result.analysis.severity === 'high' ? 6.5 : 4.5,
        exploitability: 'moderate',
        description: result.analysis.summary,
        impact: ['Misinformation propagated as authoritative fact', 'Fake citations and hallucinated references', 'Confident incorrect code or legal advice'],
        pocs: [],
        remediation: [{
            priority: 'short_term',
            action: 'Add confidence indicators and source citations to all LLM responses',
            description: 'Surface uncertainty in UI; require human review for high-stakes outputs',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({ sessionId: input.sessionId, vulnerabilitiesFound: exploitableVectors.length }, 'Overreliance analysis complete');
    return { vulnerabilityType: 'LLM09_OVERRELIANCE', severity: result.analysis.severity, findings };
}

// =============================================================================
// LLM10 - MODEL THEFT ANALYSIS
// =============================================================================

export async function runModelTheftAnalysis(input: AnalysisActivityInput): Promise<AnalysisResult> {
    logger.info({ sessionId: input.sessionId }, 'Starting model theft analysis');

    const agent = new ModelTheftAgent();
    const context = buildAgentContext(input.sessionId, input.target, input.llmConfig, input.reconOutput);
    await agent.initialize(context);

    const result: AnalysisOutput = await agent.execute({ targetUrl: input.target.baseUrl });
    const exploitableVectors = result.analysis.attackVectors.filter(v => v.exploitable);

    const findings: Finding[] = exploitableVectors.length > 0 ? [{
        id: `finding_mt_${Date.now()}`,
        title: 'Model Theft / Intellectual Property Extraction',
        owaspCategory: 'LLM10_MODEL_THEFT',
        severity: result.analysis.severity,
        cvssScore: result.analysis.severity === 'critical' ? 8.8 : result.analysis.severity === 'high' ? 7.2 : 4.8,
        exploitability: 'moderate',
        description: result.analysis.summary,
        impact: ['System prompt and fine-tuning data disclosure', 'Architecture / hyperparameter leakage enabling replication', 'Training data memorization exposing sensitive content'],
        pocs: [],
        remediation: [{
            priority: 'short_term',
            action: 'Restrict disclosure of model internals and apply output filtering',
            description: 'Redact model metadata from responses; monitor for extraction-pattern queries',
        }],
        references: ['https://owasp.org/www-project-top-10-for-large-language-model-applications/'],
        status: 'confirmed',
    }] : [];

    logger.info({ sessionId: input.sessionId, vulnerabilitiesFound: exploitableVectors.length }, 'Model theft analysis complete');
    return { vulnerabilityType: 'LLM10_MODEL_THEFT', severity: result.analysis.severity, findings };
}

// =============================================================================
// ACTIVITY EXPORTS (for Temporal worker registration)
// =============================================================================

export const pentestActivities = {
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
};
