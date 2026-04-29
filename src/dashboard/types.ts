/**
 * Valyrian Edge - Dashboard Types
 */

export interface SessionSummary {
    sessionId: string;
    targetName: string;
    targetUrl: string;
    startedAt: string;
    phase: string;
    progress: number;
    findingCount: number;
}

export interface DashboardState {
    sessions: SessionSummary[];
    lastUpdated: string;
}

/** Interface for anything that can supply live session data to the dashboard server. */
export interface DashboardDataSource {
    /** Return the current list of session summaries. */
    getSessions(): Promise<SessionSummary[]>;
}

export interface DashboardOptions {
    /** TCP port to listen on (default: 7400) */
    port?: number;
    /** Host to bind to (default: '127.0.0.1') */
    host?: string;
    /** SSE push interval in milliseconds (default: 3000) */
    pollIntervalMs?: number;
    /** Output directory used to discover session metadata files */
    outputDir?: string;
}
