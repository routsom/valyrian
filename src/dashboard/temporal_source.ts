/**
 * Valyrian Edge - Dashboard Data Source
 * Discovers sessions from the output directory and enriches them with live
 * status from Temporal (when available). Falls back gracefully if Temporal
 * is unreachable — sessions will show last known metadata only.
 */

import { readdirSync, existsSync } from 'node:fs';
import { loadSessionMetadata } from '../cli/helpers.js';
import type { DashboardDataSource, SessionSummary } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('dashboard-source');

export class TemporalDataSource implements DashboardDataSource {
    constructor(private readonly outputDir: string) {}

    async getSessions(): Promise<SessionSummary[]> {
        if (!existsSync(this.outputDir)) return [];

        let sessionDirs: string[];
        try {
            sessionDirs = readdirSync(this.outputDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);
        } catch {
            return [];
        }

        const summaries: SessionSummary[] = [];

        for (const sessionId of sessionDirs) {
            const meta = loadSessionMetadata(this.outputDir, sessionId);
            if (!meta) continue;

            let phase = 'unknown';
            let progress = 0;
            let findingCount = 0;

            try {
                const { createPentestClient } = await import('../orchestrator/client.js');
                const client = await createPentestClient();
                try {
                    const [status, findings] = await Promise.all([
                        client.getStatus(sessionId),
                        client.getFindings(sessionId),
                    ]);
                    phase = status.phase;
                    progress = status.progress;
                    findingCount = findings.reduce((acc, f) => acc + f.count, 0);
                } finally {
                    await client.disconnect();
                }
            } catch {
                logger.debug({ sessionId }, 'Temporal unavailable; using static metadata');
            }

            summaries.push({
                sessionId: meta.sessionId,
                targetName: meta.targetName,
                targetUrl: meta.targetUrl,
                startedAt: meta.startedAt,
                phase,
                progress,
                findingCount,
            });
        }

        return summaries;
    }
}
