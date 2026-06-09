import process from "node:process";

import baseConfig from "./jest.config.mjs";

const {
  collectCoverageFrom,
  coverageDirectory,
  coverageReporters,
  coverageThreshold,
  forceExit,
  verbose,
  ...projectBaseConfig
} = baseConfig;

process.env.NODE_ENV ||= "test";
process.env.EMBEDDED_MODE ||= "true";
process.env.ARUS_DISABLE_BACKGROUND_WORKERS ||= "true";
process.env.DISABLE_AGENT_SCHEDULER ||= "true";
process.env.DISABLE_DIGITAL_TWIN_STARTUP ||= "true";
process.env.DISABLE_EMAIL_WORKER ||= "true";
process.env.DISABLE_JOB_QUEUE ||= "true";
process.env.DISABLE_ML_SERVICE_STARTUP ||= "true";
process.env.DISABLE_OBSERVABILITY_TIMERS ||= "true";
process.env.DISABLE_REDIS ||= "true";
process.env.DISABLE_SECURITY_TIMERS ||= "true";
process.env.DISABLE_TELEMETRY_BATCH_WRITER ||= "true";
process.env.ENABLE_BACKGROUND_JOBS ||= "false";
process.env.ENABLE_SCHEDULERS ||= "false";
process.env.EVENT_SPINE_DISABLED ||= "1";
process.env.EVENT_SPINE_WORKER ||= "0";

const deterministicIntegrationTests = [
  "tests/integration/activity.test.ts",
  "tests/integration/equipment-hub-acknowledge.test.ts",
  "tests/integration/work-order-assignment-service.test.ts",
  "tests/integration/work-order-assignment-route-gate.test.ts",
  "tests/integration/websocket-strict-mode.test.ts",
  "tests/integration/permissions-hub-resolution.test.ts",
  "tests/integration/permissions-me-primary-role.test.ts",
  "tests/integration/role-crud-workflow.test.ts",
  "tests/integration/permission-audit-read.test.ts",
  "tests/integration/rag-conversation-ownership.test.ts",
  "tests/integration/object-storage-client-concurrency.test.ts",
  "tests/integration/ml-train-idempotency.test.ts",
  "tests/integration/vessel-performance-auth.test.ts",
  "tests/integration/vessel-diagram-registry-routes.test.ts",
  "tests/integration/kb-upload-reliability.test.ts",
  "tests/integration/lr35-pdm-promote-rollback-gate.test.ts",
  "tests/integration/telemetry.test.ts",
  "tests/integration/briefing.test.ts",
  "tests/integration/outcome-tracking.test.ts",
  "tests/integration/import-amos-golden.test.ts",
  "tests/integration/pdm-decision-support-routes.test.ts",
  "tests/integration/operator-information-needs-routes.test.ts",
  "tests/integration/operator-experience-routes.test.ts",
  "tests/integration/attention-inbox-role-gate.test.ts",
  "tests/integration/safety-bulletins.test.ts",
  "tests/integration/safety-bulletins-feed.test.ts",
  "tests/integration/compliance-exports.test.ts",
  "tests/integration/feature-flag-tenant-isolation.test.ts",
  "tests/integration/tenant-quota-throttle.test.ts",
  "tests/integration/permission-grants-lockout.test.ts",
  "tests/integration/role-hub-access-audit.test.ts",
  "tests/integration/role-403-matrix.test.ts",
  "tests/integration/lr35-rag-security-admin-gate.test.ts",
  "tests/integration/equipment-dependencies-graph-projection.test.ts",
  "tests/integration/import-shipmate-golden.test.ts",
  "tests/integration/findings.test.ts",
  "tests/integration/rag-conversations.test.ts",
  "tests/integration/crew-photo-object-serving.test.ts",
  "tests/e2e/activity.e2e.ts",
  "tests/e2e/briefing.e2e.ts",
];

export default {
  collectCoverageFrom,
  coverageDirectory,
  coverageReporters,
  coverageThreshold,
  forceExit,
  verbose,
  projects: [
    {
      ...projectBaseConfig,
      displayName: "unit-coverage",
      rootDir: ".",
      testMatch: baseConfig.testMatch,
      setupFilesAfterEnv: baseConfig.setupFilesAfterEnv,
    },
    {
      ...projectBaseConfig,
      displayName: "integration-coverage",
      rootDir: ".",
      setupFilesAfterEnv: [
        ...baseConfig.setupFilesAfterEnv,
        "<rootDir>/tests/integration/setup-integration.ts",
      ],
      testMatch: deterministicIntegrationTests.map((file) => `<rootDir>/${file}`),
      globalTeardown: "<rootDir>/tests/integration/_global-teardown.ts",
      testTimeout: 60000,
    },
  ],
};
