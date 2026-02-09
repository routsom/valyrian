/**
 * Valyrian Edge - Configuration Types
 * Core configuration interfaces for the pentest platform
 */

// Types for configuration

// =============================================================================
// LLM PROVIDER CONFIGURATION
// =============================================================================

export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

export interface LLMConfig {
    /** LLM provider to use */
    provider: LLMProvider;
    /** Model identifier (e.g., 'claude-sonnet-4-20250514', 'gpt-4o', 'llama3.2:latest') */
    model: string;
    /** Temperature for response generation (0.0 - 1.0) */
    temperature: number;
    /** Maximum tokens in response */
    maxTokens: number;
    /** API key (not required for Ollama) */
    apiKey?: string;
    /** Base URL for Ollama */
    ollamaBaseUrl?: string;
}

// =============================================================================
// TARGET CONFIGURATION
// =============================================================================

export type ChatbotArchitecture = 'rag' | 'fine-tuned' | 'prompt-engineered' | 'agentic' | 'unknown';

export type AuthenticationMethod =
    | 'none'
    | 'api_key'
    | 'bearer_token'
    | 'session_cookie'
    | 'oauth2'
    | 'saml'
    | 'custom';

export interface AuthenticationConfig {
    /** Authentication method */
    method: AuthenticationMethod;
    /** Credentials or token */
    credentials?: {
        /** API key or token value */
        token?: string;
        /** Username for session-based auth */
        username?: string;
        /** Password for session-based auth */
        password?: string;
        /** OAuth client ID */
        clientId?: string;
        /** OAuth client secret */
        clientSecret?: string;
        /** OAuth token endpoint */
        tokenEndpoint?: string;
    };
    /** Custom headers to include */
    headers?: Record<string, string>;
}

export interface TargetEndpoints {
    /** Main chat endpoint */
    chat: string;
    /** Login/auth endpoint */
    login?: string;
    /** Conversation history endpoint */
    history?: string;
    /** Document upload endpoint (for RAG systems) */
    upload?: string;
    /** WebSocket endpoint for real-time chat */
    websocket?: string;
}

export interface TargetProfile {
    /** Unique identifier for this target */
    id: string;
    /** Human-readable name */
    name: string;
    /** Base URL of the target chatbot */
    baseUrl: string;
    /** Known chatbot architecture */
    architecture?: ChatbotArchitecture;
    /** Known LLM provider */
    llmProvider?: string;
    /** Known model */
    llmModel?: string;
    /** API endpoints */
    endpoints: TargetEndpoints;
    /** Authentication configuration */
    authentication?: AuthenticationConfig;
    /** Known capabilities/tools */
    capabilities?: string[];
    /** Custom request headers */
    headers?: Record<string, string>;
    /** Rate limit (requests per minute) */
    rateLimit?: number;
    /** Request timeout in seconds */
    timeout?: number;
}

// =============================================================================
// PENTEST CONFIGURATION
// =============================================================================

export type VulnerabilityCategory =
    | 'prompt_injection'
    | 'rag_poisoning'
    | 'tool_abuse'
    | 'auth_bypass'
    | 'data_exfiltration'
    | 'excessive_agency'
    | 'insecure_output'
    | 'denial_of_service';

export interface ScanScope {
    /** Vulnerability categories to test */
    vulnerabilities: VulnerabilityCategory[];
    /** Maximum depth for multi-turn attacks */
    maxTurns: number;
    /** Whether to attempt exploitation after detection */
    enableExploitation: boolean;
    /** Whether to generate PoC scripts */
    generatePoC: boolean;
}

export interface PentestConfig {
    /** Session identifier */
    sessionId: string;
    /** Target to pentest */
    target: TargetProfile;
    /** LLM configuration for adversarial agent */
    llm: LLMConfig;
    /** Scope of the pentest */
    scope: ScanScope;
    /** Output directory for reports and logs */
    outputDir: string;
    /** Enable verbose logging */
    verbose: boolean;
    /** Rate limiting configuration */
    rateLimit: {
        requestsPerMinute: number;
        delayBetweenRequests: number;
    };
}

// =============================================================================
// APPLICATION CONFIGURATION
// =============================================================================

export interface TemporalConfig {
    /** Temporal server address */
    address: string;
    /** Temporal namespace */
    namespace: string;
    /** Task queue name */
    taskQueue: string;
}

export interface BrowserConfig {
    /** Run in headless mode */
    headless: boolean;
    /** Browser type: chromium, firefox, webkit */
    browserType: 'chromium' | 'firefox' | 'webkit';
    /** Take screenshots on failure */
    screenshotOnFailure: boolean;
}

export interface AppConfig {
    /** LLM configuration */
    llm: LLMConfig;
    /** Temporal workflow configuration */
    temporal: TemporalConfig;
    /** Browser automation configuration */
    browser: BrowserConfig;
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Output directory */
    outputDir: string;
}
