# SDK Reference

Valyrian Edge ships a fully typed TypeScript SDK so you can embed LLM security scans directly in your own code — no CLI required.

## Installation

```bash
npm install valyrian-edge
```

Or use it in-repo after `npm run build`.

## Quick Example

```typescript
import { ValyrianEdge } from 'valyrian-edge';

const valyrian = new ValyrianEdge({ mode: 'direct' });

const report = await valyrian.scanAndWait({
    target: {
        id: 'my-chatbot',
        name: 'My Chatbot',
        baseUrl: 'https://chatbot.example.com',
        endpoints: { chat: '/api/chat' },
    },
    llm: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        apiKey: process.env.ANTHROPIC_API_KEY,
    },
    vulnerabilities: ['LLM01_PROMPT_INJECTION', 'LLM06_SENSITIVE_INFO_DISCLOSURE'],
});

console.log(`Found ${report.findings.length} findings`);
```

## `ValyrianEdge`

### Constructor

```typescript
new ValyrianEdge(options?: ValyrianEdgeOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'direct' \| 'temporal'` | `'direct'` | Runner backend |
| `temporalAddress` | `string` | `'localhost:7233'` | Temporal server (temporal mode only) |
| `temporalNamespace` | `string` | `'default'` | Temporal namespace (temporal mode only) |

### `scan(options): Promise<ScanSession>`

Starts a scan and returns a `ScanSession` handle immediately. The scan runs in the background.

### `scanAndWait(options): Promise<SecurityReport>`

Convenience wrapper — starts a scan and waits for it to complete, returning the final report.

## `ScanSession`

```typescript
const session = await valyrian.scan(options);

// Check progress
const { phase, progress } = await session.status();
// phase: 'reconnaissance' | 'analysis' | 'reporting' | 'completed'

// Stream interim findings
const findings = await session.findings();
// [{ type: 'LLM01_PROMPT_INJECTION', severity: 'high', count: 2 }]

// Wait for final report
const report = await session.waitForCompletion(timeoutMs);

// Cancel
await session.cancel();
```

## `ScanOptions`

```typescript
interface ScanOptions {
    target: {
        id: string;
        name: string;
        baseUrl: string;
        architecture?: 'rag' | 'agent' | 'fine-tuned' | 'vanilla';
        endpoints?: { chat?: string; upload?: string; [key: string]: string | undefined };
        headers?: Record<string, string>;
        authToken?: string;
    };
    llm: {
        provider: 'anthropic' | 'openai' | 'ollama';
        model: string;
        apiKey?: string;
        temperature?: number;
        maxTokens?: number;
    };
    vulnerabilities: VulnerabilityType[];
    enableExploitation?: boolean;
    depth?: 'quick' | 'standard' | 'thorough';
    timeoutMs?: number;
}
```

### `VulnerabilityType` values

| Value | OWASP Category |
|-------|----------------|
| `LLM01_PROMPT_INJECTION` | Prompt Injection |
| `LLM02_INSECURE_OUTPUT` | Insecure Output Handling |
| `LLM03_TRAINING_DATA_POISONING` | Training Data Poisoning / RAG |
| `LLM04_MODEL_DOS` | Model Denial of Service |
| `LLM05_SUPPLY_CHAIN` | Supply Chain Vulnerabilities |
| `LLM06_SENSITIVE_INFO_DISCLOSURE` | Sensitive Info Disclosure |
| `LLM07_INSECURE_PLUGIN` | Insecure Plugin Design |
| `LLM08_EXCESSIVE_AGENCY` | Excessive Agency |
| `LLM09_OVERRELIANCE` | Overreliance |
| `LLM10_MODEL_THEFT` | Model Theft |

## Runners

### `DirectRunner` (default)

Runs all scan activities in-process. No Temporal required. Best for CI pipelines, unit tests, and quick scans.

```typescript
import { DirectRunner } from 'valyrian-edge';

const runner = new DirectRunner();
const sessionId = await runner.start(options);
const report = await runner.waitForCompletion(sessionId, 120_000);
```

### `TemporalRunner`

Routes scan execution through Temporal workflows for durability and resumability. Requires a running Temporal server.

```typescript
import { TemporalRunner } from 'valyrian-edge';

const runner = new TemporalRunner({
    address: 'localhost:7233',
    namespace: 'default',
});
```

## Error Handling

```typescript
try {
    const report = await valyrian.scanAndWait(options);
} catch (err) {
    if (err.message.includes('timed out')) {
        // scan exceeded timeoutMs
    }
    if (err.message.includes('cancelled')) {
        // session.cancel() was called
    }
}
```

## TypeScript Types

All types are exported from the package root:

```typescript
import type {
    ScanOptions,
    SecurityReport,
    Finding,
    VulnerabilityType,
    ScanStatus,
    ValyrianEdgeOptions,
} from 'valyrian-edge';
```
