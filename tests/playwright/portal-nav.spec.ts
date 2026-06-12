/**
 * Minimal-UX Polish Slice 2: portal & role-nav smoke.
 *
 * Verifies the simplified pilot navigation works end-to-end in a
 * real browser:
 *   - /portal-login renders both portal cards (and bypasses the
 *     SessionGate in production thanks to the PUBLIC_PATHS allow-list).
 *   - Clicking "User Login" writes role=deck_officer and lands on
 *     the mobile readiness command center with bridge/captain nav.
 *   - Clicking "Admin Login" writes role=system_admin and lands on
 *     the mobile readiness command center without the removed hub shell.
 *
 * These tests assert visibility of bottom-nav labels — the admin
 * categories must not leak into the user portal at any layer
 * (primary bar OR the "More" sheet).
 */

import { test, expect, type Page, type Route } from "@playwright/test";

const ADMIN_LABELS = [
  "System Admin",
  "Crew Management",
  "Logistics",
  "AI Analytics",
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

    if (path === "/api/portal/login" && request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}") as { username?: string };
      const isAdmin = payload.username?.includes("admin") ?? false;
      const role = isAdmin ? "super_admin" : "deck_officer";
      await fulfillJson(route, {
        sessionToken: isAdmin ? "playwright-admin-token" : "playwright-user-token",
        expiresIn: 28800,
        mustChangePassword: false,
        user: {
          id: isAdmin ? "admin-user" : "deck-user",
          name: isAdmin ? "Admin User" : "Deck Officer",
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
  await page.getByTestId("button-card-portal-user").click();
  await page.getByTestId("input-login-username").fill("playwright-user");
  await page.getByTestId("input-login-password").fill("playwright-password");
  await page.getByTestId("button-login").click();
  await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
}

async function loginDevAdmin(page: Page) {
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
  });

  test("Dev admin login opens the mobile readiness command center", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginDevAdmin(page);
    await expect(page.getByText("Command Queue", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("mobile-readiness-bottom-nav")).toBeVisible();
    await expect(page.getByTestId("shell-admin-hubs")).toHaveCount(0);
    await expect(page.getByTestId("shell-user-portal")).toHaveCount(0);
  });

  test("User portal shows role-specific mobile readiness items and no admin hubs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginDevUser(page);

    await expect(page.getByTestId("mobile-readiness-screen-command")).toBeVisible();
    await expect(page.getByTestId("mobile-readiness-bottom-nav")).toBeVisible();
    await expect(page.getByTestId("shell-user-portal")).toHaveCount(0);
    await expect(page.getByTestId("shell-admin-hubs")).toHaveCount(0);
    await expect(page.getByTestId("bottom-nav")).toHaveCount(0);

    for (const label of ["Bridge", "Logs", "Crew", "Maintenance", "Settings"]) {
      await expect(page.getByTestId("mobile-readiness-bottom-nav").getByText(label)).toBeVisible();
    }

    // No admin hub label may leak into the user-portal nav.
    for (const label of ADMIN_LABELS) {
      await expect(page.getByTestId("mobile-readiness-bottom-nav").getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  test("User portal mobile nav routes Logs to the replacement logs screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginDevUser(page);

    const logs = page.getByTestId("mobile-readiness-nav-logs");
    await expect(logs).toBeVisible();
    await logs.click();
    await expect(page).toHaveURL(/\/logs$/);
    await expect(page.getByTestId("mobile-readiness-screen-logs")).toBeVisible();
  });
});

test.describe("Feedback page", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("submits a valid feedback draft and surfaces a tracking id", async ({ page }) => {
    await loginDevUser(page);
    await navigateWithinAuthenticatedSpa(page, "/feedback");

    await page.getByTestId("input-feedback-subject").fill("Pilot smoke subject");
    await page
      .getByTestId("textarea-feedback-description")
      .fill("Pilot smoke description — at least ten characters long.");
    await page.getByTestId("button-feedback-submit").click();

    await expect(page.getByTestId("text-feedback-tracking-id")).toBeVisible();
    await expect(page.getByTestId("banner-feedback-pending-backend")).toBeVisible();
  });

  test("blocks submission when description is too short", async ({ page }) => {
    await loginDevUser(page);
    await navigateWithinAuthenticatedSpa(page, "/feedback");

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
test.describe("Portal return affordance", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("profile exposes a switch-portal button that returns to /portal-login", async ({
    page,
  }) => {
    await loginDevUser(page);
    await navigateWithinAuthenticatedSpa(page, "/profile");

    const switchBtn = page.getByTestId("button-switch-portal");
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();

    await expect(page).toHaveURL(/\/portal-login$/);
    await expect(page.getByTestId("page-portal-login")).toBeVisible();
  });

  test("feedback exposes a switch-portal button that returns to /portal-login", async ({
    page,
  }) => {
    await loginDevUser(page);
    await navigateWithinAuthenticatedSpa(page, "/feedback");

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
    await navigateWithinAuthenticatedSpa(page, "/attention-inbox");
    // Either the empty-state test-id is visible, or the page hasn't
    // rendered yet — `toBeVisible` with the default 5s expect timeout
    // covers the cold-cache fetch.
    await expect(page.getByTestId("empty-attention-inbox")).toBeVisible();
  });

  test("my tasks renders empty-my-tasks when no tasks are assigned", async ({ page }) => {
    await loginDevUser(page);
    await navigateWithinAuthenticatedSpa(page, "/my-tasks");

    await expect(page.getByTestId("empty-my-tasks")).toBeVisible();
  });

  test("feedback page renders empty-feedback-history on a fresh session", async ({ page }) => {
    await loginDevUser(page);
    await navigateWithinAuthenticatedSpa(page, "/feedback");
    await expect(page.getByTestId("empty-feedback-history")).toBeVisible();
  });
});
