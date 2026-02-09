# Agent Reference

Valyrian Edge includes 10 security agents covering the complete OWASP LLM Top 10.

## Agent Overview

| Agent | OWASP | Purpose |
|-------|-------|---------|
| [PromptInjectionAgent](#promptinjectionagent) | LLM01 | Jailbreaks and bypasses |
| [InsecureOutputAgent](#insecureoutputagent) | LLM02 | XSS, SQLi, SSTI |
| [RAGPoisoningAgent](#ragpoisoningagent) | LLM03 | Document injection |
| [DoSAgent](#dosagent) | LLM04 | Resource exhaustion |
| [SupplyChainAgent](#supplychainagent) | LLM05 | Model provenance |
| [DataExfiltrationAgent](#dataexfiltrationagent) | LLM06 | Sensitive data disclosure |
| [ToolAbuseAgent](#toolabuseagent) | LLM07 | SSRF, command injection |
| [ExcessiveAgencyAgent](#excessiveagencyagent) | LLM08 | Permission bypass |
| [OverrelianceAgent](#overrelianceagent) | LLM09 | Hallucination detection |
| [ModelTheftAgent](#modeltheftagent) | LLM10 | System prompt extraction |

---

## PromptInjectionAgent

**OWASP LLM01: Prompt Injection**

Tests for direct and indirect prompt injection vulnerabilities.

### Techniques
- Basic jailbreaks ("Ignore previous instructions")
- Delimiter confusion
- Role-playing attacks
- Translation attacks
- Encoding attacks (Base64, ROT13)
- Multi-turn manipulation

---

## InsecureOutputAgent

**OWASP LLM02: Insecure Output Handling**

Tests whether LLM outputs can cause downstream vulnerabilities.

### Techniques
- XSS passthrough detection
- SQL injection in outputs
- Command injection patterns
- Server-Side Template Injection (SSTI)

---

## RAGPoisoningAgent

**OWASP LLM03: Training Data Poisoning**

Tests RAG systems for document injection vulnerabilities.

### Techniques
- Hidden instruction injection in documents
- Semantic search exploitation
- Citation manipulation
- Context manipulation

---

## DoSAgent

**OWASP LLM04: Model Denial of Service**

Tests for resource exhaustion vulnerabilities.

### Techniques
- Token length attacks
- Expensive computation triggers
- Recursive prompt patterns
- Rate limit bypass

---

## SupplyChainAgent

**OWASP LLM05: Supply Chain Vulnerabilities**

Probes for supply chain security issues.

### Techniques
- Model origin probing
- Version fingerprinting
- Plugin enumeration
- Training data provenance checks

---

## DataExfiltrationAgent

**OWASP LLM06: Sensitive Information Disclosure**

Tests for data leakage vulnerabilities.

### Techniques
- System prompt extraction
- PII discovery
- Credential disclosure
- Training data leakage

---

## ToolAbuseAgent

**OWASP LLM07: Insecure Plugin Design**

Tests for tool/plugin abuse vulnerabilities.

### Techniques
- SSRF (Server-Side Request Forgery)
- Command injection
- SQL injection
- Path traversal

---

## ExcessiveAgencyAgent

**OWASP LLM08: Excessive Agency**

Tests for permission boundary issues.

### Techniques
- Permission boundary testing
- Autonomous action attempts
- Human-in-loop bypass

---

## OverrelianceAgent

**OWASP LLM09: Overreliance**

Tests for hallucination and accuracy issues.

### Techniques
- Fictional entity tests
- Fake citation detection
- Confidence probing
- Uncertainty handling

---

## ModelTheftAgent

**OWASP LLM10: Model Theft**

Tests for model extraction vulnerabilities.

### Techniques
- Architecture disclosure attempts
- System prompt injection
- Training data extraction
- Replication guidance detection
