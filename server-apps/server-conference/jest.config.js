/* eslint-disable @typescript-eslint/no-require-imports */
const { pathsToModuleNameMapper } = require('ts-jest')
const { compilerOptions } = require('./tsconfig')

//console.log("compilerOptions.paths", compilerOptions.paths);

module.exports = {
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ['**/*/*_test.ts'],
  setupFilesAfterEnv: ["./jest.custom.config.js"],
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
  testPathIgnorePatterns: ["/build/"],
  maxWorkers: 1
};

