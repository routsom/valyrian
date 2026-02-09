/**
 * Valyrian Edge - Configuration Loader
 * Load and merge configuration from files and environment variables
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { config as loadDotenv } from 'dotenv';
import { nanoid } from 'nanoid';
import {
    ConfigFileSchema,
    LLMConfigSchema,
    AppConfigSchema,
    PentestConfigSchema,
    type ConfigFileOutput,
    type LLMConfigOutput,
    type PentestConfigOutput,
} from './schema.js';
import type { LLMProvider, AppConfig, PentestConfig } from '../types/index.js';

// Load environment variables
loadDotenv();

// =============================================================================
// ENVIRONMENT VARIABLE HELPERS
// =============================================================================

function getEnvString(key: string, defaultValue?: string): string | undefined {
    return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue?: number): number | undefined {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}

// =============================================================================
// LLM CONFIGURATION FROM ENV
// =============================================================================

export function getLLMConfigFromEnv(): LLMConfigOutput {
    const provider = (getEnvString('VALYRIAN_LLM_PROVIDER', 'anthropic') as LLMProvider);

    // Get API key based on provider
    let apiKey: string | undefined;
    if (provider === 'anthropic') {
        apiKey = getEnvString('ANTHROPIC_API_KEY');
    } else if (provider === 'openai') {
        apiKey = getEnvString('OPENAI_API_KEY');
    }

    // Get model based on provider
    let defaultModel: string;
    switch (provider) {
        case 'anthropic':
            defaultModel = 'claude-sonnet-4-20250514';
            break;
        case 'openai':
            defaultModel = 'gpt-4o';
            break;
        case 'ollama':
            defaultModel = getEnvString('OLLAMA_MODEL', 'llama3.2:latest') ?? 'llama3.2:latest';
            break;
        default:
            defaultModel = 'claude-sonnet-4-20250514';
    }

    const config = {
        provider,
        model: getEnvString('VALYRIAN_LLM_MODEL', defaultModel) ?? defaultModel,
        temperature: getEnvNumber('VALYRIAN_LLM_TEMPERATURE', 0.7) ?? 0.7,
        maxTokens: getEnvNumber('VALYRIAN_LLM_MAX_TOKENS', 4096) ?? 4096,
        apiKey,
        ollamaBaseUrl: getEnvString('OLLAMA_BASE_URL', 'http://localhost:11434'),
    };

    return LLMConfigSchema.parse(config);
}

// =============================================================================
// APP CONFIGURATION FROM ENV
// =============================================================================

export function getAppConfigFromEnv(): AppConfig {
    const config = {
        llm: getLLMConfigFromEnv(),
        temporal: {
            address: getEnvString('TEMPORAL_ADDRESS', 'localhost:7233') ?? 'localhost:7233',
            namespace: getEnvString('TEMPORAL_NAMESPACE', 'valyrian-edge') ?? 'valyrian-edge',
            taskQueue: getEnvString('TEMPORAL_TASK_QUEUE', 'valyrian-pentest-queue') ?? 'valyrian-pentest-queue',
        },
        browser: {
            headless: getEnvBoolean('BROWSER_HEADLESS', true) ?? true,
            browserType: (getEnvString('BROWSER_TYPE', 'chromium') ?? 'chromium') as 'chromium' | 'firefox' | 'webkit',
            screenshotOnFailure: getEnvBoolean('SCREENSHOT_ON_FAILURE', true) ?? true,
        },
        logLevel: (getEnvString('LOG_LEVEL', 'info') ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
        outputDir: getEnvString('OUTPUT_DIR', './audit-logs') ?? './audit-logs',
    };

    return AppConfigSchema.parse(config);
}

// =============================================================================
// CONFIGURATION FILE LOADER
// =============================================================================

export function loadConfigFile(configPath: string): ConfigFileOutput {
    const absolutePath = resolve(configPath);

    if (!existsSync(absolutePath)) {
        throw new Error(`Configuration file not found: ${absolutePath}`);
    }

    const content = readFileSync(absolutePath, 'utf-8');
    const parsed = parseYaml(content);

    return ConfigFileSchema.parse(parsed);
}

// =============================================================================
// MERGED PENTEST CONFIGURATION
// =============================================================================

export function createPentestConfig(
    configPath?: string,
    overrides?: Partial<PentestConfig>
): PentestConfigOutput {
    // Start with environment configuration
    const envConfig = getAppConfigFromEnv();

    // Load file configuration if provided
    let fileConfig: ConfigFileOutput | undefined;
    if (configPath) {
        fileConfig = loadConfigFile(configPath);
    }

    // Generate session ID
    const sessionId = overrides?.sessionId ?? `session_${nanoid(12)}`;

    // Merge configurations (overrides > file > env)
    const config: PentestConfig = {
        sessionId,
        target: overrides?.target ?? fileConfig?.target ?? {
            id: 'default',
            name: 'Default Target',
            baseUrl: 'http://localhost:3001',
            endpoints: { chat: '/api/chat' },
        },
        llm: overrides?.llm ?? fileConfig?.llm ?? envConfig.llm,
        scope: overrides?.scope ?? fileConfig?.scope ?? {
            vulnerabilities: ['prompt_injection', 'tool_abuse', 'data_exfiltration'],
            maxTurns: 10,
            enableExploitation: true,
            generatePoC: true,
        },
        outputDir: overrides?.outputDir ?? fileConfig?.output?.directory ?? envConfig.outputDir,
        verbose: overrides?.verbose ?? fileConfig?.verbose ?? false,
        rateLimit: overrides?.rateLimit ?? fileConfig?.rateLimit ?? {
            requestsPerMinute: 30,
            delayBetweenRequests: 1000,
        },
    };

    return PentestConfigSchema.parse(config);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { ConfigFileSchema, LLMConfigSchema, AppConfigSchema, PentestConfigSchema };
