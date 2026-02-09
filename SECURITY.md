# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Active support  |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Valyrian Edge itself (not vulnerabilities found *using* Valyrian Edge), please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email: **security@valyrian-security.io**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **24 hours**: Initial acknowledgment
- **72 hours**: Preliminary assessment
- **7 days**: Detailed response with remediation plan
- **90 days**: Public disclosure (coordinated)

### Scope

**In scope:**
- Code execution vulnerabilities in Valyrian Edge
- Authentication/authorization bypasses
- Information disclosure from Valyrian Edge itself
- Dependency vulnerabilities

**Out of scope:**
- Vulnerabilities in target systems (that's the point of the tool!)
- Social engineering
- Physical security
- Issues requiring physical access

## Responsible Use

⚠️ **IMPORTANT**: Valyrian Edge is designed for **authorized security testing only**.

By using this software, you agree to:

1. Only test systems you own or have explicit written authorization to test
2. Comply with all applicable laws and regulations
3. Follow responsible disclosure for any vulnerabilities discovered
4. Not use this tool for malicious purposes

Misuse of this tool may violate computer crime laws. The authors are not responsible for any misuse or damage caused by this software.

## Security Best Practices

When using Valyrian Edge:

1. **Protect API keys** — Never commit `.env` files
2. **Use isolated networks** — Test in dev/staging, not production
3. **Review reports** — Redact sensitive data before sharing
4. **Keep updated** — Run `npm update` regularly
5. **Audit configs** — Don't expose credentials in config files
