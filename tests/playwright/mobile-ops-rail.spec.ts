import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The persistent Ops Status Rail on the MOBILE-READINESS surface (P0).
 *
 * The admin ops shell mounts its own rail; these screens (/fleet, /work-orders,
 * /crew-management, …) are a different shell, so the rail is mounted globally in
 * App.tsx and docks just above the mobile bottom nav. It is `hideWhenIdle`, so
 * it surfaces only for a risk / queued outbox / offline state — exactly the
 * "critical items never scroll off-screen" requirement.
 *
 * Self-contained fixtures: a session + one critical attention item, so the rail
 * renders its risk chip on a mobile-readiness route.
 */

const ROLE_KEY = "arus-user-role";
const MOBILE = { width: 390, height: 844 };
const NAV_PX = 64; // mobile bottom nav is h-16

const ATTENTION = {
  generatedAt: new Date().toISOString(),
  queues: [],
  items: [
    {
      id: "ai-1",
      title: "Main engine DE vibration trending high",
      source: "PdM",
      whyItMatters: "x",
      recommendedAction: "Inspect",
      owner: "Eng",
      due: "Before handover",
      href: "/pdm-platform",
      severity: "critical",
    },
  ],
  handover: {
    openAttentionItems: 4,
    criticalItems: 1,
    blockedJobs: 0,
    waitingOnParts: 0,
    readyForCloseout: 0,
    openWorkOrders: 2,
    lowStockParts: 0,
    suggestedSummary: [],
  },
  sources: {},
};

async function installFixtures(page: Page, theme: "light" | "bridge"): Promise<void> {
  await page.addInitScript(
    ([roleKey, t]) => {
      localStorage.setItem(roleKey, "super_admin");
      localStorage.setItem("arus-ui-theme", t);
      localStorage.setItem("arus-setup-complete", "true");
    },
    [ROLE_KEY, theme] as const
  );
  await page.route("**/api/**", async (route: Route) => {
    const p = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (p === "/api/portal/login" && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionToken: "t",
          expiresIn: 3600,
          mustChangePassword: false,
          user: { id: "u", name: "Admin", role: "super_admin" },
        }),
      });
    }
    if (p === "/api/permissions/me") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userId: "u",
          orgId: "org",
          roles: [{ id: "r", name: "super_admin", displayName: "Super Admin" }],
          permissions: {},
          hubAdmin: true,
          hubAccess: null,
          isDevMode: false,
        }),
      });
    }
    if (p === "/api/attention/items") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ATTENTION) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

function railRegion(page: Page) {
  return page.getByRole("region", { name: /persistent operational status rail/i });
}

async function loginToMobileRoute(page: Page, route = "/fleet") {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").waitFor({ state: "visible" });
  await page.getByTestId("input-admin-username").fill("admin");
  await page.getByTestId("input-admin-password").fill("password");
  await page.getByTestId("button-admin-login").click();
  await page.waitForTimeout(1500);
  // In-SPA navigation to a mobile-readiness replacement route (its own shell).
  await page.evaluate((r) => {
    window.history.pushState({}, "", r);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
  await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible({ timeout: 15000 });
}

test.describe("Mobile ops rail @mobile @visual", () => {
  test.use({ viewport: MOBILE, hasTouch: true, isMobile: true });

  test("docks above the bottom nav and shows the risk chip", async ({ page }) => {
    await installFixtures(page, "light");
    await loginToMobileRoute(page);
    const rail = railRegion(page);
    // The rail renders the OpenBridge IEC alert symbol for the critical risk.
    await expect(rail.locator("obi-alert-category-a")).toBeVisible();
    // Docked at the bottom: its lower edge sits at (or above) the nav top edge,
    // and it lives in the lower half of the viewport — i.e. it does not scroll.
    const box = await rail.boundingBox();
    expect(box).not.toBeNull();
    const bottomEdge = (box?.y ?? 0) + (box?.height ?? 0);
    expect(box?.y ?? 0, "rail is bottom-docked").toBeGreaterThan(MOBILE.height / 2);
    expect(bottomEdge, "rail sits above the bottom nav").toBeLessThanOrEqual(MOBILE.height - NAV_PX + 2);
    // Action target stays gloved-friendly (>=44px).
    const btn = await rail.getByRole("button").first().boundingBox();
    expect(btn?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: "test-results/mobile-rail-light.png" });
  });

  test("dims for night under the bridge theme", async ({ page }) => {
    await installFixtures(page, "bridge");
    await loginToMobileRoute(page);
    const rail = railRegion(page);
    const bg = await rail.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = (bg.match(/\d+/g) ?? ["255", "255", "255"]).map(Number);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(luminance, `rail bg ${bg} should be dark (night-vision) in the bridge theme`).toBeLessThan(60);
    await expect(page.locator("html")).toHaveAttribute("data-obc-theme", "night");
    await page.screenshot({ path: "test-results/mobile-rail-bridge.png" });
  });

  test("surfaces when connectivity drops (offline)", async ({ page, context }) => {
    await installFixtures(page, "light");
    await loginToMobileRoute(page);
    const rail = railRegion(page);
    await context.setOffline(true);
    await expect(rail.getByText(/offline/i)).toBeVisible({ timeout: 10000 });
    await context.setOffline(false);
  });

  test("exposes a reachable OpenBridge brilliance control in the mobile header (no 360px overflow)", async ({ page }) => {
    await installFixtures(page, "light");
    await page.setViewportSize({ width: 360, height: 800 });
    await loginToMobileRoute(page, "/work-orders");
    const trigger = page.getByTestId("brilliance-control");
    await expect(trigger).toBeVisible();
    // Gloved-friendly target.
    const tbox = await trigger.boundingBox();
    expect(tbox?.height ?? 0).toBeGreaterThanOrEqual(44);
    // The header control must not push the narrow layout into horizontal scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, "no horizontal overflow at 360px with the header brilliance control").toBeLessThanOrEqual(1);
    // Opens the OpenBridge brilliance menu...
    await trigger.click();
    const menu = page.locator("obc-brilliance-menu");
    await expect(menu).toBeVisible();
    await page.screenshot({ path: "test-results/mobile-header-theme.png" });
    // ...and choosing the night palette switches to the bridge (night-vision) theme.
    await menu.evaluate((el) =>
      el.dispatchEvent(
        new CustomEvent("palette-changed", { detail: { value: "night" }, bubbles: true, composed: true })
      )
    );
    await expect(page.locator("html")).toHaveAttribute("data-obc-theme", "night");
  });

  test("the header menu button opens a working navigation drawer", async ({ page }) => {
    await installFixtures(page, "light");
    await loginToMobileRoute(page, "/fleet");
    const trigger = page.getByTestId("mobile-readiness-menu-trigger");
    await expect(trigger).toBeVisible();
    const tbox = await trigger.boundingBox();
    expect(tbox?.height ?? 0).toBeGreaterThanOrEqual(44);
    // Previously a dead control; it must now actually open the nav drawer.
    await trigger.click();
    const drawer = page.getByTestId("mobile-readiness-nav-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-testid^='mobile-readiness-drawer-']").first()).toBeVisible();
    await expect(drawer).toHaveAttribute("data-state", "open");
    await page.waitForTimeout(450); // let the slide-in settle for the capture
    await page.screenshot({ path: "test-results/mobile-nav-drawer.png" });
  });

  test("the profile screen exposes real navigation, not placeholder buttons", async ({ page }) => {
    await installFixtures(page, "light");
    await loginToMobileRoute(page, "/profile");
    await expect(page.getByTestId("profile-identity")).toBeVisible();
    // Quick actions are real wouter links to existing routes (were dead buttons).
    const settings = page.getByTestId("profile-link-settings");
    await expect(settings).toHaveAttribute("href", "/system");
    const box = await settings.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/mobile-profile.png" });
  });
});
