# Getting Started

This guide will help you set up Valyrian Edge and run your first LLM security scan.

## Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org)
- **Docker** - [Download](https://docker.com) (for Temporal)
- **LLM Access** - API key or Ollama for local models

## Installation

```bash
# Clone the repository
git clone https://github.com/valyrian-security/valyrian-edge.git
cd valyrian-edge

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Build
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

## Next Steps

- [Configuration Guide](configuration.md) - All config options
- [Agent Reference](agents.md) - What each agent tests
- [Examples](examples/) - Real-world configurations
