import { expect, test } from "@playwright/test";

import {
  installRoleFixtures,
  isBenignConsoleError,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { buildNavTargets } from "../helpers/hub-targets";

/**
 * Concurrent-context stress (`@stress`) — ADVISORY. Spin up N logged-in browser
 * contexts and drive a nav loop in all of them simultaneously to surface
 * shared-state / cache races.
 *
 * PASS criterion is STABILITY + ZERO errors per context, NOT per-context heap:
 * all contexts share ONE chromium process, so heap is aggregate and a
 * per-context assertion would be meaningless. This also isn't OS-level
 * parallelism — it's event-loop interleaving in one process, which is what
 * surfaces races.
 */

const CONTEXTS = 4;
const HOPS = 15;

test.describe("concurrent-context stress @stress", () => {
  test("N logged-in contexts navigating concurrently stay healthy", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Stress lane targets chromium.");
    test.setTimeout(180_000);

    const targets = buildNavTargets().slice(0, HOPS);

    const driveOne = async (index: number): Promise<string[]> => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isBenignConsoleError(msg.text())) {
          errors.push(`[ctx${index}] ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) => {
        const text = `${err.name}: ${err.message}`;
        if (!isBenignConsoleError(text)) {
          errors.push(`[ctx${index}] ${text}`);
        }
      });

      await installRoleFixtures(page, { role: "system_admin", hidePerfOverlay: true });
      await loginRole(page, "system_admin");
      for (const target of targets) {
        await navigateWithinAuthenticatedSpa(page, target.href);
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(500);
      await expect(page.locator("#root")).not.toBeEmpty();
      await expect(page.getByText("404 Page Not Found", { exact: false })).toHaveCount(0);
      await context.close();
      return errors;
    };

    const perContext = await Promise.all(Array.from({ length: CONTEXTS }, (_, i) => driveOne(i)));
    const allErrors = perContext.flat();
    expect(
      allErrors,
      `errors across ${CONTEXTS} concurrent contexts:\n${allErrors.join("\n")}`
    ).toEqual([]);
  });
});
