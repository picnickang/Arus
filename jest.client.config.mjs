/**
 * Client data-layer test lane: jsdom + Testing Library + MSW.
 * Run via `npm run test:client:hooks`. The node-based runner in client/tests
 * (`npm run test:client`) is a separate, older lane.
 */

/** @type {import('jest').Config} */
export default {
  testEnvironment: "jsdom",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@shared/(.*)\\.js$": "<rootDir>/shared/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
    "^@/(.*)$": "<rootDir>/client/src/$1",
    "\\.(css|less|scss)$": "<rootDir>/client/src/test/style-stub.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: true,
          },
          transform: {
            react: {
              runtime: "automatic",
            },
          },
          target: "es2022",
        },
        module: {
          type: "es6",
        },
      },
    ],
  },
  testMatch: ["<rootDir>/client/src/**/*.test.ts", "<rootDir>/client/src/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFiles: ["<rootDir>/client/src/test/polyfills.ts"],
  setupFilesAfterEnv: ["<rootDir>/client/src/test/setup.ts"],
  testTimeout: 15000,
  forceExit: true,
};
