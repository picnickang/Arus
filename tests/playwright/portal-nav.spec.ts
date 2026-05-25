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

import { test, expect, type Page } from "@playwright/test";

const ADMIN_LABELS = [
  "Maintenance",
  "System Admin",
  "Crew Management",
  "Logistics",
  "AI Analytics",
] as const;

const USER_LABELS = ["Dashboard", "Feedback / Flags"] as const;

async function resetClientState(page: Page) {
  // Clear any prior role hint so each test starts from the same
  // ground state as a fresh browser session.
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* private mode — fine */
    }
  });
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
    await expect(page.getByRole("button", { name: /Admin Login/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /User Login/i })).toBeVisible();
  });

  test("Admin portal shows the 5 admin categories in the bottom nav", async ({
    page,
  }) => {
    await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-card-portal-admin").click();

    // BottomNav is mobile-only (md:hidden), so use a phone viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForLoadState("domcontentloaded");

    const bottomNav = page.getByTestId("bottom-nav");
    await expect(bottomNav).toBeVisible();

    for (const label of ADMIN_LABELS) {
      await expect(bottomNav.getByText(label, { exact: true })).toBeVisible();
    }

    // User-portal-only labels MUST NOT appear.
    await expect(bottomNav.getByText("Feedback / Flags", { exact: true })).toHaveCount(
      0,
    );
  });

  test("User portal shows only Dashboard + Feedback (no admin leakage)", async ({
    page,
  }) => {
    await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-card-portal-user").click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForLoadState("domcontentloaded");

    const bottomNav = page.getByTestId("bottom-nav");
    await expect(bottomNav).toBeVisible();

    for (const label of USER_LABELS) {
      await expect(bottomNav.getByText(label, { exact: true })).toBeVisible();
    }

    // No admin category should be visible in the primary bar.
    for (const label of ADMIN_LABELS) {
      await expect(bottomNav.getByText(label, { exact: true })).toHaveCount(0);
    }

    // The "More" sheet must also be policy-driven — opening it must
    // not leak admin categories to the user portal.
    await page.getByTestId("button-nav-more").click();
    const moreSheet = page.getByText("All Categories");
    await expect(moreSheet).toBeVisible();
    for (const label of ADMIN_LABELS) {
      await expect(page.getByTestId(/^link-category-/).getByText(label, { exact: true }))
        .toHaveCount(0);
    }
  });

  test("User portal HomePage surfaces the Feedback CTA and routes to /feedback", async ({
    page,
  }) => {
    await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-card-portal-user").click();

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
    await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-card-portal-user").click();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const switchBtn = page.getByTestId("button-switch-portal");
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();

    await expect(page).toHaveURL(/\/portal-login$/);
    await expect(page.getByTestId("page-portal-login")).toBeVisible();
  });

  test("admin portal exposes a switch-portal button that returns to /portal-login", async ({
    page,
  }) => {
    await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-card-portal-admin").click();
    await page.goto("/", { waitUntil: "domcontentloaded" });

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
 * The first two require backend state; we assert they appear via the
 * baseline empty DB the dev workflow ships with. The feedback-history
 * empty state is purely client-side (sessionStorage-backed list), so
 * we land on /feedback in a fresh session and pin the empty pane
 * without depending on backend state at all.
 */
test.describe("Empty states", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("attention inbox renders empty state when there is nothing to act on", async ({
    page,
  }) => {
    await page.goto("/attention-inbox", { waitUntil: "domcontentloaded" });
    // Either the empty-state test-id is visible, or the page hasn't
    // rendered yet — `toBeVisible` with the default 5s expect timeout
    // covers the cold-cache fetch.
    await expect(page.getByTestId("empty-attention")).toBeVisible();
  });

  test("user-portal home renders empty-my-tasks when no tasks are assigned", async ({
    page,
  }) => {
    await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-card-portal-user").click();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("empty-my-tasks")).toBeVisible();
  });

  test("feedback page renders empty-feedback-history on a fresh session", async ({
    page,
  }) => {
    await page.goto("/feedback", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("empty-feedback-history")).toBeVisible();
  });
});
