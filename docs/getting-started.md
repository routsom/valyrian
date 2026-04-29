# Getting Started

This guide will help you set up Valyrian Edge and run your first LLM security scan.

## Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org)
- **LLM Access** - API key or Ollama for local models
- **Docker** (optional) - only needed for Temporal orchestration mode

## Installation

### From npm (recommended)

```bash
npm install -g valyrian-edge
```

### From source (contributors)

```bash
git clone https://github.com/valyrian-security/valyrian-edge.git
cd valyrian-edge
npm install
npm run build
```

## Configure LLM Provider

### Option 1: Ollama (Free, Local)

```bash
# Install Ollama from https://ollama.ai
ollama pull llama3.2:latest

# Set environment
export VALYRIAN_LLM_PROVIDER=ollama
export OLLAMA_MODEL=llama3.2:latest
```

### Option 2: Anthropic Claude

```bash
export VALYRIAN_LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### Option 3: OpenAI

```bash
export VALYRIAN_LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx
```

## Start Temporal

```bash
# Start Temporal (background)
docker compose up -d

# Verify it's running
docker compose ps
```

## Create Target Configuration

Create `my-target.yaml`:

```yaml
target:
  id: "my-chatbot"
  name: "My Chatbot"
  baseUrl: "https://chatbot.example.com"
  endpoints:
    chat: "/api/chat"

scope:
  vulnerabilities:
    - "prompt_injection"
    - "data_exfiltration"
  depth: "standard"
```

## Run Your First Scan

```bash
npx valyrian start -c my-target.yaml
```

## View Results

```bash
# Check logs
npx valyrian logs -s <session-id>

# Generate report
npx valyrian report -s <session-id> -f markdown
```

## Running Without Temporal (Direct Mode)

If you don't want to run Docker/Temporal, use the SDK's `DirectRunner` which executes everything in-process:

```typescript
import { ValyrianEdge } from 'valyrian-edge';

const valyrian = new ValyrianEdge({ mode: 'direct' });
const report = await valyrian.scanAndWait({
    target: { id: 'bot', name: 'My Bot', baseUrl: 'https://chatbot.example.com', endpoints: { chat: '/api/chat' } },
    llm: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', apiKey: process.env.ANTHROPIC_API_KEY },
    vulnerabilities: ['LLM01_PROMPT_INJECTION'],
});
```

## Monitoring Scans with the Dashboard

```bash
npx valyrian dashboard --port 3000 --output ./scan-output
```

Open `http://localhost:3000` to watch running scans in real time.

## Next Steps

- [Configuration Guide](configuration.md) - All config options
- [Agent Reference](agents.md) - What each agent tests
- [SDK Reference](sdk.md) - Programmatic API
- [Dashboard](dashboard.md) - Real-time monitoring
- [GitHub Action / CI-CD](github-action.md) - SARIF integration
- [Plugin System](plugins.md) - Community templates
