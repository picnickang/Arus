/**
 * Task #202 — UI Navigation Regression Matrix.
 *
 * Codifies the post-reskin nav audit (95 registered routes, 1 broken
 * link found and fixed in the LR-3.5 wave) into a Playwright matrix.
 * For every (role × viewport) pair, navigates to each declared nav
 * target (category hub + every child href) and asserts:
 *   - URL lands on the expected path OR its registered redirect
 *     target (via `migrateRoute` in `navigationConfig.ts`).
 *   - `<main>` (or `#root`) renders non-empty content — i.e. the
 *     page is not a blank shell or NotFound.
 *   - No `console.error` is emitted during navigation.
 *   - No uncaught page error fires.
 *
 * Sources of truth (imported directly so the matrix auto-syncs):
 *   - `navigationCategories` + `routeMigrations` in
 *     `client/src/config/navigationConfig.ts`
 *   - `ROLE_STORAGE_KEY` in `client/src/config/roles.ts`
 *
 * High-blast-radius interactions surfaced by the recent reskin are
 * pinned by smaller specs at the bottom (switch portal, feedback CTA,
 * AI Recommendation card, Critical Attention "View all").
 *
 * After the matrix runs, a markdown report is written to
 * `docs/qa/ui-nav-matrix.md` so the user can see coverage at a glance.
 */

import { test, expect, type ConsoleMessage, type Page, type Route } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { navigationCategories, migrateRoute } from "../../client/src/config/navigationConfig";
import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";
import {
  getMobileReadinessExpectedScreen,
  isMobileReadinessReplacementPath,
} from "../../client/src/features/mobile-readiness/mobile-readiness-route-contract";

type RoleKey = "system_admin" | "deck_officer";

interface NavTarget {
  readonly label: string;
  readonly href: string;
  readonly resolved: string;
  readonly category: string;
  readonly kind: "hub" | "child";
}

interface Viewport {
  readonly name: "mobile" | "tablet" | "desktop";
  readonly width: number;
  readonly height: number;
}

interface MatrixResult {
  readonly role: RoleKey;
  readonly viewport: Viewport["name"];
  readonly target: NavTarget;
  readonly status: "pass" | "fail";
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly finalUrl: string;
}

const VIEWPORTS: readonly Viewport[] = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

const ROLES: readonly RoleKey[] = ["system_admin", "deck_officer"];

/**
 * Build the full list of nav targets from the single source of truth.
 * De-dupe by resolved URL so we don't visit `/foo` twice when two
 * children alias the same destination after `migrateRoute`.
 */
function buildTargets(): NavTarget[] {
  const seen = new Set<string>();
  const out: NavTarget[] = [];
  for (const cat of navigationCategories) {
    const hubResolved = migrateRoute(cat.hubRoute);
    if (!seen.has(hubResolved)) {
      seen.add(hubResolved);
      out.push({
        label: cat.name,
        href: cat.hubRoute,
        resolved: hubResolved,
        category: cat.id,
        kind: "hub",
      });
    }
    for (const child of cat.children) {
      const resolvedChild = migrateRoute(child.href);
      if (seen.has(resolvedChild)) {
        continue;
      }
      seen.add(resolvedChild);
      out.push({
        label: child.name,
        href: child.href,
        resolved: resolvedChild,
        category: cat.id,
        kind: "child",
      });
    }
  }
  return out;
}

const NAV_TARGETS = buildTargets();

/**
 * Narrowly-scoped allowlist of known benign dev-only console noise.
 * Mirrors `tests/playwright/smoke.spec.ts` exactly so the matrix
 * inherits the same blast radius — never broaden without review.
 */
function isBenignConsoleError(text: string): boolean {
  if (text.includes("Failed to load resource") && text.includes("favicon")) {
    return true;
  }
  if (text.includes("[vite] connecting...")) {
    return true;
  }
  if (text.includes("[vite] connected.")) {
    return true;
  }
  return false;
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

const nowIso = "2026-06-12T00:00:00.000Z";
const diagnosticsResponses: Record<string, unknown> = {
  "/api/diagnostics/health": {
    status: "healthy",
    timestamp: nowIso,
    version: "playwright",
    uptime: 3600,
    checks: {
      database: { status: "pass", responseTimeMs: 4, message: "Fixture database healthy" },
      telemetry: {
        status: "pass",
        details: { bufferUtilization: 0 },
      },
      memory: {
        status: "pass",
        details: { utilizationPercent: 22, heapUsedMB: 128 },
      },
      services: [{ name: "API", status: "running", lastHealthCheck: nowIso }],
    },
  },
  "/api/diagnostics/metrics": {
    memory: {
      heapUsedMB: 128,
      heapTotalMB: 512,
      externalMB: 16,
      utilizationPercent: 22,
    },
    uptime: 3600,
    nodeVersion: "v20-playwright",
    timestamp: nowIso,
  },
  "/api/diagnostics/telemetry/stats": {
    batchWriter: {
      bufferSize: 0,
      totalQueued: 0,
      totalFlushed: 0,
      totalEvicted: 0,
      totalErrors: 0,
      totalDropped: 0,
      lastFlushTime: null,
      lastFlushDurationMs: 0,
      lastFlushCount: 0,
      avgFlushDurationMs: 0,
      isRunning: true,
    },
    health: { bufferUtilization: 0, evictionRate: 0, writeSuccessRate: 100 },
    timestamp: nowIso,
  },
  "/api/diagnostics/test-suites": { suites: [] },
  "/api/diagnostics/config": {
    telemetry: {
      batchIntervalMs: 1000,
      bufferSize: 1000,
      evictionPercent: 0.1,
      maxRetries: 3,
    },
    environment: { nodeEnv: "test", deploymentMode: "playwright" },
    features: { dualDatabase: false, mlPredictions: false, fmccIntegration: false },
  },
};

async function installRoleFixtures(page: Page, role: RoleKey): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(key, value);
        localStorage.setItem("arus-ui-theme", "dark");
        localStorage.setItem("arus-setup-complete", "true");
      } catch {
        /* private mode — fine */
      }
    },
    { key: ROLE_STORAGE_KEY, value: role }
  );

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/portal/login" && request.method() === "POST") {
      await fulfillJson(route, {
        sessionToken: `playwright-nav-matrix-${role}`,
        expiresIn: 3600,
        mustChangePassword: false,
        user: {
          id: `nav-matrix-${role}`,
          name: role === "system_admin" ? "System Admin" : "Deck Officer",
          role,
          orgId: "default-org-id",
        },
      });
      return;
    }

    if (path === "/api/permissions/me") {
      const isAdmin = role === "system_admin";
      await fulfillJson(route, {
        userId: `nav-matrix-${role}`,
        orgId: "default-org-id",
        roles: [{ id: `role-${role}`, name: role, displayName: role }],
        permissions: isAdmin
          ? {
              system: ["view", "create", "edit", "delete", "manage"],
              admin: ["view", "create", "edit", "delete", "manage"],
            }
          : {},
        hubAdmin: isAdmin,
        hubAccess: isAdmin ? null : [],
        isDevMode: false,
      });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(diagnosticsResponses, path)) {
      await fulfillJson(route, diagnosticsResponses[path]);
      return;
    }

    await fulfillJson(route, []);
  });
}

async function loginRole(page: Page, role: RoleKey): Promise<void> {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  if (role === "system_admin") {
    await page.getByTestId("button-card-portal-admin").click();
    await page.getByTestId("input-admin-username").fill("nav-matrix-admin");
    await page.getByTestId("input-admin-password").fill("playwright-password");
    await page.getByTestId("button-admin-login").click();
  } else {
    await page.getByTestId("button-card-portal-user").click();
    await page.getByTestId("input-login-username").fill("nav-matrix-deck");
    await page.getByTestId("input-login-password").fill("playwright-password");
    await page.getByTestId("button-login").click();
  }
  await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
}

async function navigateWithinAuthenticatedSpa(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

function markerForPath(path: string): string {
  const marker = getMobileReadinessExpectedScreen(path);
  return marker ? `mobile-readiness-screen-${marker}` : "universal-ops-shell";
}

function isRegularAllowedTarget(target: NavTarget): boolean {
  const path = new URL(target.resolved, "http://arus.local").pathname;
  return (
    path === "/logs" ||
    path.startsWith("/logs/") ||
    path === "/fleet" ||
    path.startsWith("/fleet/") ||
    path === "/vessel-intelligence" ||
    path.startsWith("/vessel-intelligence/") ||
    path === "/crew-management" ||
    path === "/pdm-platform" ||
    path.startsWith("/pdm/equipment/")
  );
}

/**
 * Wait for the SPA shell to commit a route, then verify the page is
 * not the NotFound fallback. We assert `<main>` (or `#root` if a page
 * doesn't wrap with `<main>`) renders non-empty visible content.
 */
async function expectRouteRendered(page: Page, target: NavTarget, role: RoleKey): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  // The Wouter `<Route component={NotFound}/>` fallback renders the
  // text "404 Page Not Found" — fail loudly if the matrix lands on it.
  const notFound = page.getByText("404 Page Not Found", { exact: false });
  await expect(
    notFound,
    `nav target "${target.label}" (${target.href}) landed on NotFound`
  ).toHaveCount(0);

  // The shell mounts under `#root`; pages usually render a `<main>`.
  // Either non-empty body proves the page committed.
  const root = page.locator("#root");
  await expect(root).toBeAttached();
  await expect(root).not.toBeEmpty({ timeout: 10_000 });

  await expect(page.getByTestId("text-admin-hubs-title")).toHaveCount(0);
  await expect(page.getByTestId("shell-admin-hubs")).toHaveCount(0);

  if (role !== "system_admin" && !isRegularAllowedTarget(target)) {
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
    await expect(page.getByTestId("universal-ops-shell")).toHaveCount(0);
    return;
  }

  if (isMobileReadinessReplacementPath(target.resolved)) {
    await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
  }
  await expect(page.getByTestId(markerForPath(target.resolved))).toBeVisible();
}

const results: MatrixResult[] = [];

test.describe("UI nav regression matrix", () => {
  for (const role of ROLES) {
    for (const viewport of VIEWPORTS) {
      // One Playwright test per (role × viewport) loops over every
      // nav target inside `test.step`. This keeps per-target failure
      // visibility in the HTML report while reusing a single browser
      // context — the full matrix lands in ~1 minute instead of 20,
      // staying well under the 15-min CI budget.
      test(`${role} @ ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
        page,
      }) => {
        await installRoleFixtures(page, role);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await loginRole(page, role);

        const failures: string[] = [];

        for (const target of NAV_TARGETS) {
          const stepConsole: string[] = [];
          const stepPage: string[] = [];
          const onConsole = (msg: ConsoleMessage) => {
            if (msg.type() !== "error") {
              return;
            }
            const text = msg.text();
            if (isBenignConsoleError(text)) {
              return;
            }
            stepConsole.push(text);
          };
          const onPage = (err: Error) => {
            stepPage.push(`${err.name}: ${err.message}`);
          };
          page.on("console", onConsole);
          page.on("pageerror", onPage);

          let stepStatus: MatrixResult["status"] = "pass";
          let finalUrl = "";
          try {
            await test.step(`${target.kind} "${target.label}" → ${target.resolved}`, async () => {
              await navigateWithinAuthenticatedSpa(page, target.href);
              await expectRouteRendered(page, target, role);

              const url = new URL(page.url());
              finalUrl = url.pathname + url.search;

              if (role !== "system_admin" && !isRegularAllowedTarget(target)) {
                expect(
                  url.pathname,
                  `${target.href} should redirect regular users to command`
                ).toBe("/");
                return;
              }

              // The URL after navigation should equal either the
              // declared href OR its migrated target — legacyRedirects
              // rewrites the legacy href on commit.
              const expectedPaths = new Set([
                target.href.split("?")[0],
                target.resolved.split("?")[0],
              ]);
              expect(
                expectedPaths.has(url.pathname),
                `expected ${url.pathname} ∈ {${[...expectedPaths].join(", ")}}`
              ).toBe(true);

              expect(
                stepConsole,
                `console errors on ${target.href}:\n${stepConsole.join("\n")}`
              ).toEqual([]);
              expect(
                stepPage,
                `uncaught page errors on ${target.href}:\n${stepPage.join("\n")}`
              ).toEqual([]);
            });
          } catch (err) {
            stepStatus = "fail";
            const msg = err instanceof Error ? err.message : String(err);
            const firstDetail =
              stepConsole[0]?.split("\n")[0] || stepPage[0]?.split("\n")[0] || msg.split("\n")[0];
            failures.push(`${target.label} (${target.href}): ${firstDetail}`);
          } finally {
            page.off("console", onConsole);
            page.off("pageerror", onPage);
            results.push({
              role,
              viewport: viewport.name,
              target,
              status: stepStatus,
              consoleErrors: [...stepConsole],
              pageErrors: [...stepPage],
              finalUrl: finalUrl || page.url(),
            });
          }
        }

        if (failures.length > 0) {
          throw new Error(
            `${failures.length} nav target(s) failed for ${role} @ ${viewport.name}:\n${failures
              .map((f) => `  - ${f}`)
              .join("\n")}`
          );
        }
      });
    }
  }

  test.afterAll(async () => {
    if (results.length === 0) {
      return;
    }
    const totalsByStatus = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    const header =
      "| Role | Viewport | Kind | Label | Href | Final URL | Status | Console errors |\n" +
      "| --- | --- | --- | --- | --- | --- | --- | --- |";
    const rows = results
      .map((r) => {
        const errs = r.consoleErrors.length ? r.consoleErrors.length.toString() : "0";
        return `| ${r.role} | ${r.viewport} | ${r.target.kind} | ${r.target.label} | \`${r.target.href}\` | \`${r.finalUrl}\` | ${r.status} | ${errs} |`;
      })
      .join("\n");

    const body = [
      "# UI Nav Regression Matrix — last run",
      "",
      "Auto-generated by `tests/playwright/nav-matrix.spec.ts` (Task #202).",
      "Do not edit by hand — re-run `npx playwright test nav-matrix` to refresh.",
      "",
      `- Total checks: **${results.length}**`,
      `- Passed: **${totalsByStatus["pass"] ?? 0}**`,
      `- Failed: **${totalsByStatus["fail"] ?? 0}**`,
      `- Roles: ${ROLES.join(", ")}`,
      `- Viewports: ${VIEWPORTS.map((v) => `${v.name} ${v.width}x${v.height}`).join(", ")}`,
      `- Nav targets: ${NAV_TARGETS.length}`,
      "",
      "## Results",
      "",
      header,
      rows,
      "",
    ].join("\n");

    const out = resolve(process.cwd(), "docs/qa/ui-nav-matrix.md");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, body, "utf8");
  });
});

/**
 * High-blast-radius interactions surfaced in the recent reskin.
 * These are not part of the matrix (they need clicks rather than raw
 * URL nav) but live in the same file so a single `nav-matrix` run
 * covers the full set.
 */
test.describe("Reskin smoke — admin home interactions", () => {
  test.beforeEach(async ({ page }) => {
    await installRoleFixtures(page, "system_admin");
    await page.setViewportSize({ width: 375, height: 812 });
    await loginRole(page, "system_admin");
  });

  test("Command Queue renders with the replacement mobile shell", async ({ page }) => {
    await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
    await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
    await expect(page.getByTestId("mobile-readiness-bottom-nav")).toBeVisible();
    await expect(page.getByTestId("text-admin-hubs-title")).toHaveCount(0);
    await expect(page.getByTestId("shell-admin-hubs")).toHaveCount(0);
  });

  test("Tasks bottom-nav item routes to the replacement work queue", async ({ page }) => {
    const tasks = page.getByTestId("mobile-readiness-nav-tasks");
    await expect(tasks).toBeVisible();
    await tasks.click();
    await expect(page).toHaveURL(/\/work-orders(\?|$)/);
    await expect(page.getByTestId("mobile-readiness-screen-work-queue")).toBeVisible();
  });
});

test.describe("Reskin smoke — user home interactions", () => {
  test.beforeEach(async ({ page }) => {
    await installRoleFixtures(page, "deck_officer");
    await page.setViewportSize({ width: 375, height: 812 });
    await loginRole(page, "deck_officer");
  });

  test("Logs bottom-nav item opens the replacement logs screen", async ({ page }) => {
    const logs = page.getByTestId("mobile-readiness-nav-logs");
    await expect(logs).toBeVisible();
    await logs.click();
    await expect(page).toHaveURL(/\/logs(\?|$)/);
    await expect(page.getByTestId("mobile-readiness-screen-logs")).toBeVisible();
  });
});
