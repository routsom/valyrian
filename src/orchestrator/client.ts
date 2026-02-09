/**
 * Valyrian Edge - Temporal Client
 * Client for starting and managing pentest workflows
 */

import { Client, Connection } from '@temporalio/client';
import { nanoid } from 'nanoid';
import type { PentestWorkflowInput } from './workflows.js';
import {
    cancelSignal,
    pauseSignal,
    resumeSignal,
    statusQuery,
    progressQuery,
    findingsQuery,
} from './workflows.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('temporal-client');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TEMPORAL_ADDRESS = process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env['TEMPORAL_NAMESPACE'] ?? 'default';
const TASK_QUEUE = process.env['TEMPORAL_TASK_QUEUE'] ?? 'valyrian-pentest-queue';

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class PentestClient {
    private client: Client | null = null;
    private connection: Connection | null = null;

    async connect(): Promise<void> {
        if (this.client) return;

        logger.info({ address: TEMPORAL_ADDRESS }, 'Connecting to Temporal');

        this.connection = await Connection.connect({
            address: TEMPORAL_ADDRESS,
        });

        this.client = new Client({
            connection: this.connection,
            namespace: TEMPORAL_NAMESPACE,
        });

        logger.info('Connected to Temporal');
    }

    async disconnect(): Promise<void> {
        if (this.connection) {
            await this.connection.close();
            this.connection = null;
            this.client = null;
        }
    }

    // ===========================================================================
    // WORKFLOW MANAGEMENT
    // ===========================================================================

    async startPentest(input: Omit<PentestWorkflowInput, 'sessionId'>): Promise<string> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const sessionId = nanoid();
        const workflowId = `pentest-${sessionId}`;

        logger.info({
            workflowId,
            targetName: input.target.name,
        }, 'Starting pentest workflow');

        const handle = await this.client.workflow.start('pentestWorkflow', {
            taskQueue: TASK_QUEUE,
            workflowId,
            args: [{ ...input, sessionId }],
        });

        logger.info({ workflowId, runId: handle.firstExecutionRunId }, 'Workflow started');

        return sessionId;
    }

    async getStatus(sessionId: string): Promise<{
        phase: string;
        progress: number;
        currentActivity?: string;
        error?: string;
    }> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const handle = this.client.workflow.getHandle(`pentest-${sessionId}`);
        return await handle.query(statusQuery);
    }

    async getProgress(sessionId: string): Promise<number> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const handle = this.client.workflow.getHandle(`pentest-${sessionId}`);
        return await handle.query(progressQuery);
    }

    async getFindings(sessionId: string): Promise<Array<{
        type: string;
        severity: string;
        count: number;
    }>> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const handle = this.client.workflow.getHandle(`pentest-${sessionId}`);
        return await handle.query(findingsQuery);
    }

    async cancelPentest(sessionId: string): Promise<void> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const handle = this.client.workflow.getHandle(`pentest-${sessionId}`);
        await handle.signal(cancelSignal);
        logger.info({ sessionId }, 'Pentest cancelled');
    }

    async pausePentest(sessionId: string): Promise<void> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const handle = this.client.workflow.getHandle(`pentest-${sessionId}`);
        await handle.signal(pauseSignal);
        logger.info({ sessionId }, 'Pentest paused');
    }

    async resumePentest(sessionId: string): Promise<void> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const handle = this.client.workflow.getHandle(`pentest-${sessionId}`);
        await handle.signal(resumeSignal);
        logger.info({ sessionId }, 'Pentest resumed');
    }

    async waitForCompletion(sessionId: string): Promise<unknown> {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const handle = this.client.workflow.getHandle(`pentest-${sessionId}`);
        return await handle.result();
    }
}

// =============================================================================
// FACTORY
// =============================================================================

export async function createPentestClient(): Promise<PentestClient> {
    const client = new PentestClient();
    await client.connect();
    return client;
}

export default PentestClient;
