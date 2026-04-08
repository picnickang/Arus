import baseConfig from "./jest.config.mjs";

export default {
  ...baseConfig,
  testMatch: [
    "<rootDir>/tests/integration/**/*.test.ts",
    "<rootDir>/tests/e2e/briefing.e2e.ts",
    "<rootDir>/tests/e2e/activity.e2e.ts",
  ],
};
