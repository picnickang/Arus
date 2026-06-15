import { defineConfig, devices } from "@playwright/test";

/**
 * Opt-in local visual-verification runner for the mobile/ops chrome specs.
 *
 * Only used when explicitly selected (`--config=playwright.verify.config.ts`);
 * CI continues to use the default `playwright.config.ts`. It assumes a server is
 * already listening on :5000 (no `webServer`), and lets you point at a
 * pre-installed Chromium when the Playwright browser CDN is unreachable:
 *
 *   PW_EXECUTABLE_PATH=/path/to/chrome \
 *   npx playwright test --config=playwright.verify.config.ts
 *
 * Boot the server first with the embedded test env (SQLite/VESSEL), e.g.
 *   EMBEDDED_MODE=true LOCAL_MODE=true ARUS_DEV_LOGIN=1 NODE_ENV=test PORT=5000 \
 *   npx tsx server/index.ts
 */
const executablePath = process.env.PW_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/playwright",
  testMatch: [
    "**/mobile-ops-rail.spec.ts",
    "**/bridge-conditions.spec.ts",
    "**/axe-contrast.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5000",
    serviceWorkers: "block",
    trace: "off",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
