# Valyrian Edge

<div align="center">

![Valyrian Edge Logo](docs/assets/logo.svg)

**Autonomous AI Penetration Testing Platform for LLM-powered Applications**

⚔️ *Sharp as Valyrian Steel — Find LLM Vulnerabilities Before Attackers Do*

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-49%20Passing-brightgreen.svg)](#testing)
[![OWASP LLM Top 10](https://img.shields.io/badge/OWASP-LLM%20Top%2010-orange.svg)](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

[Documentation](docs/) · [Quick Start](#quick-start) · [Contributing](CONTRIBUTING.md) · [Report Bug](https://github.com/valyrian-security/valyrian-edge/issues)

</div>

---

## 🔥 Why Valyrian Edge?

LLM-powered applications are everywhere — customer support bots, RAG systems, coding assistants, AI agents. But traditional security tools can't find LLM-specific vulnerabilities like **prompt injection**, **jailbreaks**, or **data exfiltration**.

**Valyrian Edge** is purpose-built to:
- 🎯 **Discover** LLM vulnerabilities automatically using AI-powered reconnaissance
- 💥 **Exploit** findings with proof-of-concept attacks that demonstrate real impact
- 📊 **Report** with zero false positives — every finding is verified exploitable
- 🔒 **Secure** your AI applications before attackers find the flaws

---

## ✅ Complete OWASP LLM Top 10 Coverage

| ID | Vulnerability | Agent | Status |
|----|---------------|-------|--------|
| LLM01 | Prompt Injection | `PromptInjectionAgent` | ✅ |
| LLM02 | Insecure Output Handling | `InsecureOutputAgent` | ✅ |
| LLM03 | Training Data Poisoning | `RAGPoisoningAgent` | ✅ |
| LLM04 | Model Denial of Service | `DoSAgent` | ✅ |
| LLM05 | Supply Chain Vulnerabilities | `SupplyChainAgent` | ✅ |
| LLM06 | Sensitive Information Disclosure | `DataExfiltrationAgent` | ✅ |
| LLM07 | Insecure Plugin Design | `ToolAbuseAgent` | ✅ |
| LLM08 | Excessive Agency | `ExcessiveAgencyAgent` | ✅ |
| LLM09 | Overreliance | `OverrelianceAgent` | ✅ |
| LLM10 | Model Theft | `ModelTheftAgent` | ✅ |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** 
- **Docker & Docker Compose** (for Temporal)
- **LLM API Key** — Anthropic, OpenAI, or free with Ollama

### Installation

```bash
# Clone the repository
git clone https://github.com/valyrian-security/valyrian-edge.git
cd valyrian-edge

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Build the project
npm run build

# Start Temporal (workflow orchestration)
docker compose up -d
```

### Run Your First Scan

**Option 1: Free with Ollama (Local LLM)**
```bash
# Install Ollama from https://ollama.ai
ollama pull llama3.2:latest

export VALYRIAN_LLM_PROVIDER=ollama
export OLLAMA_MODEL=llama3.2:latest

npx valyrian start -c configs/example-config.yaml
```

**Option 2: With Anthropic Claude**
```bash
export VALYRIAN_LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here

npx valyrian start -c configs/example-config.yaml
```

**Option 3: With OpenAI**
```bash
export VALYRIAN_LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-your-key-here

npx valyrian start -c configs/example-config.yaml
```

---

## 📖 Configuration

Create a YAML configuration file for your target:

```yaml
# config.yaml
target:
  id: "my-chatbot"
  name: "Customer Support Bot"
  baseUrl: "https://chatbot.example.com"
  architecture: "rag"  # rag | agent | fine-tuned | vanilla
  endpoints:
    chat: "/api/chat"
    upload: "/api/documents"

scope:
  vulnerabilities:
    - "prompt_injection"
    - "data_exfiltration"
    - "tool_abuse"
    - "insecure_output"
  depth: "thorough"           # quick | standard | thorough
  enableExploitation: true
  generatePoC: true

llm:
  provider: "anthropic"       # anthropic | openai | ollama
  model: "claude-sonnet-4-20250514"

report:
  format: "markdown"          # markdown | html | json | sarif
  includeRemediation: true
  redactSensitive: true
```

See [`configs/example-config.yaml`](configs/example-config.yaml) for complete options.

---

## 💻 CLI Commands

```bash
# Start a penetration test
valyrian start -c config.yaml

# Resume a session
valyrian resume -s <session-id>

# View session logs
valyrian logs -s <session-id>

# Generate report after scan
valyrian report -s <session-id> -f html

# Validate configuration
valyrian config validate config.yaml

# Show current environment
valyrian config show
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Valyrian Edge CLI                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Temporal Orchestrator                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │  Recon Flow  │→│ Analysis Flow│→│  Exploitation + Report   │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Security Agents (10)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Prompt  │ │  Tool   │ │  Data   │ │   DoS   │ │ Output  │   │
│  │Injection│ │  Abuse  │ │ Exfil   │ │         │ │ Handler │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Excessive│ │ Supply  │ │  Over-  │ │  Model  │ │   RAG   │   │
│  │ Agency  │ │  Chain  │ │ reliance│ │  Theft  │ │Poisoning│   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 LLM Providers + HTTP/Browser Tools               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Anthropic│ │  OpenAI  │ │  Ollama  │ │ Playwright Browser │  │
│  │  Claude  │ │  GPT-4o  │ │ (Local)  │ │    Automation      │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
valyrian-edge/
├── src/
│   ├── agents/              # 10 Security testing agents
│   │   ├── base_agent.ts    # Abstract base class
│   │   ├── prompt_injection_agent.ts
│   │   ├── tool_abuse_agent.ts
│   │   ├── data_exfiltration_agent.ts
│   │   └── ...
│   ├── cli/                 # Command-line interface
│   ├── config/              # Configuration loader
│   ├── tools/               # HTTP client, browser automation
│   ├── report/              # Report generator
│   ├── types/               # TypeScript definitions
│   └── utils/               # Logger, sanitizer
├── tests/                   # Unit & integration tests
├── configs/                 # Example configurations
├── prompts/                 # Agent system prompts
├── docs/                    # Documentation
└── docker-compose.yml       # Temporal orchestration
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/agents/prompt_injection.test.ts
```

**Current Status:** 49 tests passing across 7 test suites.

---

## 🛡️ Security & Ethics

> ⚠️ **IMPORTANT**: Valyrian Edge is designed for **authorized security testing only**.

- ✅ Always obtain **written permission** before testing
- ✅ Use only on systems **you own** or are **authorized to test**
- ✅ Follow **responsible disclosure** practices
- ❌ Do **NOT** use for malicious purposes
- ❌ Do **NOT** test production systems without approval

Misuse of this tool may violate laws and regulations. The authors are not responsible for any misuse or damage caused by this software.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone and install
git clone https://github.com/valyrian-security/valyrian-edge.git
cd valyrian-edge
npm install

# Run in development mode
npm run dev

# Run linter
npm run lint

# Type checking
npm run typecheck
```

---

## 📄 License

This project is licensed under **AGPL-3.0** — see [LICENSE](LICENSE) for details.

**Why AGPL?** We believe security tools should be open and auditable. The AGPL ensures that improvements to Valyrian Edge remain open source, even when deployed as a service.

---

## 🌟 Star History

If you find Valyrian Edge useful, please ⭐ star the repository!

---

## 📞 Support

- 📚 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/valyrian-security/valyrian-edge/issues)
- 💬 [Discussions](https://github.com/valyrian-security/valyrian-edge/discussions)
- 🐦 [Twitter/X](https://twitter.com/valyrian_edge)

---

<div align="center">

**Built with ❤️ for the security community**

*Find LLM vulnerabilities before attackers do.*

</div>
