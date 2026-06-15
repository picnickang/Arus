import { expect, test, type ConsoleMessage } from "@playwright/test";

import {
  hideDevPerfOverlay,
  isBenignConsoleError,
  navigateWithinAuthenticatedSpa,
} from "./helpers/spa-auth";
import { ROLE_SCENARIOS, expectedScreenTestId } from "./helpers/roles";

/**
 * Non-admin hub smoke (`@smoke`) — REAL backend.
 *
 * Logs in as a dev USER (deck_officer, via `button-dev-login-user`) and verifies
 * the non-admin surface: the reachable routes render their correct
 * mobile-readiness screen, and admin-only routes redirect back to `/`. Fails on
 * any 5xx `/api` response or non-benign console/page error.
 *
 * Same auth/renderer model as `auth-hub-smoke.spec.ts`: dev login exists only in
 * a Vite-DEV renderer; this self-skips on a production renderer.
 */

test.skip(
  process.env["PLAYWRIGHT_LOCAL_BACKEND"] !== "1",
  "Set PLAYWRIGHT_LOCAL_BACKEND=1 to run the real-backend non-admin smoke."
);

const DECK_OFFICER = ROLE_SCENARIOS.find((s) => s.role === "deck_officer")!;

test.describe("non-admin hub smoke @smoke", () => {
  test.setTimeout(90_000);

  test("deck officer reaches permitted routes and is redirected from admin-only routes", async ({
    page,
  }) => {
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

    await page.goto("/portal-login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const devUserButton = page.getByTestId("button-dev-login-user");
    const available = await devUserButton
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!available, "Non-admin smoke requires a dev renderer with dev login enabled.");
    await devUserButton.click();
    await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible({
      timeout: 15_000,
    });

    const failures: string[] = [];

    // Permitted routes render their expected screen.
    for (const route of DECK_OFFICER.startRoutes) {
      await test
        .step(`permitted ${route}`, async () => {
          await navigateWithinAuthenticatedSpa(page, route);
          await page.waitForLoadState("domcontentloaded");
          await hideDevPerfOverlay(page);
          const marker = expectedScreenTestId(route, { fallback: "universal-ops-shell" });
          await expect(page.getByTestId(marker), `${route} → ${marker}`).toBeVisible({
            timeout: 10_000,
          });
          await page.waitForTimeout(400);
        })
        .catch((err: unknown) => {
          failures.push(
            `${route}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
          );
        });
    }

    // Admin-only routes redirect a non-admin back to the command screen.
    for (const route of DECK_OFFICER.adminOnlyRedirectRoutes) {
      await test
        .step(`redirect ${route}`, async () => {
          await navigateWithinAuthenticatedSpa(page, route);
          await page.waitForTimeout(500);
          await expect(page, `${route} should redirect to /`).toHaveURL(/\/$/);
          await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible({
            timeout: 10_000,
          });
        })
        .catch((err: unknown) => {
          failures.push(
            `${route}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
          );
        });
    }

    expect(failures, `non-admin route failures:\n${failures.join("\n")}`).toEqual([]);
    expect(serverErrors, `5xx /api responses:\n${serverErrors.join("\n")}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  });
});
