import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Specify test directory pattern
        include: ['test/interop/**/*.test.ts'],
        // Add environment setup if needed
        setupFiles: ['test/interop/setup.ts'],
        // Increase timeout for tests that need to wait for cross-chain operations
        testTimeout: 30000,
    },
}) 