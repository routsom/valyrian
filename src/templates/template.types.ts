/**
 * Valyrian Edge - Attack Template Types
 * Schema for YAML-based attack templates
 */

// =============================================================================
// TEMPLATE SCHEMA
// =============================================================================

export interface AttackTemplate {
    /** Unique template identifier (e.g., "prompt-injection/basic-001") */
    id: string;
    /** Human-readable template name */
    name: string;
    /** Template author */
    author: string;
    /** Severity if successful */
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    /** OWASP LLM category */
    category: TemplateCategory;
    /** Descriptive tags for filtering/searching */
    tags: string[];
    /** Description of what this template tests */
    description: string;
    /** The attack payloads to send */
    payloads: TemplatePayload[];
    /** How to determine if the attack succeeded */
    matchers: TemplateMatcher[];
    /** Matcher condition: all matchers must pass, or any one */
    matcherCondition?: 'and' | 'or';
    /** Variables that can be interpolated into payloads */
    variables?: Record<string, string>;
    /** Multi-turn conversation flow (optional) */
    conversation?: ConversationStep[];
    /** Metadata */
    metadata?: TemplateMetadata;
}

export type TemplateCategory =
    | 'prompt-injection'
    | 'data-exfiltration'
    | 'insecure-output'
    | 'tool-abuse'
    | 'dos'
    | 'supply-chain'
    | 'overreliance'
    | 'model-theft'
    | 'excessive-agency'
    | 'rag-poisoning';

// =============================================================================
// PAYLOADS
// =============================================================================

export interface TemplatePayload {
    /** Payload content (supports {{variable}} interpolation) */
    content: string;
    /** Optional encoding to apply before sending */
    encoding?: PayloadEncoding;
    /** Delay before sending (ms) */
    delay?: number;
}

export type PayloadEncoding =
    | 'none'
    | 'base64'
    | 'rot13'
    | 'hex'
    | 'unicode'
    | 'url'
    | 'reverse';

// =============================================================================
// MATCHERS
// =============================================================================

export interface TemplateMatcher {
    /** Matcher type */
    type: MatcherType;
    /** What to match against */
    values: string[];
    /** Negate the match (true = fail if matched) */
    negative?: boolean;
    /** Case sensitive matching */
    caseSensitive?: boolean;
    /** Confidence weight (0.0-1.0) for this matcher */
    weight?: number;
}

export type MatcherType =
    | 'keyword'     // Simple keyword presence
    | 'regex'       // Regular expression
    | 'length'      // Response length threshold
    | 'absence'     // Keyword NOT present (model didn't refuse)
    | 'similarity'  // Semantic similarity to expected output
    | 'llm-judge';  // Use LLM to judge if attack succeeded

// =============================================================================
// CONVERSATION FLOW
// =============================================================================

export interface ConversationStep {
    /** Step number */
    step: number;
    /** Role of this step */
    role: 'setup' | 'probe' | 'escalate' | 'extract' | 'confirm';
    /** Message to send */
    message: string;
    /** Wait for response before continuing */
    waitForResponse?: boolean;
    /** Matchers to apply at this step (optional, defaults to end) */
    matchers?: TemplateMatcher[];
    /** Skip remaining steps if this step matches */
    breakOnMatch?: boolean;
}

// =============================================================================
// METADATA
// =============================================================================

export interface TemplateMetadata {
    /** Reference URLs */
    references?: string[];
    /** OWASP LLM risk mapping */
    owaspId?: string;
    /** Template version */
    version?: string;
    /** Date created */
    created?: string;
    /** Last updated */
    updated?: string;
    /** Minimum confidence to report */
    minConfidence?: number;
}

// =============================================================================
// TEMPLATE RESULT
// =============================================================================

export interface TemplateResult {
    /** Template that was run */
    templateId: string;
    templateName: string;
    /** Whether the attack succeeded */
    success: boolean;
    /** Confidence level (0.0-1.0) */
    confidence: number;
    /** Severity of the finding */
    severity: AttackTemplate['severity'];
    /** Category */
    category: TemplateCategory;
    /** The payload that triggered the finding */
    payload: string;
    /** The response from the target */
    response: string;
    /** Which matchers triggered */
    matchedBy: string[];
    /** Evidence details */
    evidence: Record<string, unknown>;
    /** Timestamp */
    timestamp: Date;
}

// =============================================================================
// TEMPLATE COLLECTION (for loading)
// =============================================================================

export interface TemplateCollection {
    /** All loaded templates */
    templates: AttackTemplate[];
    /** Index by category */
    byCategory: Map<TemplateCategory, AttackTemplate[]>;
    /** Index by tag */
    byTag: Map<string, AttackTemplate[]>;
    /** Total count */
    count: number;
}
