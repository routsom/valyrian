/**
 * Valyrian Edge - GitHub Action Entry Point
 * Reads INPUT_* env vars set by the Actions runner, runs a scan via the SDK
 * DirectRunner (no Temporal needed in CI), writes a SARIF file, and sets
 * GitHub Actions outputs.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ValyrianEdge } from '../sdk/index.js';
import { createReportGenerator } from '../reporting/generator.js';
import type { VulnerabilityType, LLMProvider, SecurityReport } from '../types/index.js';
import type { ScanOptions } from '../sdk/types.js';

// ---------------------------------------------------------------------------
// GitHub Actions helpers
// ---------------------------------------------------------------------------

function getInput(name: string, defaultVal = ''): string {
    return process.env[`INPUT_${name.toUpperCase()}`]?.trim() ?? defaultVal;
}

function setOutput(name: string, value: string): void {
    process.stdout.write(`::set-output name=${name}::${value}\n`);
    const outputFile = process.env['GITHUB_OUTPUT'];
    if (outputFile) {
        const delimiter = `ghadelimiter_${Date.now()}`;
        writeFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, { flag: 'a' });
    }
}

function setFailed(message: string): void {
    process.stderr.write(`::error::${message}\n`);
    process.exit(1);
}

function info(message: string): void {
    process.stdout.write(`\u001b[36m[valyrian]\u001b[0m ${message}\n`);
}

// ---------------------------------------------------------------------------
// Severity comparison
// ---------------------------------------------------------------------------

const SEVERITY_ORDER = ['info', 'low', 'medium', 'high', 'critical'] as const;
type SeverityLevel = typeof SEVERITY_ORDER[number];

function severityAtLeast(found: string, threshold: string): boolean {
    const a = SEVERITY_ORDER.indexOf(found as SeverityLevel);
    const b = SEVERITY_ORDER.indexOf(threshold as SeverityLevel);
    if (b === -1) return false;
    return a >= b;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
    const targetUrl = getInput('target_url');
    const targetName = getInput('target_name', 'Target');
    const vulnInput = getInput('vulnerabilities', 'LLM01_PROMPT_INJECTION');
    const llmProvider = getInput('llm_provider', 'anthropic') as LLMProvider;
    const llmModel = getInput('llm_model', 'claude-haiku-4-5-20251001');
    const anthropicKey = getInput('anthropic_api_key') || process.env['ANTHROPIC_API_KEY'] || '';
    const openaiKey = getInput('openai_api_key') || process.env['OPENAI_API_KEY'] || '';
    const outputDir = resolve(getInput('output_dir', 'valyrian-results'));
    const failOnSeverity = getInput('fail_on_severity', 'high');
    const timeoutSec = parseInt(getInput('timeout', '300'), 10);

    if (!targetUrl) {
        setFailed('input target_url is required');
        return;
    }

    const vulnerabilities = vulnInput
        .split(',')
        .map(v => v.trim())
        .filter(Boolean) as VulnerabilityType[];

    const apiKey = llmProvider === 'openai' ? openaiKey : anthropicKey;

    const scanOptions: ScanOptions = {
        target: {
            id: 'ci-target',
            name: targetName,
            baseUrl: targetUrl,
            endpoints: { chat: '/api/chat' },
        },
        llm: {
            provider: llmProvider,
            model: llmModel,
            temperature: 0.1,
            maxTokens: 2048,
            apiKey: apiKey || undefined,
        },
        vulnerabilities,
        enableExploitation: false,
        timeoutMs: timeoutSec * 1000,
    };

    info(`Starting scan of ${targetUrl}`);
    info(`Vulnerabilities: ${vulnerabilities.join(', ')}`);
    info(`Timeout: ${timeoutSec}s`);

    mkdirSync(outputDir, { recursive: true });

    const valyrian = new ValyrianEdge({ mode: 'direct' });
    let report: SecurityReport;

    try {
        report = await valyrian.scanAndWait(scanOptions);
    } catch (err) {
        setFailed(`Scan failed: ${err}`);
        return;
    }

    const sarifPath = join(outputDir, 'results.sarif');
    const generator = createReportGenerator(report, {
        format: 'sarif',
        outputPath: sarifPath,
        includePOC: false,
        redactSensitive: true,
    });
    await generator.generate();
    info(`SARIF written to ${sarifPath}`);

    const findingCount = report.findings.length;
    const criticalCount = report.executiveSummary.criticalCount;
    const highCount = report.executiveSummary.highCount;

    setOutput('sarif_file', sarifPath);
    setOutput('finding_count', String(findingCount));
    setOutput('critical_count', String(criticalCount));
    setOutput('high_count', String(highCount));

    info(`Findings: ${findingCount} total (${criticalCount} critical, ${highCount} high)`);

    if (failOnSeverity !== 'never') {
        const worstFinding = report.findings.find(f =>
            severityAtLeast(f.severity, failOnSeverity),
        );
        if (worstFinding) {
            setFailed(
                `Found ${findingCount} finding(s) — severity threshold '${failOnSeverity}' exceeded. ` +
                `See ${sarifPath} for details.`,
            );
        }
    }

    info('Scan complete.');
}

run().catch(err => setFailed(String(err)));
