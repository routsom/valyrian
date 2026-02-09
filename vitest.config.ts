import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/cli/**'],
        },
        testTimeout: 30000,
        hookTimeout: 10000,
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
