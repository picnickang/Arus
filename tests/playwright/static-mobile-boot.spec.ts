import { expect, test, type ConsoleMessage } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe("static mobile boot", () => {
  test("built app mounts meaningful content on mobile without runtime errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() !== "error") {
        return;
      }
      const text = msg.text();
      if (text.includes("Failed to load resource") && text.includes("favicon")) {
        return;
      }
      if (text.includes("Failed to load resource") && text.includes("401 (Unauthorized)")) {
        return;
      }
      consoleErrors.push(text);
    });
    page.on("pageerror", (err: Error) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    });

    await page.setViewportSize(MOBILE_VIEWPORT);
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response, "navigation response").not.toBeNull();
    expect(response!.status(), "/ HTTP status").toBeLessThan(500);
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect(page.locator("body")).toContainText(/ARUS|Portal|Sign In|Admin Hubs/i, {
      timeout: 10_000,
    });
    await expect(page.locator("body")).not.toHaveText(/^\s*$/);

    expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  });
});
