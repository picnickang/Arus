import baseConfig from "./jest.config.mjs";

export default {
  ...baseConfig,
  testMatch: [
    "<rootDir>/tests/unit/pdm-decision-support.test.ts",
    "<rootDir>/tests/integration/pdm-decision-support-routes.test.ts",
    "<rootDir>/tests/integration/pdm-decision-support-registry.test.ts",
  ],
};
