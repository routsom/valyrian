# Changelog

All notable changes to Valyrian Edge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-09

### 🎉 Initial Release

**Valyrian Edge** — Autonomous AI Penetration Testing Platform for LLM-powered Applications

### Added

#### Security Agents (Full OWASP LLM Top 10)
- **PromptInjectionAgent** (LLM01) - Jailbreaks, delimiter confusion, role-playing attacks
- **InsecureOutputAgent** (LLM02) - XSS, SQL injection, command injection, SSTI detection
- **RAGPoisoningAgent** (LLM03) - Document injection, hidden instructions, retrieval exploitation
- **DoSAgent** (LLM04) - Token length attacks, rate limiting, resource exhaustion
- **SupplyChainAgent** (LLM05) - Model provenance, plugin security, dependency risks
- **DataExfiltrationAgent** (LLM06) - System prompt extraction, PII disclosure, credential leaks
- **ToolAbuseAgent** (LLM07) - SSRF, command injection, path traversal, API abuse
- **ExcessiveAgencyAgent** (LLM08) - Permission boundaries, autonomous actions, human-in-loop bypass
- **OverrelianceAgent** (LLM09) - Hallucination detection, factual accuracy, uncertainty handling
- **ModelTheftAgent** (LLM10) - Architecture extraction, training data probing, system prompt theft

#### Infrastructure
- **CLI** with commands: `start`, `logs`, `report`, `config`
- **Temporal Workflows** for orchestrated multi-agent coordination
- **HTTP Client** with session management, cookie handling, rate limiting
- **Browser Automation** via Playwright for web UI testing
- **Report Generator** supporting Markdown, HTML, JSON, and SARIF formats

#### LLM Providers
- Anthropic Claude (claude-sonnet-4-20250514, claude-3-haiku)
- OpenAI (gpt-4o, gpt-4o-mini)
- Ollama (local models - llama3.2, mistral, etc.)

#### Developer Experience
- TypeScript with strict mode
- 49 unit tests with Vitest
- Docker Compose for local development
- Comprehensive configuration system

### Security

- AGPL-3.0 license with security testing disclaimer
- Built-in sensitive data redaction in reports
- Audit logging for all operations

---

## [Unreleased]

### Planned
- Web dashboard for report viewing
- CI/CD pipeline integration
- Additional attack payloads
- Plugin system for custom agents
