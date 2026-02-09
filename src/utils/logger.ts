/**
 * Valyrian Edge - Logger
 * Structured logging with Pino
 */

import pino from 'pino';

// =============================================================================
// LOGGER CONFIGURATION
// =============================================================================

const logLevel = process.env['LOG_LEVEL'] ?? 'info';
const isDevelopment = process.env['NODE_ENV'] !== 'production';

// Create base logger
export const logger = pino({
    level: logLevel,
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    base: {
        service: 'valyrian-edge',
    },
    formatters: {
        level: (label) => ({ level: label }),
    },
});

// =============================================================================
// CHILD LOGGERS
// =============================================================================

/**
 * Create a child logger for a specific component
 */
export function createLogger(component: string, meta?: Record<string, unknown>): pino.Logger {
    return logger.child({ component, ...meta });
}

// =============================================================================
// SPECIALIZED LOGGERS
// =============================================================================

/** Logger for CLI operations */
export const cliLogger = createLogger('cli');

/** Logger for Temporal workflows */
export const workflowLogger = createLogger('workflow');

/** Logger for agents */
export const agentLogger = createLogger('agent');

/** Logger for tools */
export const toolLogger = createLogger('tool');

/** Logger for API server */
export const apiLogger = createLogger('api');

// =============================================================================
// AUDIT LOGGING
// =============================================================================

export interface AuditLogEntry {
    sessionId: string;
    timestamp: Date;
    action: string;
    component: string;
    details: Record<string, unknown>;
    success: boolean;
    error?: string;
}

/**
 * Log an audit entry (for compliance and debugging)
 */
export function logAudit(entry: AuditLogEntry): void {
    logger.info({
        audit: true,
        sessionId: entry.sessionId,
        action: entry.action,
        component: entry.component,
        details: entry.details,
        success: entry.success,
        error: entry.error,
    }, `[AUDIT] ${entry.action}`);
}

// =============================================================================
// PERFORMANCE LOGGING
// =============================================================================

export interface PerformanceEntry {
    operation: string;
    durationMs: number;
    metadata?: Record<string, unknown>;
}

/**
 * Log performance metrics
 */
export function logPerformance(entry: PerformanceEntry): void {
    logger.debug({
        performance: true,
        operation: entry.operation,
        durationMs: entry.durationMs,
        ...entry.metadata,
    }, `[PERF] ${entry.operation}: ${entry.durationMs}ms`);
}

/**
 * Create a timer for performance tracking
 */
export function createTimer(operation: string): () => void {
    const start = performance.now();
    return () => {
        const durationMs = Math.round(performance.now() - start);
        logPerformance({ operation, durationMs });
    };
}

export default logger;
