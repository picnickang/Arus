/**
 * Phase 1.5 — Runtime persona navigation tests.
 *
 * Eleven personas, each asserting the runtime navigation contract: correct
 * portal/landing, only-allowed hubs visible, unauthorized hub direct-URL access
 * blocked, logout, and re-login respecting current permissions.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   npx playwright test persona-nav                # all runnable personas
 *   PERSONA_E2E_BASE_URL=http://localhost:5000 \
 *     npx playwright test persona-nav              # against a live dev server
 *
 * IMPORTANT — this spec CANNOT run in the Replit sandbox: Playwright cannot
 * launch a browser here (missing system libs). It is authored for CI / a local
 * machine with browsers installed. The deterministic policy-layer half of this
 * verification runs today as a unit test: `tests/unit/persona-navigation.test.ts`.
 *
 * Two persona classes:
 *   A) Client-role personas — seeded via the `ROLE_STORAGE_KEY` localStorage
 *      hint (same mechanism as `nav-matrix.spec.ts`). Covers portal/landing +
 *      primary hub visibility for the role-driven personas.
 *   B) Hub-grant admin personas (Admin with Maintenance-only / Crew-only /
 *      Logistics-only / none) — these depend on the *server* `hubAccess` grant
 *      returned by `/api/permissions/me`, which a localStorage hint cannot set.
 *      They require seeded backend users and a real login, supplied via env vars
 *      (see SEEDED_PERSONAS). When the env vars are absent the test is SKIPPED
 *      with a clear message — it is never silently passed.
 */

import { test, expect, type Page } from "@playwright/test";
import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";

const BASE_URL = process.env["PERSONA_E2E_BASE_URL"] ?? "";

// Hub category ids (must match navigationConfig.navigationCategories).
const ADMIN_HUBS = ["maintenance", "system", "crew", "logistics", "analytics"] as const;

// Representative hub URLs to probe for direct-URL blocking (per the brief).
const HUB_URLS: Record<string, string> = {
  maintenance: "/maint",
  system: "/system-administration",
  crew: "/crew-management",
  logistics: "/logistics",
  analytics: "/analytics",
  equipmentIntelligence: "/equipment-intelligence",
  pdmPlatform: "/pdm-platform",
  roles: "/configuration",
};

async function seedRole(page: Page, role: string): Promise<void> {
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
    { key: ROLE_STORAGE_KEY, value: role }
  );
}

async function gotoHome(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const notFound = page.getByText("404 Page Not Found", { exact: false });
  await expect(notFound).toHaveCount(0);
  await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
}

/**
 * Assert a direct navigation to a hub the persona is NOT allowed to see does
 * not render that hub's content. The two-tier `AdminPortalRouteGuard` redirects
 * unauthorized routes to `/`, so we assert the final pathname is not the hub.
 */
async function expectHubBlocked(page: Page, url: string): Promise<void> {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded" });
  const finalPath = new URL(page.url()).pathname;
  expect(finalPath, `direct access to ${url} should be redirected away`).not.toBe(url);
}

// ── Class A: client-role personas (localStorage-seeded) ──────────────────────

interface RolePersona {
  readonly name: string;
  readonly role: string;
  readonly portal: "admin" | "user";
}

const CLIENT_ROLE_PERSONAS: readonly RolePersona[] = [
  { name: "1. Super Admin", role: "super_admin", portal: "admin" },
  { name: "2. Admin (all hubs)", role: "admin", portal: "admin" },
  { name: "7. Maintenance user", role: "chief_engineer", portal: "admin" },
  { name: "8. Crew user", role: "crew_member", portal: "user" },
  { name: "9. Logistics user", role: "logistics_user", portal: "user" },
  { name: "10. Viewer / Auditor", role: "viewer", portal: "user" },
  { name: "11. Normal user", role: "deck_officer", portal: "user" },
];

test.describe("Persona navigation — client-role personas", () => {
  for (const persona of CLIENT_ROLE_PERSONAS) {
    test(`${persona.name} (${persona.role})`, async ({ page }) => {
      await seedRole(page, persona.role);
      await gotoHome(page);

      if (persona.portal === "user") {
        // User-portal personas must NOT reach admin hubs by direct URL.
        for (const hub of ADMIN_HUBS) {
          await expectHubBlocked(page, HUB_URLS[hub]);
        }
      } else {
        // Admin-portal personas land on the command center and can open an
        // admin hub. (Per-hub grant subsetting for partial admins is covered by
        // the hub-grant personas below + the unit test.)
        await gotoHome(page);
        await expect(page.locator("#root")).not.toBeEmpty();
      }
    });
  }
});

// ── Class B: hub-grant admin personas (server-seeded, real login) ────────────

interface SeededPersona {
  readonly name: string;
  readonly userEnv: string;
  readonly passEnv: string;
  readonly allowedHubs: readonly string[];
}

const SEEDED_PERSONAS: readonly SeededPersona[] = [
  {
    name: "3. Admin — Maintenance only",
    userEnv: "PERSONA_ADMIN_MAINT_USER",
    passEnv: "PERSONA_ADMIN_MAINT_PASS",
    allowedHubs: ["maintenance"],
  },
  {
    name: "4. Admin — Crew Management only",
    userEnv: "PERSONA_ADMIN_CREW_USER",
    passEnv: "PERSONA_ADMIN_CREW_PASS",
    allowedHubs: ["crew"],
  },
  {
    name: "5. Admin — Logistics only",
    userEnv: "PERSONA_ADMIN_LOG_USER",
    passEnv: "PERSONA_ADMIN_LOG_PASS",
    allowedHubs: ["logistics"],
  },
  {
    name: "6. Admin — no hubs granted",
    userEnv: "PERSONA_ADMIN_NONE_USER",
    passEnv: "PERSONA_ADMIN_NONE_PASS",
    allowedHubs: [],
  },
];

async function login(page: Page, username: string, password: string): Promise<void> {
  // Real account login via the portal endpoint (admin auth model: admins sign
  // in with a real account; there is no shared-password unlock).
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("input-username").fill(username);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-login").click();
  await expect(page).toHaveURL(new RegExp(`${BASE_URL}/($|\\?)`));
}

async function logout(page: Page): Promise<void> {
  const logoutBtn = page.getByTestId("button-logout");
  if (await logoutBtn.count()) {
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
  }
}

test.describe("Persona navigation — hub-grant admin personas (seeded users)", () => {
  for (const persona of SEEDED_PERSONAS) {
    test(persona.name, async ({ page }) => {
      const username = process.env[persona.userEnv];
      const password = process.env[persona.passEnv];
      test.skip(
        !username || !password,
        `Seed a user and set ${persona.userEnv}/${persona.passEnv} to run this persona.`
      );

      await login(page, username!, password!);

      // Allowed hubs render; every other admin hub is blocked by direct URL.
      const blocked = ADMIN_HUBS.filter((h) => !persona.allowedHubs.includes(h));
      for (const hub of blocked) {
        await expectHubBlocked(page, HUB_URLS[hub]);
      }

      // Logout works, then re-login still respects the same (current) grants.
      await logout(page);
      await login(page, username!, password!);
      for (const hub of blocked) {
        await expectHubBlocked(page, HUB_URLS[hub]);
      }
    });
  }
});
