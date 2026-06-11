import { expect, test } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.skip(
  process.env["PLAYWRIGHT_LOCAL_BACKEND"] !== "1",
  "Set PLAYWRIGHT_LOCAL_BACKEND=1 to run this opt-in real-backend mobile smoke."
);

async function expectNotShellOnly(page: import("@playwright/test").Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const markers = [
          "[data-testid='page-crew-management']",
          "[data-testid='button-create-work-order']",
          "[data-testid='analytics-hub']",
          "[data-testid='permission-gate-loading']",
          "[data-testid='permission-gate-error']",
          "[data-testid='permission-gate-denied']",
        ];
        const bodyText = document.body.innerText.trim();
        return (
          markers.some((selector) => document.querySelector(selector)) ||
          ["Data table", "No Work Orders Found"].some((text) => bodyText.includes(text))
        );
      },
      undefined,
      { timeout: 3_000 }
    )
    .catch(() => undefined);

  const state = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="universal-ops-shell"]');
    const markers = [
      "[data-testid='page-crew-management']",
      "[data-testid='button-create-work-order']",
      "[data-testid='analytics-hub']",
      "[data-testid='permission-gate-loading']",
      "[data-testid='permission-gate-error']",
      "[data-testid='permission-gate-denied']",
    ];
    const marker = markers.find((selector) => document.querySelector(selector));
    const bodyText = document.body.innerText.trim();
    const textMarker = ["Data table", "No Work Orders Found"].find((text) =>
      bodyText.includes(text)
    );
    return {
      hasShell: Boolean(shell),
      marker: marker ?? textMarker,
      text: bodyText.slice(0, 500),
    };
  });

  expect(
    state.marker,
    `mobile route should render body content or a visible gate state: ${JSON.stringify(state)}`
  ).toBeTruthy();
}

test.describe("local backend mobile smoke", () => {
  test.setTimeout(90_000);

  test("dev admin can reach core mobile admin routes without shell-only bodies", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/portal-login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const devAdminButton = page.getByTestId("button-dev-login-admin");
    const devLoginAvailable = await devAdminButton
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(
      !devLoginAvailable,
      "Real-backend mobile smoke requires a dev renderer with dev login enabled; production renderer intentionally hides it."
    );
    await devAdminButton.click();
    await expect(page.getByTestId("shell-admin-hubs")).toBeVisible({ timeout: 10_000 });

    const routes = ["/crew-management", "/work-orders", "/analytics"] as const;

    for (const path of routes) {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await expect(page.getByTestId("universal-ops-shell")).toBeVisible({ timeout: 10_000 });
      await expectNotShellOnly(page);
    }
  });
});
