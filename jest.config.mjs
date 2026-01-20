/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@shared/schema-runtime$": "<rootDir>/tests/mocks/schema-runtime.ts",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: false,
            decorators: true,
          },
          target: "es2022",
        },
        module: {
          type: "es6",
        },
      },
    ],
  },
  testMatch: [
    "<rootDir>/server/**/*.test.ts",
    "<rootDir>/tests/unit/**/*.test.ts",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/client/",
  ],
  collectCoverageFrom: [
    "server/**/*.ts",
    "!server/**/*.test.ts",
    "!server/index.ts",
    "!server/vite.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
