import { expect, test, type ConsoleMessage } from "@playwright/test";

import {
  hideDevPerfOverlay,
  isBenignConsoleError,
  navigateWithinAuthenticatedSpa,
} from "./helpers/spa-auth";
import { HUBS } from "./helpers/hub-targets";

/**
 * Authenticated hub smoke (`@smoke`) — REAL backend.
 *
 * Logs in as a dev admin against a live backend and walks every operational
 * hub, asserting the page renders and that NO `/api` response is a 5xx and NO
 * non-benign console / page error fires. This is the integration counterpart to
 * `smoke.spec.ts` (which only covers the unauthenticated shell with mocked-free
 * `/`): it catches server/route/data regressions a mocked crawl can't.
 *
 * Auth + navigation model (load-bearing):
 *  - The session token is in-memory only (XSS hardening, see AdminAccessContext)
 *    and is wiped by any full page reload. So we authenticate via the dev-login
 *    button and then navigate client-side (History API) — a full `page.goto`
 *    per route would drop the session and 401 everything. Client-side nav still
 *    fires real `/api` XHRs with the bearer token, so the backend IS exercised.
 *  - The dev-login button only exists in a Vite-DEV renderer
 *    (`import.meta.env.PROD` hides it). A production renderer (e.g. the default
 *    `npm run build:renderer` webServer) self-skips this spec — identical to
 *    `mobile-local-backend-smoke.spec.ts`. Run it against `npm run dev`
 *    (`PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_LOCAL_BACKEND=1`) for real signal.
 */

// Opt-in: this lane needs a real backend, not the mocked fixtures.
test.skip(
  process.env["PLAYWRIGHT_LOCAL_BACKEND"] !== "1",
  "Set PLAYWRIGHT_LOCAL_BACKEND=1 to run the real-backend authenticated hub smoke."
);

const DEEP_LINKS = ["/work-orders", "/crew-management", "/analytics", "/logs"] as const;

test.describe("authenticated hub smoke @smoke", () => {
  test.setTimeout(90_000);

  test("dev admin reaches every hub with no 5xx and no console/page errors", async ({ page }) => {
    const serverErrors: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/") && response.status() >= 500) {
        serverErrors.push(`${response.status()} ${new URL(url).pathname}`);
      }
    });
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error" && !isBenignConsoleError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      const text = `${err.name}: ${err.message}`;
      if (!isBenignConsoleError(text)) {
        pageErrors.push(text);
      }
    });

    // Authenticate via the dev-login button (DEV renderer only).
    await page.goto("/portal-login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const devAdminButton = page.getByTestId("button-dev-login-admin");
    const devLoginAvailable = await devAdminButton
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(
      !devLoginAvailable,
      "Real-backend hub smoke requires a dev renderer with dev login enabled; the production renderer hides it."
    );
    await devAdminButton.click();
    // Dev admin lands on the reskinned Command Queue (mobile-readiness shell).
    await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible({
      timeout: 15_000,
    });

    const routes = [...HUBS.map((hub) => hub.hubRoute), ...DEEP_LINKS];
    const failures: string[] = [];

    for (const route of routes) {
      await test
        .step(`hub ${route}`, async () => {
          await navigateWithinAuthenticatedSpa(page, route);
          await page.waitForLoadState("domcontentloaded");
          await hideDevPerfOverlay(page);

          const root = page.locator("#root");
          await expect(root, `${route} should mount`).toBeAttached();
          await expect(root, `${route} should render content`).not.toBeEmpty({ timeout: 10_000 });
          await expect(
            page.getByText("404 Page Not Found", { exact: false }),
            `${route} landed on NotFound`
          ).toHaveCount(0);
          // Give in-flight hub data requests a beat to land so 5xx/console errors surface.
          await page.waitForTimeout(600);
        })
        .catch((err: unknown) => {
          failures.push(
            `${route}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
          );
        });
    }

    expect(failures, `hub render failures:\n${failures.join("\n")}`).toEqual([]);
    expect(serverErrors, `5xx /api responses:\n${serverErrors.join("\n")}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  });
});
