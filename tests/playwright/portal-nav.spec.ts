/**
 * Minimal-UX Polish Slice 2: portal & role-nav smoke.
 *
 * Verifies the simplified pilot navigation works end-to-end in a
 * real browser:
 *   - /portal-login renders both portal cards (and bypasses the
 *     SessionGate in production thanks to the PUBLIC_PATHS allow-list).
 *   - Clicking "User Login" writes role=deck_officer and lands on
 *     /dashboard with ONLY Dashboard + Feedback in the bottom nav,
 *     and NO admin categories (Maintenance, System Admin, etc.).
 *   - Clicking "Admin Login" writes role=system_admin and surfaces
 *     the 5 admin categories from the policy.
 *
 * These tests assert visibility of bottom-nav labels — the admin
 * categories must not leak into the user portal at any layer
 * (primary bar OR the "More" sheet).
 */

import { test, expect, type Page, type Route } from "@playwright/test";

const ADMIN_LABELS = [
  "Maintenance",
  "System Admin",
  "Crew Management",
  "Logistics",
  "AI Analytics",
] as const;

// The user portal sidebar renders four primary items. Note the
// feedback category is label-overridden to "Report / Flag Issue" in
// the user shell (the policy id stays `user-feedback`).
const USER_LABELS = ["Dashboard", "Assigned Tasks", "Report / Flag Issue", "Profile"] as const;

const USER_NAV_ITEM_IDS = [
  "mobile-nav-item-user-dashboard",
  "mobile-nav-item-user-tasks",
  "mobile-nav-item-user-feedback",
  "mobile-nav-item-user-profile",
] as const;

const EMPTY_ATTENTION_WORKFLOW = {
  queues: [],
  items: [],
  handover: {
    openAttentionItems: 0,
    criticalItems: 0,
    blockedJobs: 0,
    readyForCloseout: 0,
    openWorkOrders: 0,
    lowStockParts: 0,
    waitingOnParts: 0,
    suggestedSummary: [],
  },
  generatedAt: "2026-06-10T00:00:00.000Z",
  sources: {
    workOrders: "ok",
    alerts: "ok",
    equipment: "ok",
    inventory: "ok",
  },
};

const EMPTY_ATTENTION_SUMMARY = {
  overdueWorkOrders: 0,
  unacknowledgedAlerts: 0,
  highRiskEquipment: 0,
  newSinceLastVisit: {
    newAlerts: 0,
    newWorkOrders: 0,
    completedWorkOrders: 0,
  },
};

function authorizationToken(route: Route): string {
  const header = route.request().headers()["authorization"] ?? "";
  return header.replace(/^Bearer\s+/i, "");
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installPortalFixtures(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/portal/dev-login" && request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}") as {
        persona?: "admin" | "user";
        role?: string;
      };
      const isAdmin = payload.persona === "admin";
      const role = isAdmin ? "super_admin" : payload.role || "deck_officer";
      await fulfillJson(route, {
        sessionToken: isAdmin ? "playwright-dev-admin-token" : `playwright-dev-user-${role}-token`,
        expiresIn: 28800,
        mustChangePassword: false,
        user: {
          id: isAdmin ? "dev-admin-user" : `dev-login-user-${role}`,
          name: isAdmin ? "Development Superuser" : "Development User Preview",
          role,
          orgId: "default-org-id",
        },
      });
      return;
    }

    if (path === "/api/permissions/me") {
      const token = authorizationToken(route);
      const isAdmin = token.includes("admin");
      const role = isAdmin ? "super_admin" : "deck_officer";
      await fulfillJson(route, {
        userId: isAdmin ? "dev-admin-user" : `dev-login-user-${role}`,
        orgId: "default-org-id",
        roles: [
          {
            id: `playwright-role-${role}`,
            name: role,
            displayName: isAdmin ? "Super Admin (Dev Mode)" : "Deck Officer (Dev Preview)",
          },
        ],
        permissions: isAdmin
          ? {
              system: ["view", "create", "edit", "delete", "manage"],
              admin: ["view", "create", "edit", "delete", "manage"],
            }
          : {},
        hubAdmin: isAdmin,
        hubAccess: isAdmin ? null : [],
        isDevMode: isAdmin,
      });
      return;
    }

    const responses: Record<string, unknown> = {
      "/api/me/dashboard": {
        config: {
          widgets: [
            "current_vessel",
            "safety_status",
            "safety_notices",
            "active_alerts",
            "user_tasks",
          ],
          taskSources: [],
          visibilityScope: "self",
          quickActions: [],
          filters: {},
          highImpactQuestions: {},
        },
      },
      "/api/me/tasks": [],
      "/api/work-orders/my-assignments": [],
      "/api/me/safety-alarms": [],
      "/api/home/attention-summary": EMPTY_ATTENTION_SUMMARY,
      "/api/attention/items": EMPTY_ATTENTION_WORKFLOW,
      "/api/work-orders": [],
      "/api/maintenance-schedules/upcoming": [],
      "/api/shifts": [],
      "/api/vessels": [],
      "/api/alerts": [],
      "/api/safety-bulletins": [],
    };

    if (Object.prototype.hasOwnProperty.call(responses, path)) {
      await fulfillJson(route, responses[path]);
      return;
    }

    await route.continue();
  });
}

async function resetClientState(page: Page) {
  await installPortalFixtures(page);
  // Clear any prior role hint once at test setup. Do not use addInitScript
  // here: this spec intentionally navigates after dev login, and a persistent
  // init script would wipe the fresh dev session on every page load.
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* private mode — fine */
    }
  });
}

async function loginDevUser(page: Page) {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-dev-login-user").click();
  await expect(page.getByTestId("shell-user-portal")).toBeVisible();
}

async function loginDevAdmin(page: Page) {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-dev-login-admin").click();
  await expect(page.getByTestId("shell-admin-hubs")).toBeVisible();
}

test.describe("Portal split landing", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("/portal-login renders both portal cards", async ({ page }) => {
    await page.goto("/portal-login", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("page-portal-login")).toBeVisible();
    await expect(page.getByTestId("card-portal-admin")).toBeVisible();
    await expect(page.getByTestId("card-portal-user")).toBeVisible();
    await expect(page.getByTestId("button-card-portal-admin")).toBeVisible();
    await expect(page.getByTestId("button-card-portal-user")).toBeVisible();
    await expect(page.getByTestId("button-dev-login-admin")).toBeVisible();
    await expect(page.getByTestId("button-dev-login-user")).toBeVisible();
  });

  test("Dev admin login opens the admin hub shell", async ({ page }) => {
    await loginDevAdmin(page);
    await expect(page.getByTestId("text-admin-hubs-title")).toBeVisible();
    await expect(page.getByTestId("shell-user-portal")).toHaveCount(0);
  });

  test("User portal shows the 4 user items and no admin hubs", async ({ page }) => {
    await loginDevUser(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The user portal renders its own shell — the admin-only BottomNav
    // (the hub launcher) must never appear for a user-portal account.
    await expect(page.getByTestId("shell-user-portal")).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toHaveCount(0);

    // Open the mobile nav sheet and assert the four user items are
    // present, each carrying its policy-driven test id.
    await page.getByTestId("button-mobile-menu").click();
    const sheet = page.getByTestId("sheet-mobile-nav");
    await expect(sheet).toBeVisible();

    for (const id of USER_NAV_ITEM_IDS) {
      await expect(sheet.getByTestId(id)).toBeVisible();
    }
    for (const label of USER_LABELS) {
      await expect(sheet.getByText(label, { exact: true })).toBeVisible();
    }

    // No admin hub label may leak into the user-portal nav.
    for (const label of ADMIN_LABELS) {
      await expect(sheet.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  test("User portal HomePage surfaces the Feedback CTA and routes to /feedback", async ({
    page,
  }) => {
    await loginDevUser(page);

    // The simplified user-portal home renders at "/" once the role is
    // set. Land there explicitly so the test is independent of any
    // post-login redirect chain.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const cta = page.getByTestId("button-user-open-feedback");
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page.getByTestId("page-feedback")).toBeVisible();
  });
});

test.describe("Feedback page", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("submits a valid feedback draft and surfaces a tracking id", async ({ page }) => {
    await page.goto("/feedback", { waitUntil: "domcontentloaded" });

    await page.getByTestId("input-feedback-subject").fill("Pilot smoke subject");
    await page
      .getByTestId("textarea-feedback-description")
      .fill("Pilot smoke description — at least ten characters long.");
    await page.getByTestId("button-feedback-submit").click();

    await expect(page.getByTestId("text-feedback-tracking-id")).toBeVisible();
    await expect(page.getByTestId("banner-feedback-pending-backend")).toBeVisible();
  });

  test("blocks submission when description is too short", async ({ page }) => {
    await page.goto("/feedback", { waitUntil: "domcontentloaded" });

    await page.getByTestId("input-feedback-subject").fill("Valid subject");
    await page.getByTestId("textarea-feedback-description").fill("short");
    await page.getByTestId("button-feedback-submit").click();

    await expect(page.getByTestId("error-feedback-description")).toBeVisible();
  });
});

/**
 * LR-2 — Switch-portal affordance.
 *
 * Once a user is inside a portal (user OR admin) there must always be
 * a single, test-id-stable way back to /portal-login so they can re-
 * pick the other surface. This pins it for both portals to prevent the
 * affordance silently regressing when nav is refactored.
 */
test.describe("Switch-portal affordance", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("user portal exposes a switch-portal button that returns to /portal-login", async ({
    page,
  }) => {
    await loginDevUser(page);

    const switchBtn = page.getByTestId("button-switch-portal");
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();

    await expect(page).toHaveURL(/\/portal-login$/);
    await expect(page.getByTestId("page-portal-login")).toBeVisible();
  });

  test("admin portal exposes a switch-portal button that returns to /portal-login", async ({
    page,
  }) => {
    await loginDevAdmin(page);

    const switchBtn = page.getByTestId("button-switch-portal");
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();

    await expect(page).toHaveURL(/\/portal-login$/);
    await expect(page.getByTestId("page-portal-login")).toBeVisible();
  });
});

/**
 * LR-2 — Empty-state coverage.
 *
 * Three empty states added in Polish Slice 3:
 *   - `empty-attention` on /attention-inbox when there are no flagged items.
 *   - `empty-my-tasks` on the user-portal home when there are no assigned tasks.
 *   - `empty-feedback-history` on /feedback when this browser has no
 *      previously-submitted entries.
 *
 * The attention inbox is admin-only, so the route-level empty state uses
 * the dev-admin path. The user dashboard empty state stays on the dev-user
 * path. The feedback-history empty state is purely client-side
 * (sessionStorage-backed list), so we land on /feedback in a fresh session
 * and pin the empty pane without depending on backend state at all.
 */
test.describe("Empty states", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("attention inbox renders empty state when there is nothing to act on", async ({ page }) => {
    await loginDevAdmin(page);
    await page.goto("/attention-inbox", { waitUntil: "domcontentloaded" });
    // Either the empty-state test-id is visible, or the page hasn't
    // rendered yet — `toBeVisible` with the default 5s expect timeout
    // covers the cold-cache fetch.
    await expect(page.getByTestId("empty-attention-inbox")).toBeVisible();
  });

  test("user-portal home renders empty-my-tasks when no tasks are assigned", async ({ page }) => {
    await loginDevUser(page);

    await expect(page.getByTestId("empty-my-tasks")).toBeVisible();
  });

  test("feedback page renders empty-feedback-history on a fresh session", async ({ page }) => {
    await page.goto("/feedback", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("empty-feedback-history")).toBeVisible();
  });
});
