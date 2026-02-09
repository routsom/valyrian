/**
 * Valyrian Edge - Agent Types
 * Type definitions for LLM agents
 */

import type { VulnerabilityAnalysis, ChatbotProfile, AttackSurface } from './vulnerability.types.js';
import type { ExploitResult } from './exploit.types.js';
import type { SecurityReport } from './report.types.js';
import type { LLMConfig, TargetProfile, ScanScope } from './config.types.js';

// =============================================================================
// AGENT STATE
// =============================================================================

export type AgentStatus =
    | 'idle'
    | 'initializing'
    | 'running'
    | 'waiting'
    | 'completed'
    | 'failed'
    | 'aborted';

export interface AgentState {
    /** Current status */
    status: AgentStatus;
    /** Current operation description */
    currentOperation?: string;
    /** Progress percentage (0-100) */
    progress: number;
    /** Number of API calls made */
    apiCallCount: number;
    /** Token usage */
    tokenUsage: {
        input: number;
        output: number;
        total: number;
    };
    /** Start time */
    startedAt?: Date;
    /** End time */
    completedAt?: Date;
    /** Error if failed */
    error?: string;
}

// =============================================================================
// AGENT CONTEXT
// =============================================================================

export interface AgentContext {
    /** Session identifier */
    sessionId: string;
    /** Target configuration */
    target: TargetProfile;
    /** LLM configuration */
    llm: LLMConfig;
    /** Scan scope */
    scope: ScanScope;
    /** Output directory */
    outputDir: string;
    /** Conversation history for multi-turn */
    conversationHistory: ConversationTurn[];
    /** Discovered information from previous agents */
    discoveredInfo: {
        chatbotProfile?: ChatbotProfile;
        attackSurface?: AttackSurface;
        analyses?: VulnerabilityAnalysis[];
        exploits?: ExploitResult[];
    };
}

// =============================================================================
// CONVERSATION
// =============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
    /** Message role */
    role: MessageRole;
    /** Message content */
    content: string;
    /** Tool call ID if this is a tool message */
    toolCallId?: string;
    /** Tool name if this is a tool message */
    toolName?: string;
    /** Timestamp */
    timestamp: Date;
}

export interface ConversationTurn {
    /** Turn number */
    turn: number;
    /** User/attacker message */
    userMessage: Message;
    /** Assistant/target response */
    assistantMessage: Message;
    /** Analysis of this turn */
    analysis?: {
        attackSuccessful: boolean;
        indicatorsFound: string[];
        nextSteps: string[];
    };
}

// =============================================================================
// AGENT OUTPUTS
// =============================================================================

export interface ReconOutput {
    /** Discovered chatbot profile */
    chatbotProfile: ChatbotProfile;
    /** Mapped attack surface */
    attackSurface: AttackSurface;
    /** Recommended vulnerability analyses */
    recommendedAnalyses: string[];
    /** Raw reconnaissance logs */
    rawLogs: string[];
}

export interface AnalysisOutput {
    /** Vulnerability analysis result */
    analysis: VulnerabilityAnalysis;
    /** Recommended exploits if vulnerabilities found */
    recommendedExploits: string[];
    /** Conversation history used */
    conversationHistory: ConversationTurn[];
}

export interface ExploitOutput {
    /** Exploit result */
    result: ExploitResult;
    /** Generated PoC scripts */
    pocScripts: string[];
}

export interface ReportOutput {
    /** Generated security report */
    report: SecurityReport;
    /** Report file path */
    reportPath: string;
    /** Additional exported formats */
    exportedFormats: Record<string, string>;
}

// =============================================================================
// AGENT INTERFACE
// =============================================================================

export interface IAgent<TInput, TOutput> {
    /** Agent name */
    readonly name: string;
    /** Agent description */
    readonly description: string;
    /** Current state */
    state: AgentState;

    /** Initialize the agent */
    initialize(context: AgentContext): Promise<void>;

    /** Execute the agent's main task */
    execute(input: TInput): Promise<TOutput>;

    /** Get current status */
    getStatus(): AgentState;

    /** Abort execution */
    abort(): Promise<void>;

    /** Clean up resources */
    cleanup(): Promise<void>;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    enum?: string[];
    default?: unknown;
}

export interface ToolDefinition {
    /** Tool name */
    name: string;
    /** Tool description */
    description: string;
    /** Parameters */
    parameters: ToolParameter[];
    /** Whether this tool can be used autonomously */
    autonomous: boolean;
    /** Danger level (for logging/approval) */
    dangerLevel: 'safe' | 'moderate' | 'dangerous';
}

export interface ToolCall {
    /** Tool name */
    name: string;
    /** Arguments */
    arguments: Record<string, unknown>;
    /** Call ID */
    callId: string;
}

export interface ToolResult {
    /** Call ID */
    callId: string;
    /** Whether successful */
    success: boolean;
    /** Result data */
    data?: unknown;
    /** Error message if failed */
    error?: string;
}
