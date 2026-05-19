import baseConfig from "./jest.config.mjs";

export default {
  ...baseConfig,
  testMatch: [
    "<rootDir>/tests/integration/**/*.test.ts",
    "<rootDir>/tests/e2e/briefing.e2e.ts",
    "<rootDir>/tests/e2e/activity.e2e.ts",
  ],
  globalTeardown: "<rootDir>/tests/integration/_global-teardown.ts",
  // The shared pg Pool is now closed in globalTeardown, so Jest can exit
  // cleanly without relying on forceExit to mask the leaked handle.
  forceExit: false,
};

