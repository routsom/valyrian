/**
 * Valyrian Edge - Temporal Worker
 * Worker process that executes workflow activities
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { pentestActivities } from './activities.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('temporal-worker');

// =============================================================================
// CONFIGURATION
// =============================================================================

const TEMPORAL_ADDRESS = process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env['TEMPORAL_NAMESPACE'] ?? 'default';
const TASK_QUEUE = process.env['TEMPORAL_TASK_QUEUE'] ?? 'valyrian-pentest-queue';

// =============================================================================
// WORKER SETUP
// =============================================================================

async function runWorker(): Promise<void> {
    logger.info({
        address: TEMPORAL_ADDRESS,
        namespace: TEMPORAL_NAMESPACE,
        taskQueue: TASK_QUEUE,
    }, 'Starting Temporal worker');

    const connection = await NativeConnection.connect({
        address: TEMPORAL_ADDRESS,
    });

    const worker = await Worker.create({
        connection,
        namespace: TEMPORAL_NAMESPACE,
        taskQueue: TASK_QUEUE,
        workflowsPath: new URL('./workflows.js', import.meta.url).pathname,
        activities: pentestActivities,
        maxConcurrentActivityTaskExecutions: 5,
        maxConcurrentWorkflowTaskExecutions: 10,
    });

    logger.info('Worker created, starting execution');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down worker');
        await worker.shutdown();
        await connection.close();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down worker');
        await worker.shutdown();
        await connection.close();
        process.exit(0);
    });

    // Run the worker
    await worker.run();
}

// =============================================================================
// MAIN
// =============================================================================

runWorker().catch((err) => {
    logger.error({ error: err }, 'Worker failed');
    process.exit(1);
});
