import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // Matches your Jest testEnvironment
    include: ['**/*/*_test.ts'], // Matches your Jest testMatch
    globals: true, // Enables Jest-like globals (describe, it, expect)
    // setupFiles: ['./vitest.setup.ts'], // Optional: For custom setup (e.g., supertest)
    deps: {
      moduleDirectories: ['node_modules', 'packages'], // For monorepo packages
    },
    // Replicate Jest's --runInBand and --detectOpenHandles
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Similar to --runInBand
      },
    },
  },
  resolve: {
    alias: {
      '@conf-client': 'packages/client-libs/conf-client/src',
      '@rooms-client': 'packages/client-libs/rooms-client/src',
      '@websocket-client': 'packages/client-libs/websocket-client/src',
      '@webrtc-client': 'packages/client-libs/webrtc-client/src',
      '@conf-models': 'packages/shared-models/conf-models/src',
      '@rooms-models': 'packages/shared-models/rooms-models/src',
    },
  },
});