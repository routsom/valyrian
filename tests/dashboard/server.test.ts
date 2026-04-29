/**
 * Dashboard Server Tests
 */

import { describe, it, expect, afterEach } from 'vitest';
import { DashboardServer } from '../../src/dashboard/server.js';
import type { DashboardDataSource, SessionSummary } from '../../src/dashboard/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSource(sessions: SessionSummary[] = []): DashboardDataSource {
    return { getSessions: async () => sessions };
}

const sampleSession: SessionSummary = {
    sessionId: 'sess-abc-001',
    targetName: 'Test Bot',
    targetUrl: 'https://bot.example.com',
    startedAt: '2026-04-27T10:00:00.000Z',
    phase: 'analysis',
    progress: 50,
    findingCount: 2,
};

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
    for (const close of closers.splice(0)) {
        await close().catch(() => { /* ignore */ });
    }
});

async function startServer(source: DashboardDataSource = mockSource()): Promise<{ url: string; close: () => Promise<void> }> {
    const port = 37400 + Math.floor(Math.random() * 1000);
    const server = new DashboardServer(source, { port, host: '127.0.0.1', pollIntervalMs: 60_000 });
    const result = await server.start();
    closers.push(result.close);
    return result;
}

// ---------------------------------------------------------------------------
// DashboardServer — startup
// ---------------------------------------------------------------------------

describe('DashboardServer', () => {
    it('start() resolves with a url string', async () => {
        const { url } = await startServer();
        expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    });

    it('GET / returns HTML with dashboard content', async () => {
        const { url } = await startServer();
        const res = await fetch(url + '/');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        const text = await res.text();
        expect(text).toContain('Valyrian Edge');
    });

    it('GET /health returns { ok: true }', async () => {
        const { url } = await startServer();
        const res = await fetch(url + '/health');
        expect(res.status).toBe(200);
        const body = await res.json() as { ok: boolean };
        expect(body.ok).toBe(true);
    });

    it('close() shuts down the server so subsequent requests fail', async () => {
        const { url, close } = await startServer();
        const before = await fetch(url + '/health');
        expect(before.status).toBe(200);

        await close();
        closers.splice(closers.findIndex(c => c === close), 1);

        await expect(fetch(url + '/health')).rejects.toThrow();
    });

    it('GET / works with an empty session list', async () => {
        const { url } = await startServer(mockSource([]));
        const res = await fetch(url + '/');
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain('No sessions yet');
    });
});

// ---------------------------------------------------------------------------
// DashboardServer — SSE /events
// ---------------------------------------------------------------------------

describe('DashboardServer SSE /events', () => {
    it('GET /events returns text/event-stream content-type', async () => {
        const { url } = await startServer(mockSource([sampleSession]));
        const controller = new AbortController();
        const res = await fetch(url + '/events', { signal: controller.signal });
        expect(res.headers.get('content-type')).toContain('text/event-stream');
        controller.abort();
    });

    it('first SSE message contains sessions array with correct fields', async () => {
        const { url } = await startServer(mockSource([sampleSession]));
        const controller = new AbortController();
        const res = await fetch(url + '/events', { signal: controller.signal });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let parsed: { sessions: SessionSummary[]; lastUpdated: string } | null = null;

        while (!parsed) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            for (const line of buffer.split('\n')) {
                if (line.startsWith('data: ')) {
                    parsed = JSON.parse(line.slice(6)) as { sessions: SessionSummary[]; lastUpdated: string };
                    break;
                }
            }
        }

        controller.abort();
        reader.cancel().catch(() => { /* ignore */ });

        expect(parsed).not.toBeNull();
        expect(parsed!.sessions).toHaveLength(1);
        expect(parsed!.sessions[0]?.sessionId).toBe('sess-abc-001');
        expect(typeof parsed!.lastUpdated).toBe('string');
    }, 10_000);
});

// ---------------------------------------------------------------------------
// TemporalDataSource — no Temporal available
// ---------------------------------------------------------------------------

describe('TemporalDataSource', () => {
    it('returns empty array when outputDir does not exist', async () => {
        const { TemporalDataSource } = await import('../../src/dashboard/temporal_source.js');
        const src = new TemporalDataSource('/tmp/nonexistent-valyrian-xyz-123');
        const sessions = await src.getSessions();
        expect(sessions).toEqual([]);
    });
});
