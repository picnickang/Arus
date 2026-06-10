/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^\\./sync-conflicts-schema$": "<rootDir>/shared/sync-conflicts-schema.ts",
    "^\\.\\./\\.\\./shared/schema-sqlite-sync$": "<rootDir>/shared/schema-sqlite-sync.ts",
    "^\\.\\./\\.\\./shared/schema-sqlite-vessel$": "<rootDir>/shared/schema-sqlite-vessel.ts",
    "^@shared/money-utils$": "<rootDir>/shared/money-utils.ts",
    "^@shared/schema-runtime$": "<rootDir>/tests/mocks/schema-runtime.ts",
    "^@shared/schema-sqlite-sync$": "<rootDir>/shared/schema-sqlite-sync.ts",
    "^@shared/schema-sqlite-vessel$": "<rootDir>/shared/schema-sqlite-vessel.ts",
    "^@shared/sensorKindPresets$": "<rootDir>/shared/sensorKindPresets.ts",
    "^@shared/sync-conflicts-schema$": "<rootDir>/shared/sync-conflicts-schema.ts",
    "^@shared/technician-status$": "<rootDir>/shared/technician-status.ts",
    "^@shared/telemetry-schema$": "<rootDir>/shared/telemetry-schema.ts",
    "^@shared/(.*)\\.js$": "<rootDir>/shared/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
    "^@/(.*)$": "<rootDir>/client/src/$1",
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
  testMatch: ["<rootDir>/server/**/*.test.ts", "<rootDir>/tests/unit/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/client/"],
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
  // The unit lane runs under --experimental-vm-modules, whose per-file ESM
  // module registries accumulate in workers until the process OOMs (observed
  // at ~4 GB on CI). Recycle any worker that idles above this threshold.
  workerIdleMemoryLimit: "1GB",
};
