/**
 * Valyrian Edge - Configuration Schema
 * Zod schemas for configuration validation
 */

import { z } from 'zod';

// =============================================================================
// LLM CONFIGURATION SCHEMA
// =============================================================================

export const LLMProviderSchema = z.enum(['anthropic', 'openai', 'ollama']);

export const LLMConfigSchema = z.object({
    provider: LLMProviderSchema.default('anthropic'),
    model: z.string().default('claude-sonnet-4-20250514'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().positive().default(4096),
    apiKey: z.string().optional(),
    ollamaBaseUrl: z.string().url().optional().default('http://localhost:11434'),
}).refine((data) => {
    // Require API key for non-Ollama providers
    if (data.provider !== 'ollama' && !data.apiKey) {
        return false;
    }
    return true;
}, {
    message: 'API key is required for Anthropic and OpenAI providers',
});

// =============================================================================
// AUTHENTICATION SCHEMA
// =============================================================================

export const AuthMethodSchema = z.enum([
    'none',
    'api_key',
    'bearer_token',
    'session_cookie',
    'oauth2',
    'saml',
    'custom',
]);

export const AuthCredentialsSchema = z.object({
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    tokenEndpoint: z.string().url().optional(),
});

export const AuthConfigSchema = z.object({
    method: AuthMethodSchema.default('none'),
    credentials: AuthCredentialsSchema.optional(),
    headers: z.record(z.string()).optional(),
});

// =============================================================================
// TARGET PROFILE SCHEMA
// =============================================================================

export const TargetEndpointsSchema = z.object({
    chat: z.string(),
    login: z.string().optional(),
    history: z.string().optional(),
    upload: z.string().optional(),
    websocket: z.string().optional(),
});

export const ChatbotArchitectureSchema = z.enum([
    'rag',
    'fine-tuned',
    'prompt-engineered',
    'agentic',
    'unknown',
]);

export const TargetProfileSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    baseUrl: z.string().url(),
    architecture: ChatbotArchitectureSchema.optional(),
    llmProvider: z.string().optional(),
    llmModel: z.string().optional(),
    endpoints: TargetEndpointsSchema,
    authentication: AuthConfigSchema.optional(),
    capabilities: z.array(z.string()).optional(),
    headers: z.record(z.string()).optional(),
    rateLimit: z.number().positive().optional().default(30),
    timeout: z.number().positive().optional().default(30),
});

// =============================================================================
// SCAN SCOPE SCHEMA
// =============================================================================

export const VulnerabilityCategorySchema = z.enum([
    'prompt_injection',
    'rag_poisoning',
    'tool_abuse',
    'auth_bypass',
    'data_exfiltration',
    'excessive_agency',
    'insecure_output',
    'denial_of_service',
]);

export const ScanScopeSchema = z.object({
    vulnerabilities: z.array(VulnerabilityCategorySchema).default([
        'prompt_injection',
        'tool_abuse',
        'data_exfiltration',
    ]),
    maxTurns: z.number().positive().default(10),
    enableExploitation: z.boolean().default(true),
    generatePoC: z.boolean().default(true),
});

// =============================================================================
// PENTEST CONFIGURATION SCHEMA
// =============================================================================

export const RateLimitConfigSchema = z.object({
    requestsPerMinute: z.number().positive().default(30),
    delayBetweenRequests: z.number().nonnegative().default(1000),
});

export const PentestConfigSchema = z.object({
    sessionId: z.string().min(1),
    target: TargetProfileSchema,
    llm: LLMConfigSchema,
    scope: ScanScopeSchema,
    outputDir: z.string().default('./audit-logs'),
    verbose: z.boolean().default(false),
    rateLimit: RateLimitConfigSchema.optional(),
});

// =============================================================================
// APPLICATION CONFIGURATION SCHEMA
// =============================================================================

export const TemporalConfigSchema = z.object({
    address: z.string().default('localhost:7233'),
    namespace: z.string().default('valyrian-edge'),
    taskQueue: z.string().default('valyrian-pentest-queue'),
});

export const BrowserConfigSchema = z.object({
    headless: z.boolean().default(true),
    browserType: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
    screenshotOnFailure: z.boolean().default(true),
});

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export const AppConfigSchema = z.object({
    llm: LLMConfigSchema,
    temporal: TemporalConfigSchema,
    browser: BrowserConfigSchema,
    logLevel: LogLevelSchema.default('info'),
    outputDir: z.string().default('./audit-logs'),
});

// =============================================================================
// CONFIG FILE SCHEMA (YAML)
// =============================================================================

export const ConfigFileSchema = z.object({
    // Target configuration
    target: TargetProfileSchema,

    // LLM configuration (optional, defaults to env vars)
    llm: LLMConfigSchema.optional(),

    // Scan scope
    scope: ScanScopeSchema.optional(),

    // Rate limiting
    rateLimit: RateLimitConfigSchema.optional(),

    // Output settings
    output: z.object({
        directory: z.string().default('./audit-logs'),
        formats: z.array(z.enum(['markdown', 'html', 'pdf', 'json', 'sarif'])).default(['markdown']),
        redactSensitiveData: z.boolean().default(true),
    }).optional(),

    // Verbose logging
    verbose: z.boolean().default(false),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type LLMConfigInput = z.input<typeof LLMConfigSchema>;
export type LLMConfigOutput = z.output<typeof LLMConfigSchema>;
export type TargetProfileInput = z.input<typeof TargetProfileSchema>;
export type TargetProfileOutput = z.output<typeof TargetProfileSchema>;
export type PentestConfigInput = z.input<typeof PentestConfigSchema>;
export type PentestConfigOutput = z.output<typeof PentestConfigSchema>;
export type ConfigFileInput = z.input<typeof ConfigFileSchema>;
export type ConfigFileOutput = z.output<typeof ConfigFileSchema>;
