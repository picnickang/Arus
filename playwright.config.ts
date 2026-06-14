import { defineConfig, devices } from "@playwright/test";

const INCLUDE_QUARANTINED = process.env.PLAYWRIGHT_INCLUDE_QUARANTINE === "1";
const INCLUDE_PRODUCTION_WRITE_AUDIT = process.env.ARUS_PROD_E2E_ALLOW_WRITES === "1";

const CORE_RELEASE_TESTS = [
  "**/smoke.spec.ts",
  "**/static-mobile-boot.spec.ts",
  "**/core-browser-smoke.spec.ts",
  "**/mobile-core-smoke.spec.ts",
  "**/mobile-readiness-control-crawl.spec.ts",
  "**/mobile-readiness-link-audit.spec.ts",
  "**/mobile-readiness-visual-fidelity.spec.ts",
  "**/portal-nav.spec.ts",
  "**/vessel-intelligence.spec.ts",
  ...(INCLUDE_PRODUCTION_WRITE_AUDIT
    ? ["**/journeys/production-full-write-audit.spec.ts"]
    : []),
];

// Mobile spec subset run by the visual-regression projects below
// (argos-visual-ci / playwright-visual-ci / mobile-qa-visual-argos).
const MOBILE_VISUAL_TESTS = [
  "**/mobile-core-smoke.spec.ts",
  "**/mobile-readiness-control-crawl.spec.ts",
  "**/mobile-readiness-link-audit.spec.ts",
  "**/mobile-readiness-visual-fidelity.spec.ts",
  "**/static-mobile-boot.spec.ts",
];

/**
 * Prod-hardening Wave 5: minimal Playwright smoke harness.
 *
 * Scope is deliberately narrow — one render smoke + one health check.
 * The bulk of e2e coverage lives in `tests/e2e/*.e2e.ts` (jest +
 * fetch), which is fast and CI-friendly. Playwright fills the gap
 * those can't cover: actual browser render, JS execution, and
 * console-error surfacing on the SPA shell.
 *
 * CI installs only chromium (see ci.yml `e2e-smoke` job) to keep the
 * job under the 10-minute budget.
 */
export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: INCLUDE_QUARANTINED ? ["**/*.spec.ts"] : CORE_RELEASE_TESTS,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Mobile viewport projects for the visual-regression workflows. They run
    // the mobile spec subset under a Pixel 5 (chromium engine) viewport, so the
    // chromium browser install in CI is sufficient.
    {
      name: "mobile-chromium",
      testMatch: MOBILE_VISUAL_TESTS,
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-visual",
      testMatch: MOBILE_VISUAL_TESTS,
      use: { ...devices["Pixel 5"] },
    },
  ],

  // In CI the workflow boots the server in a previous step (or via
  // `webServer` below for `npx playwright test` locally). Locally,
  // start the dev server if one isn't already listening on 5000.
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run build:renderer && npm run dev:playwright",
        env: {
          ...process.env,
          DISABLE_AGENT_SCHEDULER: "true",
          DISABLE_DIGITAL_TWIN_STARTUP: "true",
          DISABLE_EMAIL_WORKER: "true",
          DISABLE_ML_SERVICE_STARTUP: "true",
          DISABLE_MODEL_BACKED_INFERENCE: "true",
          DISABLE_OBSERVABILITY_TIMERS: "true",
          DISABLE_RATE_LIMITS: "true",
          DISABLE_REDIS: "true",
          DISABLE_SECURITY_TIMERS: "true",
          DISABLE_TELEMETRY_BATCH_WRITER: "true",
          ARUS_DEV_LOGIN: "1",
          EMBEDDED_MODE: "true",
          ENABLE_AUTO_REPLAN: "false",
          ENABLE_BACKGROUND_JOBS: "false",
          ENABLE_SCHEDULERS: "false",
          ENABLE_SYNC_SERVICES: "false",
          ENABLE_UPDATE_SYSTEM: "false",
          EVENT_SPINE_ANALYTICS: "0",
          EVENT_SPINE_DISABLED: "1",
          EVENT_SPINE_WORKER: "0",
          LOCAL_MODE: "true",
          NODE_ENV: "test",
          PLAYWRIGHT_TEST: "true",
          PORT: "5000",
          SESSION_SECRET: "playwright-test-session-secret-not-for-production",
          VITE_ARUS_DEV_LOGIN: "1",
        },
        url: "http://127.0.0.1:5000/api/healthz",
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
