/**
 * Valyrian Edge - SDK Types
 * Public API types for programmatic usage
 */

import type {
    TargetProfile,
    LLMConfig,
    VulnerabilityType,
    SecurityReport,
    Finding,
} from '../types/index.js';

export type { TargetProfile, LLMConfig, VulnerabilityType, SecurityReport, Finding };

// =============================================================================
// SCAN OPTIONS
// =============================================================================

export interface ScanOptions {
    /** Target chatbot configuration */
    target: TargetProfile;
    /** LLM configuration for adversarial agents */
    llm: LLMConfig;
    /** OWASP vulnerability types to test */
    vulnerabilities: VulnerabilityType[];
    /** Whether to attempt exploitation after detection (default: false) */
    enableExploitation?: boolean;
    /** Timeout in milliseconds (default: 600_000) */
    timeoutMs?: number;
}

// =============================================================================
// SCAN EVENTS
// =============================================================================

export type ScanEventType =
    | 'started'
    | 'progress'
    | 'finding'
    | 'completed'
    | 'failed';

export interface ScanEvent {
    type: ScanEventType;
    sessionId: string;
    timestamp: Date;
    data?: unknown;
}

export interface ProgressEvent extends ScanEvent {
    type: 'progress';
    data: {
        phase: string;
        progress: number;
        currentActivity?: string;
    };
}

export interface FindingEvent extends ScanEvent {
    type: 'finding';
    data: Finding;
}

export type ScanEventHandler = (event: ScanEvent) => void;

// =============================================================================
// SCAN STATUS
// =============================================================================

export type ScanStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface ScanState {
    sessionId: string;
    status: ScanStatus;
    phase: string;
    progress: number;
    findings: Finding[];
    report?: SecurityReport;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
}

// =============================================================================
// RUNNER INTERFACE
// =============================================================================

export interface ScanRunner {
    /** Start a scan and return a session ID */
    start(options: ScanOptions): Promise<string>;
    /** Get current status */
    getStatus(sessionId: string): Promise<{ phase: string; progress: number; currentActivity?: string }>;
    /** Get current findings */
    getFindings(sessionId: string): Promise<Array<{ type: string; severity: string; count: number }>>;
    /** Wait for completion and return the report */
    waitForCompletion(sessionId: string, timeoutMs?: number): Promise<SecurityReport>;
    /** Cancel a running scan */
    cancel(sessionId: string): Promise<void>;
}

// =============================================================================
// SDK OPTIONS
// =============================================================================

export type RunnerMode = 'direct' | 'temporal';

export interface ValyrianEdgeOptions {
    /** Runner mode — 'direct' runs in-process (no Temporal required), 'temporal' uses Temporal */
    mode?: RunnerMode;
    /** Temporal address (only used when mode='temporal') */
    temporalAddress?: string;
    /** Temporal namespace (only used when mode='temporal') */
    temporalNamespace?: string;
}
