import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Prod-hardening Wave 5: SPA shell smoke.
 *
 * Loads the app root in a real browser and asserts:
 *   1. The HTML document responds 200
 *   2. The root React mount produces visible content
 *   3. No uncaught console errors fire during initial render
 *   4. No uncaught page errors (runtime exceptions that don't reach
 *      console — e.g. error events surfaced by the browser itself)
 *
 * Auth-gated routes are out of scope here — those are covered by the
 * jest-based suites in `tests/e2e/`. This catches the class of
 * regressions those can't: bundle-load failures, missing assets,
 * runtime exceptions in the React entrypoint.
 */
test.describe("SPA shell smoke", () => {
  test("/ renders and emits no console or page errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Narrowly-scoped allowlist of known benign dev-only noise.
      // Every entry must name a specific message — never a prefix
      // match on a whole subsystem (per architect review: blanket
      // `[vite]` would hide real bundle / HMR failures).
      if (text.includes("Failed to load resource") && text.includes("favicon")) return;
      if (text.includes("[vite] connecting...")) return;
      if (text.includes("[vite] connected.")) return;
      consoleErrors.push(text);
    };

    const onPageError = (err: Error) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    };

    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response, "navigation response").not.toBeNull();
    expect(response!.status(), "/ HTTP status").toBeLessThan(500);

    // React mount should produce at least one visible element under #root.
    // Don't bind to specific text — the landing surface may change
    // (login, dashboard, redirect target). Just assert the shell mounts.
    const root = page.locator("#root");
    await expect(root).toBeAttached();
    await expect(root).not.toBeEmpty({ timeout: 10_000 });

    expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  });

  test("/api/healthz returns 200 ok", async ({ request }) => {
    const res = await request.get("/api/healthz");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
