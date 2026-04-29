# Web Dashboard

Valyrian Edge includes a zero-dependency real-time dashboard that streams scan progress via Server-Sent Events (SSE).

## Starting the Dashboard

```bash
npx valyrian dashboard --port 3000 --output ./scan-output
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port`, `-p` | `3000` | HTTP port to listen on |
| `--host` | `localhost` | Bind address |
| `--output`, `-o` | `./scan-output` | Directory where scan sessions are stored |

Open `http://localhost:3000` in a browser to view the dashboard.

## What It Shows

The dashboard lists all scan sessions found in `--output`, with live updates for running scans:

- Session ID and target name
- Current phase (`reconnaissance` → `analysis` → `reporting` → `completed`)
- Progress percentage
- Finding counts by severity
- Start time and duration

## SSE API

The dashboard exposes a raw SSE stream at `/events` for programmatic consumption:

```bash
curl -N http://localhost:3000/events
```

Each event is a JSON-serialised array of `SessionSummary` objects:

```
data: [{"sessionId":"abc123","targetName":"My Bot","phase":"analysis","progress":45,"findings":{"critical":0,"high":1,"medium":2,"low":0},"startedAt":"2026-04-29T10:00:00.000Z"}]
```

### `SessionSummary` shape

```typescript
interface SessionSummary {
    sessionId: string;
    targetName: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    phase: string;
    progress: number;         // 0–100
    findings: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
    startedAt: string;        // ISO-8601
    completedAt?: string;     // ISO-8601, present when status !== 'running'
    durationMinutes?: number;
}
```

### Health endpoint

`GET /health` returns `200 OK` with `{"status":"ok"}` for load-balancer / readiness probes.

## Running Behind Temporal

When scans are managed by Temporal, the dashboard automatically enriches session data with live Temporal workflow status. If Temporal is unavailable the dashboard falls back gracefully to on-disk metadata.

## Embedding the Dashboard Server Programmatically

```typescript
import { DashboardServer } from 'valyrian-edge/dashboard';

const server = new DashboardServer({
    port: 3000,
    host: 'localhost',
    outputDir: './scan-output',
    pollIntervalMs: 2000,
});

await server.start();
console.log('Dashboard running at http://localhost:3000');

// Stop gracefully
await server.stop();
```
