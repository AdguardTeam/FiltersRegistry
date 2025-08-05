import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        typecheck: {
            enabled: true,
            tsconfig: './tsconfig.json',
        },
        include: ['scripts/wildcard-domain-processor/__tests__/*.test.ts'],
        watch: false,
        silent: true,
    },
});