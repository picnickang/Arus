import baseConfig from "./jest.config.mjs";

export default {
  ...baseConfig,
  testMatch: [
    "<rootDir>/tests/integration/**/*.test.ts",
    "<rootDir>/tests/e2e/**/*.e2e.ts",
  ],
};
