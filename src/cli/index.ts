#!/usr/bin/env node
/**
 * Valyrian Edge - CLI Entry Point
 * Autonomous AI Penetration Testing Platform
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createPentestConfig, getAppConfigFromEnv } from '../config/index.js';
import { createPentestClient } from '../orchestrator/client.js';
import { createReportGenerator } from '../reporting/generator.js';
import type { SecurityReport } from '../types/index.js';
import { cliLogger } from '../utils/logger.js';
import {
    mapVulnerabilitiesToOWASP,
    saveSessionMetadata,
    loadSessionMetadata,
    withTimeout,
} from './helpers.js';

export {
    mapVulnerabilitiesToOWASP,
    saveSessionMetadata,
    loadSessionMetadata,
    sessionMetadataPath,
    withTimeout,
} from './helpers.js';
export type { SessionMetadata } from './helpers.js';

// =============================================================================
// ASCII BANNER
// =============================================================================

const BANNER = `
${chalk.red('╔═══════════════════════════════════════════════════════════════════╗')}
${chalk.red('║')}  ${chalk.bold.white('⚔️  VALYRIAN EDGE')}                                              ${chalk.red('║')}
${chalk.red('║')}  ${chalk.gray('Autonomous AI Penetration Testing Platform')}                      ${chalk.red('║')}
${chalk.red('║')}  ${chalk.gray('Version 1.0.0')}                                                    ${chalk.red('║')}
${chalk.red('╚═══════════════════════════════════════════════════════════════════╝')}
`;

const LEGAL_NOTICE = `
${chalk.yellow('⚠️  LEGAL NOTICE ⚠️')}

${chalk.gray('Valyrian Edge is designed for authorized security testing only.')}

${chalk.gray('By using this tool, you agree that:')}
${chalk.gray('1. You have explicit written permission from the chatbot owner')}
${chalk.gray('2. You will not use this tool for malicious purposes')}
${chalk.gray('3. You understand that unauthorized testing may violate laws')}

${chalk.gray('The developers are not responsible for any misuse.')}
`;

// =============================================================================
// VERSION
// =============================================================================

function getVersion(): string {
    try {
        const packagePath = resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
        return pkg.version ?? '1.0.0';
    } catch {
        return '1.0.0';
    }
}

// =============================================================================
// MAIN PROGRAM
// =============================================================================

const program = new Command();

program
    .name('valyrian')
    .description('Autonomous AI Penetration Testing Platform for LLM-powered applications')
    .version(getVersion())
    .hook('preAction', () => {
        console.log(BANNER);
    });

// =============================================================================
// START COMMAND
// =============================================================================

program
    .command('start')
    .description('Start a new penetration test against a target chatbot')
    .requiredOption('-c, --config <path>', 'Path to configuration YAML file')
    .option('-t, --target <url>', 'Target chatbot URL (overrides config)')
    .option('-o, --output <dir>', 'Output directory for reports', './audit-logs')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('--dry-run', 'Validate configuration without running tests', false)
    .option('--skip-disclaimer', 'Skip legal disclaimer (for CI/CD)', false)
    .action(async (options) => {
        try {
            if (!options.skipDisclaimer) {
                console.log(LEGAL_NOTICE);
                console.log(chalk.yellow('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n'));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            const spinner = ora('Loading configuration...').start();

            const config = createPentestConfig(options.config, {
                outputDir: options.output,
                verbose: options.verbose,
            });

            if (options.target) {
                config.target.baseUrl = options.target;
            }

            spinner.succeed('Configuration loaded');

            if (options.dryRun) {
                console.log(chalk.cyan('\n📋 Pentest Configuration:'));
                console.log(chalk.gray(`   Target: ${config.target.name} (${config.target.baseUrl})`));
                console.log(chalk.gray(`   Vulnerabilities: ${config.scope.vulnerabilities.join(', ')}`));
                console.log(chalk.green('\n✅ Dry run complete. Configuration is valid.'));
                return;
            }

            spinner.start('Connecting to Temporal...');
            const client = await createPentestClient();

            const vulnTypes = mapVulnerabilitiesToOWASP(config.scope.vulnerabilities);

            spinner.text = 'Starting pentest workflow...';
            const sessionId = await client.startPentest({
                target: config.target,
                llmConfig: config.llm,
                scope: {
                    vulnerabilities: vulnTypes,
                    enableExploitation: config.scope.enableExploitation,
                    generateReport: true,
                },
            });

            await client.disconnect();

            saveSessionMetadata({
                sessionId,
                targetName: config.target.name,
                targetUrl: config.target.baseUrl,
                startedAt: new Date().toISOString(),
                outputDir: config.outputDir,
            });

            spinner.succeed('Pentest workflow started');

            cliLogger.info({ sessionId, target: config.target.baseUrl }, 'Pentest started');

            console.log(chalk.cyan(`\n🔍 Session ID: ${chalk.bold(sessionId)}`));
            console.log(chalk.gray(`   Target:          ${config.target.baseUrl}`));
            console.log(chalk.gray(`   Vulnerabilities: ${vulnTypes.join(', ')}`));
            console.log(chalk.gray(`\n   valyrian logs   -s ${sessionId}   — stream progress`));
            console.log(chalk.gray(`   valyrian report -s ${sessionId}   — generate report`));
            console.log(chalk.gray(`   valyrian resume -s ${sessionId}   — resume if paused`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${error}`));
            cliLogger.error({ error }, 'CLI start command failed');
            process.exit(1);
        }
    });

// =============================================================================
// RESUME COMMAND
// =============================================================================

program
    .command('resume')
    .description('Resume a paused penetration test')
    .requiredOption('-s, --session <id>', 'Session ID to resume')
    .option('-o, --output <dir>', 'Output directory (to locate session metadata)', './audit-logs')
    .action(async (options) => {
        try {
            const spinner = ora(`Resuming session ${options.session}...`).start();

            const client = await createPentestClient();
            await client.resumePentest(options.session);
            await client.disconnect();

            spinner.succeed('Pentest resumed');

            const meta = loadSessionMetadata(options.output, options.session);
            console.log(chalk.cyan(`\n▶️  Session ${options.session} resumed`));
            if (meta) {
                console.log(chalk.gray(`   Target:  ${meta.targetUrl}`));
                console.log(chalk.gray(`   Started: ${meta.startedAt}`));
            }
            console.log(chalk.gray(`\n   valyrian logs -s ${options.session}   — monitor progress`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${error}`));
            cliLogger.error({ error, sessionId: options.session }, 'CLI resume command failed');
            process.exit(1);
        }
    });

// =============================================================================
// LOGS COMMAND
// =============================================================================

program
    .command('logs')
    .description('View status and findings for a pentest session')
    .requiredOption('-s, --session <id>', 'Session ID')
    .option('-o, --output <dir>', 'Output directory (to locate session metadata)', './audit-logs')
    .option('-f, --follow', 'Poll status every 10 seconds until completed', false)
    .action(async (options) => {
        try {
            const meta = loadSessionMetadata(options.output, options.session);

            console.log(chalk.cyan(`\n📜 Session: ${options.session}`));
            if (meta) {
                console.log(chalk.gray(`   Target:  ${meta.targetUrl}`));
                console.log(chalk.gray(`   Started: ${meta.startedAt}`));
            }

            const printStatus = async (): Promise<boolean> => {
                const client = await createPentestClient();
                try {
                    const [status, findings] = await Promise.all([
                        client.getStatus(options.session),
                        client.getFindings(options.session),
                    ]);
                    await client.disconnect();

                    console.log(chalk.cyan(`\n   Phase:    ${chalk.bold(status.phase)}`));
                    console.log(chalk.gray(`   Progress: ${status.progress}%`));
                    if (status.currentActivity) {
                        console.log(chalk.gray(`   Current:  ${status.currentActivity}`));
                    }
                    if (status.error) {
                        console.log(chalk.red(`   Error:    ${status.error}`));
                    }

                    if (findings.length > 0) {
                        console.log(chalk.cyan('\n   Findings so far:'));
                        for (const f of findings) {
                            const color =
                                f.severity === 'critical' ? chalk.red
                                    : f.severity === 'high' ? chalk.yellow
                                        : chalk.gray;
                            console.log(color(`     [${f.severity.toUpperCase()}] ${f.type} — ${f.count} finding(s)`));
                        }
                    }

                    const terminal = status.phase === 'completed'
                        || status.phase === 'failed'
                        || status.phase === 'cancelled';
                    return terminal;
                } catch (err) {
                    await client.disconnect();
                    throw err;
                }
            };

            const done = await printStatus();

            if (options.follow && !done) {
                console.log(chalk.gray('\n   Following (Ctrl+C to stop)...'));
                const interval = setInterval(async () => {
                    try {
                        const finished = await printStatus();
                        if (finished) {
                            clearInterval(interval);
                            console.log(chalk.green('\n✅ Session complete.'));
                            process.exit(0);
                        }
                    } catch (err) {
                        clearInterval(interval);
                        console.error(chalk.red(`\n❌ Error polling status: ${err}`));
                        process.exit(1);
                    }
                }, 10_000);

                // Clean shutdown on Ctrl+C — clear the interval so Node can exit
                process.once('SIGINT', () => {
                    clearInterval(interval);
                    console.log(chalk.gray('\n\n   Stopped following.'));
                    process.exit(0);
                });
            }

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${error}`));
            cliLogger.error({ error, sessionId: options.session }, 'CLI logs command failed');
            process.exit(1);
        }
    });

// =============================================================================
// REPORT COMMAND
// =============================================================================

program
    .command('report')
    .description('Generate a security assessment report')
    .requiredOption('-s, --session <id>', 'Session ID')
    .option('-f, --format <format>', 'Output format: markdown, html, json, sarif', 'markdown')
    .option('-o, --output-dir <dir>', 'Output directory', './audit-logs')
    .option('--no-poc', 'Exclude PoC scripts from report')
    .option('--redact', 'Redact sensitive data', false)
    .option('--timeout <seconds>', 'Seconds to wait for workflow completion', '600')
    .action(async (options) => {
        const spinner = ora('Connecting to Temporal...').start();
        try {
            const client = await createPentestClient();
            const timeoutMs = Math.max(1, parseInt(options.timeout, 10)) * 1000;

            spinner.text = `Fetching workflow result (timeout: ${options.timeout}s)...`;
            const result = await withTimeout(
                client.waitForCompletion(options.session),
                timeoutMs,
                `Timed out after ${options.timeout}s — workflow may still be running. ` +
                'Use a larger --timeout or check status with `valyrian logs`.',
            ) as SecurityReport;
            await client.disconnect();

            if (!result) {
                spinner.fail('No result available — workflow may still be running');
                process.exit(1);
            }

            const ext = options.format === 'markdown' ? 'md' : options.format;
            const outputPath = join(options.outputDir, options.session, `report.${ext}`);

            spinner.text = 'Generating report...';
            const generator = createReportGenerator(result, {
                format: options.format as 'markdown' | 'html' | 'json' | 'sarif',
                outputPath,
                includePOC: options.poc !== false,
                redactSensitive: options.redact,
            });

            await generator.generate();
            spinner.succeed('Report generated');

            console.log(chalk.green(`\n📄 Report saved to: ${chalk.bold(outputPath)}`));
            console.log(chalk.gray(`   Format:  ${options.format}`));
            console.log(chalk.gray(`   Session: ${options.session}`));

            const summary = result.executiveSummary;
            console.log(chalk.cyan('\n   Summary:'));
            console.log(chalk.red(`     Critical: ${summary.criticalCount}`));
            console.log(chalk.yellow(`     High:     ${summary.highCount}`));
            console.log(chalk.gray(`     Medium:   ${summary.mediumCount}`));
            console.log(chalk.gray(`     Low:      ${summary.lowCount}`));

        } catch (error) {
            spinner.fail('Report generation failed');
            console.error(chalk.red(`\n❌ Error: ${error}`));
            cliLogger.error({ error, sessionId: options.session }, 'CLI report command failed');
            process.exit(1);
        }
    });

// =============================================================================
// CONFIG COMMAND
// =============================================================================

program
    .command('config')
    .description('Manage configuration')
    .addCommand(
        new Command('validate')
            .description('Validate a configuration file')
            .argument('<path>', 'Path to configuration file')
            .action(async (path) => {
                try {
                    const spinner = ora('Validating configuration...').start();
                    const config = createPentestConfig(path);
                    spinner.succeed('Configuration is valid');

                    console.log(chalk.cyan('\n📋 Configuration Summary:'));
                    console.log(chalk.gray(`   Target: ${config.target.name} (${config.target.baseUrl})`));
                    console.log(chalk.gray(`   Architecture: ${config.target.architecture ?? 'unknown'}`));
                    console.log(chalk.gray(`   Vulnerabilities: ${config.scope.vulnerabilities.join(', ')}`));
                } catch (error) {
                    console.error(chalk.red(`\n❌ Invalid configuration: ${error}`));
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('init')
            .description('Create a new configuration file')
            .argument('[path]', 'Output path', './valyrian-config.yaml')
            .action(async (path) => {
                console.log(chalk.cyan(`\n📝 Creating configuration template at: ${path}`));
                console.log(chalk.gray('Configuration template creation not yet implemented'));
            })
    )
    .addCommand(
        new Command('show')
            .description('Show current environment configuration')
            .action(async () => {
                try {
                    const config = getAppConfigFromEnv();
                    console.log(chalk.cyan('\n⚙️  Environment Configuration:\n'));
                    console.log(chalk.gray(`   LLM Provider: ${config.llm.provider}`));
                    console.log(chalk.gray(`   LLM Model: ${config.llm.model}`));
                    console.log(chalk.gray(`   Temporal Address: ${config.temporal.address}`));
                    console.log(chalk.gray(`   Log Level: ${config.logLevel}`));
                    console.log(chalk.gray(`   Output Dir: ${config.outputDir}`));
                } catch (error) {
                    console.error(chalk.red(`\n❌ Error: ${error}`));
                    process.exit(1);
                }
            })
    );

// =============================================================================
// DASHBOARD COMMAND
// =============================================================================

program
    .command('dashboard')
    .description('Start the live web dashboard')
    .option('-p, --port <number>', 'Port to listen on', '7400')
    .option('--host <host>', 'Host to bind to', '127.0.0.1')
    .option('-o, --output <dir>', 'Output directory containing session metadata', './audit-logs')
    .action(async (options) => {
        try {
            const { DashboardServer, TemporalDataSource } = await import('../dashboard/index.js');
            const port = parseInt(options.port, 10);
            const source = new TemporalDataSource(options.output);
            const server = new DashboardServer(source, {
                port,
                host: options.host,
                outputDir: options.output,
            });

            const { url, close } = await server.start();

            console.log(chalk.cyan(`\n📊 Dashboard running at: ${chalk.bold(url)}`));
            console.log(chalk.gray('   Press Ctrl+C to stop.\n'));

            process.once('SIGINT', async () => {
                await close();
                process.exit(0);
            });
        } catch (error) {
            console.error(chalk.red(`\n❌ Dashboard error: ${error}`));
            cliLogger.error({ error }, 'CLI dashboard command failed');
            process.exit(1);
        }
    });

// =============================================================================
// PLUGIN COMMAND
// =============================================================================

program
    .command('plugin')
    .description('Manage community plugins')
    .addCommand(
        new Command('list')
            .description('List installed plugins')
            .action(async () => {
                const { PluginLoader } = await import('../plugins/index.js');
                const loader = new PluginLoader();
                const plugins = loader.loadAll();
                if (!plugins.length) {
                    console.log(chalk.gray('\n   No plugins installed. Run: valyrian plugin install <id> <repo-url>'));
                    return;
                }
                console.log(chalk.cyan(`\n   ${plugins.length} plugin(s) installed:\n`));
                for (const p of plugins) {
                    console.log(chalk.white(`   ${chalk.bold(p.manifest.id)}  v${p.manifest.version}`));
                    console.log(chalk.gray(`     ${p.manifest.description}`));
                    if (p.templateFiles.length) {
                        console.log(chalk.gray(`     Templates: ${p.templateFiles.length}`));
                    }
                }
            })
    )
    .addCommand(
        new Command('search')
            .description('Search the community registry')
            .argument('<query>', 'Search term')
            .action(async (query: string) => {
                const spinner = ora(`Searching registry for "${query}"...`).start();
                try {
                    const { RegistryClient } = await import('../plugins/index.js');
                    const client = new RegistryClient();
                    const results = await client.search(query);
                    spinner.stop();
                    if (!results.length) {
                        console.log(chalk.gray(`\n   No plugins found for "${query}"`));
                        return;
                    }
                    console.log(chalk.cyan(`\n   ${results.length} result(s):\n`));
                    for (const r of results) {
                        console.log(chalk.white(`   ${chalk.bold(r.id)}  v${r.version}  by ${r.author ?? 'unknown'}`));
                        console.log(chalk.gray(`     ${r.description}`));
                        console.log(chalk.gray(`     ${r.repository}`));
                    }
                } catch (error) {
                    spinner.fail(`Registry search failed: ${error}`);
                }
            })
    )
    .addCommand(
        new Command('install')
            .description('Install a plugin from a git repository')
            .argument('<id>', 'Plugin id (used as local directory name)')
            .argument('<repo>', 'Git repository URL')
            .action(async (id: string, repo: string) => {
                const spinner = ora(`Installing plugin ${id}...`).start();
                try {
                    const { PluginInstaller } = await import('../plugins/index.js');
                    const installer = new PluginInstaller();
                    await installer.install(id, repo);
                    spinner.succeed(`Plugin ${chalk.bold(id)} installed`);
                } catch (error) {
                    spinner.fail(`Install failed: ${error}`);
                    process.exit(1);
                }
            })
    )
    .addCommand(
        new Command('remove')
            .description('Remove an installed plugin')
            .argument('<id>', 'Plugin id to remove')
            .action(async (id: string) => {
                const spinner = ora(`Removing plugin ${id}...`).start();
                try {
                    const { PluginInstaller } = await import('../plugins/index.js');
                    const installer = new PluginInstaller();
                    installer.remove(id);
                    spinner.succeed(`Plugin ${chalk.bold(id)} removed`);
                } catch (error) {
                    spinner.fail(`Remove failed: ${error}`);
                    process.exit(1);
                }
            })
    );

// =============================================================================
// VERSION COMMAND
// =============================================================================

program
    .command('version')
    .description('Show version information')
    .action(() => {
        console.log(chalk.cyan('\nValyrian Edge'));
        console.log(chalk.gray(`Version: ${getVersion()}`));
        console.log(chalk.gray('License: AGPL-3.0'));
        console.log(chalk.gray('Website: https://valyrian-edge.io'));
    });

// =============================================================================
// PARSE AND RUN
// =============================================================================

program.parse();
