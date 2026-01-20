export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1.ts',
    '^@/(.*)$': '<rootDir>/client/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: false,
          },
          target: 'es2022',
        },
        module: {
          type: 'es6',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@xenova|onnxruntime-node))',
  ],
  testMatch: ['**/tests/**/*.test.ts', '**/__tests__/**/*.test.ts'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  testTimeout: 30000,
  maxWorkers: 1,
  workerIdleMemoryLimit: '256MB',
  cache: false,
  verbose: true,
};
