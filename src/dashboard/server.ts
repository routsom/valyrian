/**
 * Valyrian Edge - Dashboard HTTP Server
 * Serves the embedded dashboard HTML and a Server-Sent Events (SSE) endpoint
 * that pushes live session state every pollIntervalMs milliseconds.
 * Zero additional dependencies — uses Node.js built-in http module.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { getDashboardHtml } from './html.js';
import type { DashboardDataSource, DashboardOptions } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('dashboard-server');

const DEFAULT_PORT = 7400;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_POLL_MS = 3000;

export class DashboardServer {
    private readonly port: number;
    private readonly host: string;
    private readonly pollIntervalMs: number;
    private readonly source: DashboardDataSource;
    private sseClients: Set<ServerResponse> = new Set();
    private pollTimer: ReturnType<typeof setInterval> | null = null;

    constructor(source: DashboardDataSource, opts: DashboardOptions = {}) {
        this.source = source;
        this.port = opts.port ?? DEFAULT_PORT;
        this.host = opts.host ?? DEFAULT_HOST;
        this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
    }

    start(): Promise<{ url: string; close: () => Promise<void> }> {
        return new Promise((resolve, reject) => {
            const server = createServer((req, res) => { void this.handleRequest(req, res); });

            server.on('error', reject);

            server.listen(this.port, this.host, () => {
                const url = `http://${this.host}:${this.port}`;
                logger.info({ url }, 'Dashboard server started');

                this.pollTimer = setInterval(() => { void this.pushToClients(); }, this.pollIntervalMs);

                resolve({
                    url,
                    close: () => new Promise<void>((res2, rej2) => {
                        if (this.pollTimer) clearInterval(this.pollTimer);
                        this.sseClients.forEach(c => { try { c.end(); } catch { /* ignore */ } });
                        this.sseClients.clear();
                        server.close(err => err ? rej2(err) : res2());
                    }),
                });
            });
        });
    }

    private async pushToClients(): Promise<void> {
        if (this.sseClients.size === 0) return;
        try {
            const payload = await this.buildPayload();
            const data = `data: ${JSON.stringify(payload)}\n\n`;
            for (const client of this.sseClients) {
                try { client.write(data); } catch { this.sseClients.delete(client); }
            }
        } catch (err) {
            logger.warn({ err }, 'SSE push failed');
        }
    }

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = req.url ?? '/';

        if (url === '/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
            });
            res.flushHeaders();

            try {
                const payload = await this.buildPayload();
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            } catch { /* ignore initial push error */ }

            this.sseClients.add(res);
            req.on('close', () => { this.sseClients.delete(res); });
            return;
        }

        if (url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        const html = getDashboardHtml();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }

    private async buildPayload(): Promise<{ sessions: Awaited<ReturnType<DashboardDataSource['getSessions']>>; lastUpdated: string }> {
        const sessions = await this.source.getSessions();
        return { sessions, lastUpdated: new Date().toISOString() };
    }
}
