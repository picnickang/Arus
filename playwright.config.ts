import { defineConfig, devices } from "@playwright/test";

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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // In CI the workflow boots the server in a previous step (or via
  // `webServer` below for `npx playwright test` locally). Locally,
  // start the dev server if one isn't already listening on 5000.
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5000/api/healthz",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
