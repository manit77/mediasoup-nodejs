export default {
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  preset: 'ts-jest/presets/js-with-ts-esm', // ESM preset for TypeScript
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'], // Remove .js, keep .ts
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }], // ESM for TypeScript
  },
  testMatch: ['**/*/*_test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.custom.config.js'],
  testPathIgnorePatterns: ['/build/'],
  maxWorkers: 1,
  // moduleNameMapper: {
  //   '^rooms-models$': '<rootDir>/../rooms-models', // Map to rooms-models
  // },
};