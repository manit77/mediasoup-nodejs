import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*/*_test.ts'],
    globals: true,
    // setupFiles: ['./vitest.setup.ts'], // Optional: For custom setup (e.g., supertest)
    deps: {
      moduleDirectories: ['node_modules', 'packages'], // For monorepo packages
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Similar to --runInBand
      },
    },
  },
  resolve: {
    alias: {
      '@conf-client': 'conf/conf-client/src',
      '@rooms-client': 'rooms/rooms-client/src',
      '@websocket-client': 'libs/websocket-client/src',
      '@webrtc-client': 'libs/webrtc-client/src',
      '@conf-models': 'conf/conf-models/src',
      '@rooms-models': 'rooms/rooms-models/src',
    },
  },
});