/**
 * Valyrian Edge - Sanitizer
 * Utility functions for sanitizing and redacting sensitive data
 */

// =============================================================================
// SENSITIVE DATA PATTERNS
// =============================================================================

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string; name: string }> = [
    // API Keys
    {
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        replacement: 'sk-[REDACTED]',
        name: 'OpenAI API Key'
    },
    {
        pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g,
        replacement: 'sk-ant-[REDACTED]',
        name: 'Anthropic API Key'
    },
    {
        pattern: /xoxb-[a-zA-Z0-9-]+/g,
        replacement: 'xoxb-[REDACTED]',
        name: 'Slack Bot Token'
    },
    {
        pattern: /ghp_[a-zA-Z0-9]{36}/g,
        replacement: 'ghp_[REDACTED]',
        name: 'GitHub PAT'
    },

    // AWS Credentials
    {
        pattern: /AKIA[0-9A-Z]{16}/g,
        replacement: 'AKIA[REDACTED]',
        name: 'AWS Access Key'
    },
    {
        pattern: /"SecretAccessKey"\s*:\s*"[^"]+"/g,
        replacement: '"SecretAccessKey": "[REDACTED]"',
        name: 'AWS Secret Key'
    },

    // Passwords & Secrets
    {
        pattern: /password\s*[=:]\s*["']?[^"'\s]+["']?/gi,
        replacement: 'password=[REDACTED]',
        name: 'Password'
    },
    {
        pattern: /secret\s*[=:]\s*["']?[^"'\s]+["']?/gi,
        replacement: 'secret=[REDACTED]',
        name: 'Secret'
    },

    // JWT Tokens
    {
        pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        replacement: '[JWT_REDACTED]',
        name: 'JWT Token'
    },

    // PII - Email
    {
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: '[EMAIL_REDACTED]',
        name: 'Email Address'
    },

    // PII - Phone Numbers
    {
        pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        replacement: '[PHONE_REDACTED]',
        name: 'Phone Number'
    },

    // PII - SSN
    {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: '[SSN_REDACTED]',
        name: 'SSN'
    },

    // PII - Credit Card
    {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '[CC_REDACTED]',
        name: 'Credit Card'
    },

    // Database Connection Strings
    {
        pattern: /postgres(ql)?:\/\/[^@]+@[^\s]+/gi,
        replacement: 'postgresql://[REDACTED]',
        name: 'PostgreSQL Connection'
    },
    {
        pattern: /mongodb(\+srv)?:\/\/[^@]+@[^\s]+/gi,
        replacement: 'mongodb://[REDACTED]',
        name: 'MongoDB Connection'
    },
];

// =============================================================================
// SANITIZATION FUNCTIONS
// =============================================================================

export interface SanitizationResult {
    sanitized: string;
    redactedItems: Array<{ type: string; count: number }>;
}

/**
 * Sanitize a string by redacting sensitive data
 */
export function sanitizeString(input: string): SanitizationResult {
    let sanitized = input;
    const redactedItems: Array<{ type: string; count: number }> = [];

    for (const { pattern, replacement, name } of SENSITIVE_PATTERNS) {
        const matches = sanitized.match(pattern);
        if (matches && matches.length > 0) {
            redactedItems.push({ type: name, count: matches.length });
            sanitized = sanitized.replace(pattern, replacement);
        }
    }

    return { sanitized, redactedItems };
}

/**
 * Sanitize an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        // Redact known sensitive keys entirely
        const sensitiveKeys = ['password', 'secret', 'apiKey', 'api_key', 'token', 'credential'];
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
            result[key] = '[REDACTED]';
            continue;
        }

        if (typeof value === 'string') {
            result[key] = sanitizeString(value).sanitized;
        } else if (Array.isArray(value)) {
            result[key] = value.map(item =>
                typeof item === 'object' && item !== null
                    ? sanitizeObject(item as Record<string, unknown>)
                    : typeof item === 'string'
                        ? sanitizeString(item).sanitized
                        : item
            );
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

// =============================================================================
// EXPLOIT PAYLOAD SANITIZATION
// =============================================================================

/**
 * Escape special characters for safe display
 */
export function escapeForDisplay(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Truncate long strings for display
 */
export function truncate(input: string, maxLength: number = 200): string {
    if (input.length <= maxLength) return input;
    return input.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate that a URL is not targeting internal/metadata services
 */
export function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        // Block metadata services
        const blockedHosts = [
            '169.254.169.254', // AWS metadata
            'metadata.google.internal', // GCP metadata
            '100.100.100.200', // Alibaba metadata
            'fd00:ec2::254', // AWS IPv6 metadata
        ];

        if (blockedHosts.includes(hostname)) return false;

        // Block localhost variants
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return false;
        }

        // Block private IP ranges
        const privatePatterns = [
            /^10\.\d+\.\d+\.\d+$/,
            /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
            /^192\.168\.\d+\.\d+$/,
        ];

        for (const pattern of privatePatterns) {
            if (pattern.test(hostname)) return false;
        }

        return true;
    } catch {
        return false;
    }
}

export default { sanitizeString, sanitizeObject, escapeForDisplay, truncate, isValidUrl, isSafeUrl };
