# GitHub Action / CI-CD Integration

Valyrian Edge ships as a GitHub Action so you can run LLM security scans in any CI/CD pipeline and upload findings to GitHub's Security tab as SARIF.

## Basic Usage

```yaml
# .github/workflows/llm-security.yml
name: LLM Security Scan

on:
  push:
    branches: [main]
  pull_request:

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write   # required for SARIF upload

    steps:
      - uses: actions/checkout@v4

      - name: Run Valyrian Edge
        uses: valyrian-security/valyrian-edge@v1
        with:
          target_url: https://chatbot.example.com
          vulnerabilities: LLM01_PROMPT_INJECTION,LLM06_SENSITIVE_INFO_DISCLOSURE
          llm_provider: anthropic
          llm_model: claude-haiku-4-5-20251001
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          fail_on_severity: high

      - name: Upload SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: valyrian-results.sarif
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `target_url` | Yes | — | Base URL of the target LLM application |
| `vulnerabilities` | No | all | Comma-separated `VulnerabilityType` values |
| `llm_provider` | No | `anthropic` | `anthropic`, `openai`, or `ollama` |
| `llm_model` | No | `claude-haiku-4-5-20251001` | Model identifier |
| `anthropic_api_key` | No | — | Anthropic API key (use a secret) |
| `openai_api_key` | No | — | OpenAI API key (use a secret) |
| `output_dir` | No | `valyrian-output` | Directory to write scan artefacts |
| `fail_on_severity` | No | `critical` | Exit 1 if any finding meets or exceeds this severity (`info`, `low`, `medium`, `high`, `critical`) |
| `timeout` | No | `300` | Scan timeout in seconds |

## Outputs

| Output | Description |
|--------|-------------|
| `sarif_file` | Path to the generated SARIF 2.1.0 file |
| `finding_count` | Total number of findings |
| `critical_count` | Number of critical-severity findings |
| `high_count` | Number of high-severity findings |

### Reading outputs in subsequent steps

```yaml
- name: Run Valyrian Edge
  id: scan
  uses: valyrian-security/valyrian-edge@v1
  with:
    target_url: https://chatbot.example.com
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

- name: Print finding counts
  run: |
    echo "Total: ${{ steps.scan.outputs.finding_count }}"
    echo "Critical: ${{ steps.scan.outputs.critical_count }}"
```

## SARIF Output

The action writes a [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) file to `<output_dir>/report.sarif` (also written to `valyrian-results.sarif` for the upload step).

SARIF findings map to GitHub Code Scanning alerts:

| Valyrian severity | SARIF level | GitHub alert level |
|-------------------|-------------|-------------------|
| `critical` | `error` | Error |
| `high` | `error` | Error |
| `medium` | `warning` | Warning |
| `low` | `note` | Note |
| `info` | `note` | Note |

## Fail Thresholds

Set `fail_on_severity` to control when the action exits with code 1:

```yaml
fail_on_severity: medium   # fail if any medium, high, or critical finding
fail_on_severity: critical # only fail on critical findings (default)
```

## Permissions

The job needs `security-events: write` to upload SARIF results:

```yaml
permissions:
  security-events: write
  contents: read
```

## Running Without Temporal

The GitHub Action uses `DirectRunner` (in-process, no Docker/Temporal required), making it suitable for ephemeral CI runners with no external dependencies beyond an LLM API key.
