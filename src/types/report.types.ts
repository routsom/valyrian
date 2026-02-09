/**
 * Valyrian Edge - Report Types
 * Type definitions for security assessment reports
 */

import type { Severity, VulnerabilityType, ChatbotProfile, AttackSurface } from './vulnerability.types.js';
import type { ExploitResult, Remediation, ProofOfConcept } from './exploit.types.js';

// =============================================================================
// FINDING
// =============================================================================

export interface Finding {
    /** Unique finding identifier */
    id: string;
    /** Finding title */
    title: string;
    /** OWASP LLM category */
    owaspCategory: VulnerabilityType;
    /** Severity */
    severity: Severity;
    /** CVSS score (0.0 - 10.0) */
    cvssScore: number;
    /** Exploitability rating */
    exploitability: 'trivial' | 'easy' | 'moderate' | 'difficult';
    /** Detailed description */
    description: string;
    /** Business impact */
    impact: string[];
    /** Exploit result if exploitation was performed */
    exploit?: ExploitResult;
    /** Generated PoC scripts */
    pocs: ProofOfConcept[];
    /** Remediation recommendations */
    remediation: Remediation[];
    /** References */
    references: string[];
    /** Status */
    status: 'exploited' | 'confirmed' | 'potential' | 'informational';
}

// =============================================================================
// REPORT SECTIONS
// =============================================================================

export interface ExecutiveSummary {
    /** Total critical findings */
    criticalCount: number;
    /** Total high findings */
    highCount: number;
    /** Total medium findings */
    mediumCount: number;
    /** Total low findings */
    lowCount: number;
    /** Total informational findings */
    infoCount: number;
    /** Key risks identified */
    keyRisks: string[];
    /** Immediate actions required */
    immediateActions: string[];
    /** Overall risk rating */
    overallRisk: Severity;
}

export interface AssessmentScope {
    /** Target system description */
    targetDescription: string;
    /** Target URL */
    targetUrl: string;
    /** Detected LLM provider */
    llmProvider?: string;
    /** Detected architecture */
    architecture: string;
    /** Capabilities tested */
    capabilitiesTested: string[];
    /** Vulnerability categories in scope */
    vulnerabilitiesInScope: VulnerabilityType[];
    /** Anything explicitly out of scope */
    outOfScope?: string[];
}

export interface FindingsSummary {
    /** All findings organized by severity */
    bySeverity: Record<Severity, Finding[]>;
    /** All findings organized by OWASP category */
    byCategory: Record<VulnerabilityType, Finding[]>;
    /** Quick reference table data */
    summaryTable: Array<{
        id: string;
        title: string;
        severity: Severity;
        cvss: number;
        status: string;
    }>;
}

export interface RemediationPlan {
    /** Immediate actions (within 24 hours) */
    immediate: Remediation[];
    /** Short-term actions (within 1 week) */
    shortTerm: Remediation[];
    /** Long-term actions (within 1 month) */
    longTerm: Remediation[];
}

// =============================================================================
// SECURITY REPORT
// =============================================================================

export interface ReportMetadata {
    /** Report identifier */
    reportId: string;
    /** Report title */
    title: string;
    /** Assessment date */
    assessmentDate: Date;
    /** Report generation date */
    generatedAt: Date;
    /** Assessment duration in minutes */
    durationMinutes: number;
    /** Total LLM cost in USD */
    llmCostUsd: number;
    /** Valyrian Edge version */
    version: string;
}

export interface SecurityReport {
    /** Report metadata */
    metadata: ReportMetadata;
    /** Executive summary */
    executiveSummary: ExecutiveSummary;
    /** Assessment scope */
    scope: AssessmentScope;
    /** Chatbot profile from reconnaissance */
    chatbotProfile: ChatbotProfile;
    /** Attack surface mapping */
    attackSurface: AttackSurface;
    /** Findings summary */
    findingsSummary: FindingsSummary;
    /** Detailed findings */
    findings: Finding[];
    /** Remediation plan */
    remediationPlan: RemediationPlan;
    /** Appendices (PoC scripts, raw logs, etc.) */
    appendices: {
        pocScripts: ProofOfConcept[];
        exploitChains: ExploitResult[];
    };
}

// =============================================================================
// REPORT GENERATION OPTIONS
// =============================================================================

export type ReportFormat = 'markdown' | 'html' | 'pdf' | 'json' | 'sarif';

export interface ReportOptions {
    /** Output format */
    format: ReportFormat;
    /** Include executive summary */
    includeExecutiveSummary: boolean;
    /** Include detailed findings */
    includeDetailedFindings: boolean;
    /** Include PoC scripts */
    includePoCScripts: boolean;
    /** Include raw exploit logs */
    includeRawLogs: boolean;
    /** Redact sensitive data (credentials, PII) */
    redactSensitiveData: boolean;
    /** Custom branding/logo */
    branding?: {
        companyName: string;
        logoPath?: string;
        primaryColor?: string;
    };
}
