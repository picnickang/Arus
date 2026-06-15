import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * WCAG color-contrast gate across all four brilliances — light / dark / bridge
 * (night) / daylight — for both the admin ops chrome (/analytics) and the
 * mobile-readiness surface (/fleet), so the night-dimming on the phone screens
 * is held to the same contrast bar as the desktop chrome.
 *
 * axe `color-contrast` reads computed CSS colors (not rendered pixels), so the
 * result is deterministic across environments — committed baselines are valid
 * for CI. Both baselines ratchet (monotonic-decrease); regenerate with
 *   AXE_CONTRAST_UPDATE=1 npx playwright test axe-contrast
 */

const THEMES = ["light", "dark", "bridge", "daylight"] as const;
const OPS_BASELINE_PATH = path.resolve("tests/playwright/axe-contrast-baseline.json");
const MOBILE_BASELINE_PATH = path.resolve("tests/playwright/axe-contrast-mobile-baseline.json");
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

async function installFixtures(page: Page, theme: string): Promise<void> {
  await page.addInitScript(
    ([t]) => {
      localStorage.setItem("arus-user-role", "super_admin");
      localStorage.setItem("arus-ui-theme", t);
      localStorage.setItem("arus-setup-complete", "true");
    },
    [theme] as const
  );
  await page.route("**/api/**", async (route: Route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/api/portal/login" && route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessionToken: "t", expiresIn: 3600, mustChangePassword: false, user: { id: "u", name: "Admin", role: "super_admin" } }),
      });
    }
    if (p === "/api/permissions/me") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ userId: "u", orgId: "org", roles: [{ id: "r", name: "super_admin", displayName: "Super Admin" }], permissions: {}, hubAdmin: true, hubAccess: null, isDevMode: false }),
      });
    }
    if (p === "/api/attention/items") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ATTENTION) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function submitLogin(page: Page): Promise<void> {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").waitFor({ state: "visible" });
  await page.getByTestId("input-admin-username").fill("admin");
  await page.getByTestId("input-admin-password").fill("password");
  await page.getByTestId("button-admin-login").click();
  await page.waitForTimeout(1500);
}

async function gotoOpsChrome(page: Page): Promise<void> {
  await submitLogin(page);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/analytics");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("region", { name: /persistent operational status rail/i })).toBeVisible({ timeout: 15000 });
}

async function gotoMobileFleet(page: Page): Promise<void> {
  await submitLogin(page);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/fleet");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible({ timeout: 15000 });
}

async function contrastAcrossThemes(
  browser: Browser,
  navigate: (page: Page) => Promise<void>
): Promise<{ perTheme: Record<string, number>; total: number }> {
  const perTheme: Record<string, number> = {};
  let total = 0;
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: MOBILE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await installFixtures(page, theme);
    await navigate(page);
    const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    perTheme[theme] = results.violations.reduce((n, v) => n + v.nodes.length, 0);
    total += perTheme[theme];
    await context.close();
  }
  return { perTheme, total };
}

function assertWithinBaseline(baselinePath: string, surface: string, perTheme: Record<string, number>, total: number): void {
  if (process.env.AXE_CONTRAST_UPDATE === "1") {
    const body = JSON.stringify(
      {
        _comment: `WCAG color-contrast violation nodes on ${surface} across the 4 themes. Ratchets down only: AXE_CONTRAST_UPDATE=1 to regenerate after intentional reductions.`,
        maxContrastViolations: total,
        perTheme,
      },
      null,
      2
    );
    fs.writeFileSync(baselinePath, `${body}\n`);
    console.info(`[axe-contrast] ${surface} baseline written: ${total}`);
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  expect(
    total,
    `${surface} color-contrast violations (${total}) exceed baseline (${baseline.maxContrastViolations}). Per theme: ${JSON.stringify(perTheme)}`
  ).toBeLessThanOrEqual(baseline.maxContrastViolations);
}

test("ops chrome meets WCAG color-contrast across the 4 themes (ratchet) @visual @mobile", async ({ browser }) => {
  const { perTheme, total } = await contrastAcrossThemes(browser, gotoOpsChrome);
  console.info(`axe color-contrast (ops chrome): ${JSON.stringify(perTheme)} total=${total}`);
  assertWithinBaseline(OPS_BASELINE_PATH, "/analytics", perTheme, total);
});

test("mobile-readiness screens meet WCAG color-contrast across the 4 themes (ratchet) @visual @mobile", async ({ browser }) => {
  const { perTheme, total } = await contrastAcrossThemes(browser, gotoMobileFleet);
  console.info(`axe color-contrast (mobile-readiness): ${JSON.stringify(perTheme)} total=${total}`);
  assertWithinBaseline(MOBILE_BASELINE_PATH, "/fleet", perTheme, total);
});
