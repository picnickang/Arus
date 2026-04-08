import baseConfig from "./jest.config.mjs";

export default {
  ...baseConfig,
  testMatch: [
    "<rootDir>/tests/integration/outcome-tracking.test.ts",
    "<rootDir>/tests/e2e/outcome-tracking.e2e.ts",
  ],
};
