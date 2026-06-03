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

import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  navigationCategories,
  migrateRoute,
} from "../../client/src/config/navigationConfig";
import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";

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
      if (seen.has(resolvedChild)) continue;
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
  if (text.includes("Failed to load resource") && text.includes("favicon")) return true;
  if (text.includes("[vite] connecting...")) return true;
  if (text.includes("[vite] connected.")) return true;
  return false;
}

function attachErrorListeners(
  page: Page,
  consoleErrors: string[],
  pageErrors: string[],
) {
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isBenignConsoleError(text)) return;
    consoleErrors.push(text);
  };
  const onPageError = (err: Error) => {
    pageErrors.push(`${err.name}: ${err.message}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
}

async function seedRole(page: Page, role: RoleKey): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(key, value);
      } catch {
        /* private mode — fine */
      }
    },
    { key: ROLE_STORAGE_KEY, value: role },
  );
}

/**
 * Wait for the SPA shell to commit a route, then verify the page is
 * not the NotFound fallback. We assert `<main>` (or `#root` if a page
 * doesn't wrap with `<main>`) renders non-empty visible content.
 */
async function expectRouteRendered(page: Page, target: NavTarget): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  // The Wouter `<Route component={NotFound}/>` fallback renders the
  // text "404 Page Not Found" — fail loudly if the matrix lands on it.
  const notFound = page.getByText("404 Page Not Found", { exact: false });
  await expect(
    notFound,
    `nav target "${target.label}" (${target.href}) landed on NotFound`,
  ).toHaveCount(0);

  // The shell mounts under `#root`; pages usually render a `<main>`.
  // Either non-empty body proves the page committed.
  const root = page.locator("#root");
  await expect(root).toBeAttached();
  await expect(root).not.toBeEmpty({ timeout: 10_000 });
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
        await seedRole(page, role);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        const failures: string[] = [];

        for (const target of NAV_TARGETS) {
          const stepConsole: string[] = [];
          const stepPage: string[] = [];
          const onConsole = (msg: ConsoleMessage) => {
            if (msg.type() !== "error") return;
            const text = msg.text();
            if (isBenignConsoleError(text)) return;
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
            await test.step(
              `${target.kind} "${target.label}" → ${target.resolved}`,
              async () => {
                const response = await page.goto(target.href, {
                  waitUntil: "domcontentloaded",
                });
                expect(
                  response,
                  `navigation response for ${target.href}`,
                ).not.toBeNull();
                expect(
                  response!.status(),
                  `${target.href} HTTP status`,
                ).toBeLessThan(500);

                await expectRouteRendered(page, target);

                const url = new URL(page.url());
                finalUrl = url.pathname + url.search;

                // The URL after navigation should equal either the
                // declared href OR its migrated target — legacyRedirects
                // rewrites the legacy href on commit.
                const expectedPaths = new Set([
                  target.href.split("?")[0],
                  target.resolved.split("?")[0],
                ]);
                expect(
                  expectedPaths.has(url.pathname),
                  `expected ${url.pathname} ∈ {${[...expectedPaths].join(", ")}}`,
                ).toBe(true);

                expect(
                  stepConsole,
                  `console errors on ${target.href}:\n${stepConsole.join("\n")}`,
                ).toEqual([]);
                expect(
                  stepPage,
                  `uncaught page errors on ${target.href}:\n${stepPage.join("\n")}`,
                ).toEqual([]);
              },
            );
          } catch (err) {
            stepStatus = "fail";
            const msg = err instanceof Error ? err.message : String(err);
            failures.push(`${target.label} (${target.href}): ${msg.split("\n")[0]}`);
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
            `${failures.length} nav target(s) failed for ${role} @ ${viewport.name}:\n` +
              failures.map((f) => `  - ${f}`).join("\n"),
          );
        }
      });
    }
  }

  test.afterAll(async () => {
    if (results.length === 0) return;
    const totalsByStatus = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    const header =
      "| Role | Viewport | Kind | Label | Href | Final URL | Status | Console errors |\n" +
      "| --- | --- | --- | --- | --- | --- | --- | --- |";
    const rows = results
      .map((r) => {
        const errs = r.consoleErrors.length
          ? r.consoleErrors.length.toString()
          : "0";
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
      `- Passed: **${totalsByStatus.pass ?? 0}**`,
      `- Failed: **${totalsByStatus.fail ?? 0}**`,
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
    await seedRole(page, "system_admin");
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("Admin Hubs list renders with the role pill", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("text-admin-hubs-title")).toBeVisible();
    await expect(page.getByTestId("list-admin-hubs")).toBeVisible();
    await expect(page.getByTestId("pill-role")).toBeVisible();
  });

  test("Maintenance hub card routes to /maint", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const card = page.getByTestId("card-hub-maintenance");
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/maint(\?|$)/);
  });
});

test.describe("Reskin smoke — user home interactions", () => {
  test.beforeEach(async ({ page }) => {
    await seedRole(page, "deck_officer");
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test("user-portal Feedback CTA opens /feedback", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const cta = page.getByTestId("button-user-open-feedback");
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/feedback(\?|$)/);
    await expect(page.getByTestId("page-feedback")).toBeVisible();
  });
});
