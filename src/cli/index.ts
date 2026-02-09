#!/usr/bin/env node
/**
 * Valyrian Edge - CLI Entry Point
 * Autonomous AI Penetration Testing Platform
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPentestConfig, getAppConfigFromEnv } from '../config/index.js';
import { cliLogger } from '../utils/logger.js';

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
            // Show legal disclaimer
            if (!options.skipDisclaimer) {
                console.log(LEGAL_NOTICE);
                console.log(chalk.yellow('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n'));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            const spinner = ora('Loading configuration...').start();

            // Load configuration
            const config = createPentestConfig(options.config, {
                outputDir: options.output,
                verbose: options.verbose,
            });

            if (options.target) {
                config.target.baseUrl = options.target;
            }

            spinner.succeed('Configuration loaded');

            cliLogger.info({
                sessionId: config.sessionId,
                target: config.target.baseUrl,
                scope: config.scope.vulnerabilities,
            }, 'Starting pentest');

            console.log(chalk.cyan('\n📋 Pentest Configuration:'));
            console.log(chalk.gray(`   Session ID: ${config.sessionId}`));
            console.log(chalk.gray(`   Target: ${config.target.baseUrl}`));
            console.log(chalk.gray(`   LLM Provider: ${config.llm.provider}`));
            console.log(chalk.gray(`   Vulnerabilities: ${config.scope.vulnerabilities.join(', ')}`));
            console.log(chalk.gray(`   Output: ${config.outputDir}`));

            if (options.dryRun) {
                console.log(chalk.green('\n✅ Dry run complete. Configuration is valid.'));
                return;
            }

            // Start the pentest workflow
            spinner.start('Initializing Temporal workflow...');

            // TODO: Connect to Temporal and start workflow
            // For now, we'll simulate the workflow
            spinner.text = 'Starting reconnaissance...';
            await new Promise(resolve => setTimeout(resolve, 2000));

            spinner.succeed('Pentest workflow started');

            console.log(chalk.cyan(`\n🔍 Pentest session: ${config.sessionId}`));
            console.log(chalk.gray('   Use `valyrian logs --session <id>` to view progress'));
            console.log(chalk.gray('   Use `valyrian report --session <id>` to generate report'));

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${error}`));
            cliLogger.error({ error }, 'CLI start command failed');
            process.exit(1);
        }
    });

// =============================================================================
// LOGS COMMAND
// =============================================================================

program
    .command('logs')
    .description('View logs for a pentest session')
    .requiredOption('-s, --session <id>', 'Session ID')
    .option('-f, --follow', 'Follow log output (like tail -f)', false)
    .option('-n, --lines <count>', 'Number of lines to show', '50')
    .action(async (options) => {
        try {
            console.log(chalk.cyan(`\n📜 Logs for session: ${options.session}\n`));

            // TODO: Implement log retrieval from Temporal/audit-logs
            console.log(chalk.gray('Log retrieval not yet implemented'));
            console.log(chalk.gray(`Would show last ${options.lines} lines`));
            if (options.follow) {
                console.log(chalk.gray('Follow mode enabled'));
            }

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${error}`));
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
    .option('-f, --format <format>', 'Output format: markdown, html, pdf, json', 'markdown')
    .option('-o, --output <path>', 'Output file path')
    .option('--no-poc', 'Exclude PoC scripts from report')
    .option('--redact', 'Redact sensitive data', true)
    .action(async (options) => {
        try {
            const spinner = ora('Generating report...').start();

            // TODO: Implement report generation
            await new Promise(resolve => setTimeout(resolve, 1000));

            spinner.succeed('Report generated');

            const outputPath = options.output ?? `./audit-logs/${options.session}/report.${options.format === 'markdown' ? 'md' : options.format}`;
            console.log(chalk.green(`\n📄 Report saved to: ${outputPath}`));

        } catch (error) {
            console.error(chalk.red(`\n❌ Error: ${error}`));
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
