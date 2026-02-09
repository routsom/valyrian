# Contributing to Valyrian Edge

Thank you for your interest in contributing to Valyrian Edge! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Adding New Agents](#adding-new-agents)

---

## 📜 Code of Conduct

This project follows a Code of Conduct that all contributors are expected to uphold:

- Be respectful and inclusive
- Focus on constructive feedback
- Report security vulnerabilities responsibly
- Remember this tool is for **authorized testing only**

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/valyrian-edge.git
cd valyrian-edge

# Add upstream remote
git remote add upstream https://github.com/valyrian-security/valyrian-edge.git
```

---

## 💻 Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development mode (with watch)
npm run dev
```

### Environment Setup

```bash
# Copy example environment
cp .env.example .env

# For local testing with Ollama (free, no API key needed)
export VALYRIAN_LLM_PROVIDER=ollama
ollama pull llama3.2:latest
```

---

## 🔧 Making Changes

### Branch Naming

Use descriptive branch names:

```
feature/add-new-vulnerability-check
fix/prompt-injection-bypass
docs/improve-configuration-guide
```

### Commit Messages

Follow conventional commits:

```
feat: add support for OpenAI o1 models
fix: resolve rate limiting in HTTP client
docs: update installation instructions
test: add unit tests for DoS agent
refactor: simplify base agent implementation
```

---

## 📤 Pull Request Process

1. **Update tests** — All new code should have tests
2. **Run the test suite** — `npm test` must pass
3. **Run linting** — `npm run lint` must pass
4. **Update documentation** — If you changed behavior, update docs
5. **Fill out PR template** — Describe what and why

### PR Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions

---

## 📏 Coding Standards

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use interfaces for complex objects
- Export types from dedicated files

### File Structure

```typescript
/**
 * Valyrian Edge - [Component Name]
 * [Brief description]
 */

import { ... } from '...';  // External imports first
import { ... } from '../...';  // Internal imports second

// =============================================================================
// TYPES
// =============================================================================

interface MyType { ... }

// =============================================================================
// MAIN CLASS/FUNCTION
// =============================================================================

export class MyClass { ... }
```

### Error Handling

```typescript
// Always use typed errors
try {
  await riskyOperation();
} catch (error) {
  this.logger.error('Operation failed', { error });
  throw error;  // Re-throw or handle appropriately
}
```

---

## 🤖 Adding New Agents

### 1. Create Agent File

```typescript
// src/agents/my_new_agent.ts
import { BaseAgent } from './base_agent.js';
import type { AnalysisOutput, AttackVector, VulnerabilityAnalysis } from '../types/index.js';

export interface MyNewInput {
  targetUrl: string;
}

export class MyNewAgent extends BaseAgent<MyNewInput, AnalysisOutput> {
  readonly name = 'MyNewAgent';
  readonly description = 'Tests for [vulnerability type]';

  private attackVectors: AttackVector[] = [];

  protected override async loadSystemPrompt(): Promise<string> {
    return 'You are analyzing...';
  }

  async execute(input: MyNewInput): Promise<AnalysisOutput> {
    this.setStatus('running');
    this.updateProgress(0, 'Starting analysis');

    try {
      // Implement your tests here
      await this.testVulnerability();

      this.setStatus('completed');
      return this.generateOutput();
    } catch (error) {
      this.setStatus('failed');
      throw error;
    }
  }

  private async testVulnerability(): Promise<void> {
    const response = await this.sendMessage('Test prompt');
    // Analyze response...
  }

  private generateOutput(): AnalysisOutput {
    // Return structured output
  }
}
```

### 2. Export from Index

```typescript
// src/agents/index.ts
export { MyNewAgent } from './my_new_agent.js';
```

### 3. Add Attack Techniques

```typescript
// src/types/vulnerability.types.ts
export type AttackTechnique =
  // ...existing...
  | 'my_new_technique'
  | 'another_technique';
```

### 4. Write Tests

```typescript
// tests/agents/my_new.test.ts
import { describe, it, expect } from 'vitest';

describe('MyNewAgent', () => {
  it('should detect vulnerability', () => {
    // Test implementation
  });
});
```

---

## 🧪 Testing Guidelines

- Write unit tests for all new functionality
- Use mock clients for LLM interactions
- Test edge cases and error conditions
- Aim for meaningful coverage, not just line coverage

```bash
# Run tests with coverage
npm run test:coverage

# Run specific test
npm test -- tests/agents/my_new.test.ts
```

---

## 📚 Documentation

When adding features, update:

1. **README.md** — If user-facing
2. **docs/** — For detailed explanations
3. **JSDoc comments** — For API documentation
4. **CHANGELOG.md** — For release notes

---

## ❓ Questions?

- Open a [Discussion](https://github.com/valyrian-security/valyrian-edge/discussions)
- Check existing [Issues](https://github.com/valyrian-security/valyrian-edge/issues)

Thank you for contributing to Valyrian Edge! 🙏
