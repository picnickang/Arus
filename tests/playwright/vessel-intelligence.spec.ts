import { expect, test, type Page, type Route } from "@playwright/test";
import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";

async function installVesselFixtures(page: Page, role = "super_admin"): Promise<void> {
  const adminCapable = role === "super_admin" || role === "system_admin";
  await page.addInitScript(
    ({ key, roleName }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, roleName);
      localStorage.setItem("arus-ui-theme", "dark");
      localStorage.setItem("arus-setup-complete", "true");
    },
    { key: ROLE_STORAGE_KEY, roleName: role }
  );

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/portal/login" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionToken: `playwright-${role}`,
          expiresIn: 28800,
          mustChangePassword: false,
          user: { id: `user-${role}`, name: role, role },
        }),
      });
      return;
    }

    if (path === "/api/permissions/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userId: `playwright-${role}`,
          orgId: "org-playwright",
          roles: [{ id: `role-${role}`, name: role, displayName: role }],
          permissions: adminCapable ? { vessels: { view: true }, work_orders: { view: true } } : {},
          hubAdmin: adminCapable,
          hubAccess: adminCapable ? null : [],
          isDevMode: false,
        }),
      });
      return;
    }

    if (path.endsWith("/media")) {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 895 420"><rect width="895" height="420" fill="#eff6ff"/></svg>',
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function login(page: Page): Promise<void> {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").fill("playwright-admin");
  await page.getByTestId("input-admin-password").fill("playwright-password");
  await page.getByTestId("button-admin-login").click();
  await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
}

async function navigateWithinAuthenticatedSpa(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    overflow.scrollWidth,
    `page should not overflow horizontally: ${JSON.stringify(overflow)}`
  ).toBeLessThanOrEqual(overflow.viewportWidth + 2);
}

test.describe("Vessel Intelligence replacement workflow", () => {
  test("fleet triage cards open the replacement vessel detail screen", async ({ page }) => {
    await installVesselFixtures(page);
    await login(page);
    await navigateWithinAuthenticatedSpa(page, "/fleet");

    await expect(page.getByTestId("mobile-readiness-screen-fleet")).toBeVisible();
    await expect(page.getByTestId("universal-ops-shell")).toHaveCount(0);
    await expect(page.getByTestId("fleet-vessel-card-mv-atlas")).toBeVisible();

    await page.getByTestId("fleet-vessel-card-mv-atlas").click();
    await expect(page).toHaveURL(/\/vessel-intelligence\/mv-atlas\/overview$/);
    await expect(page.getByTestId("mobile-readiness-screen-vessel-detail")).toBeVisible();
    await expect(page.getByText("Vessel Snapshot")).toBeVisible();
  });

  test("/vessel-intelligence/fleet redirects to the canonical fleet replacement", async ({
    page,
  }) => {
    await installVesselFixtures(page);
    await login(page);
    await navigateWithinAuthenticatedSpa(page, "/vessel-intelligence/fleet");

    await expect(page).toHaveURL(/\/fleet$/);
    await expect(page.getByTestId("mobile-readiness-screen-fleet")).toBeVisible();
  });

  test("vessel diagram routes render the board-aligned diagram screen", async ({ page }) => {
    await installVesselFixtures(page);
    await login(page);
    await navigateWithinAuthenticatedSpa(page, "/vessel-intelligence/mv-atlas/diagrams");

    await expect(page.getByTestId("mobile-readiness-screen-vessel-diagram")).toBeVisible();
    await expect(page.getByText("Vessel diagram")).toBeVisible();
    await expect(page.getByText("Side elevation")).toBeVisible();
  });

  test("PdM queue opens asset case and telemetry evidence screens", async ({ page }) => {
    await installVesselFixtures(page);
    await login(page);
    await navigateWithinAuthenticatedSpa(page, "/pdm-platform");

    await expect(page.getByTestId("mobile-readiness-screen-pdm-queue")).toBeVisible();
    await page.getByTestId("pdm-risk-port-generator").click();
    await expect(page).toHaveURL(/\/pdm\/equipment\/port-generator$/);
    await expect(page.getByTestId("mobile-readiness-screen-pdm-asset-case")).toBeVisible();

    await page.getByTestId("link-pdm-telemetry-advanced").click();
    await expect(page).toHaveURL(/\/pdm\/equipment\/port-generator\/telemetry$/);
    await expect(page.getByTestId("mobile-readiness-screen-pdm-telemetry")).toBeVisible();
  });

  test("mobile fleet and vessel detail do not horizontally overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVesselFixtures(page);
    await login(page);
    await navigateWithinAuthenticatedSpa(page, "/fleet");

    await expect(page.getByTestId("mobile-readiness-screen-fleet")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByTestId("fleet-vessel-card-mv-atlas").click();
    await expect(page.getByTestId("mobile-readiness-screen-vessel-detail")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
