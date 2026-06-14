import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Bridge-condition tests for the Persistent Ops Status Rail (mounted in M1):
 * night-vision dimming, gloved touch targets, and offline indication.
 *
 * Self-contained fixtures (deterministic): a super-admin session + a single
 * critical attention item, so the rail renders its risk / handover / mode chips
 * on the UniversalOpsShell hub route (/analytics).
 */

const ROLE_KEY = "arus-user-role";
const MOBILE = { width: 390, height: 844 };

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

async function loginToRail(page: Page) {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").waitFor({ state: "visible" });
  await page.getByTestId("input-admin-username").fill("admin");
  await page.getByTestId("input-admin-password").fill("password");
  await page.getByTestId("button-admin-login").click();
  await page.waitForTimeout(1500);
  // In-SPA navigation to a hub route that renders the ops shell + status rail.
  await page.evaluate(() => {
    window.history.pushState({}, "", "/analytics");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const rail = page.getByRole("region", { name: /persistent operational status rail/i });
  await expect(rail).toBeVisible({ timeout: 15000 });
  return rail;
}

test.describe("Bridge conditions @mobile @visual", () => {
  test.use({ viewport: MOBILE, hasTouch: true, isMobile: true });

  test("ops rail dims for night in the bridge theme", async ({ page }) => {
    await installFixtures(page, "bridge");
    const rail = await loginToRail(page);
    const bg = await rail.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = (bg.match(/\d+/g) ?? ["255", "255", "255"]).map(Number);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(luminance, `rail background ${bg} should be dark (night-vision) in the bridge theme`).toBeLessThan(60);
    // The risk chip renders the OpenBridge IEC alert symbol (M2 Phase A icon adoption).
    await expect(rail.locator("obi-alert-category-a")).toBeVisible();
  });

  test("rail action targets are >=44px for gloved use", async ({ page }) => {
    await installFixtures(page, "light");
    const rail = await loginToRail(page);
    const box = await rail.getByRole("button").first().boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("rail shows an Offline indicator when connectivity drops", async ({ page, context }) => {
    await installFixtures(page, "light");
    const rail = await loginToRail(page);
    await context.setOffline(true);
    await expect(rail.getByText(/offline/i)).toBeVisible({ timeout: 10000 });
    await context.setOffline(false);
  });
});
