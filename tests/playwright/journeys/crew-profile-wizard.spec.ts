/**
 * Journey: Crew profile + Add/Edit wizard step targeting, status enum
 * rendering, and the alert-log loading gate (Task #340).
 *
 * The reshaped crew profile, 3-step Add/Edit wizard, and alert log were only
 * verified by type-checking + code review. These flows are easy to regress, so
 * this spec drives the *live* client in a real browser:
 *
 *   1. Wizard step targeting:
 *        - "Assign" from the profile opens the wizard on the assignment
 *          (Profile) step — the vessel select is shown, the identity name input
 *          is not.
 *        - "Edit" from the profile opens the wizard on step 0 — the name input
 *          is shown.
 *        - Assign -> close -> "Add Crew" opens on step 0 again (the per-open
 *          step intent self-resets on close).
 *   2. Status enum: the profile header + Overview show the explicit status
 *      label ("On leave" for `on_leave`), not a bare Active/Inactive.
 *   3. Alert log: while the crew's certification alerts are still loading the
 *      log must NOT flash "No active alerts" — it shows a skeleton until the
 *      query settles, then renders the empty state.
 *
 * Like `crew-photo-mobile.spec.ts` / `crew-upload-docs.spec.ts`, the journey
 * needs no backend seed — it stubs the crew list, the per-member documents +
 * tasks endpoints, the expiry feeds, and `/api/permissions/me` with
 * `page.route`, so it exercises the real client wiring without a populated DB.
 */

import { test, expect, type Route, type Page } from "@playwright/test";

const MEMBER_ID = "crew-wizard-target";

const CREW_FIXTURE = [
  {
    id: MEMBER_ID,
    name: "Ada Mariner",
    rank: "captain",
    crewCode: "CRW-0001",
    photoPath: null,
    active: true,
    onDuty: false,
    // The explicit lifecycle status the header/Overview must surface verbatim
    // instead of collapsing to "Active".
    status: "on_leave",
    employmentType: "permanent",
    skills: [],
    maxHours7d: 72,
    minRestH: 10,
  },
];

/** Permissions payload granting crew view/create/edit (Assign/Edit gates). */
function permissionsBody(): string {
  return JSON.stringify({
    userId: "u-test",
    orgId: "org-test",
    roles: [{ id: "r1", name: "company_admin", displayName: "Company Admin" }],
    permissions: {
      crew_members: { view: true, create: true, edit: true, delete: true, export: true },
    },
    hubAdmin: false,
    hubAccess: null,
    isDevMode: false,
  });
}

const EMPTY_ARRAY = (route: Route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "[]" });

/**
 * Stub every backend dependency the crew landing + roster + profile dialog
 * touch. `onCertExpiring` lets a test intercept the alert-log certification
 * feed (queried with `daysAhead=365`) to exercise the loading gate; the
 * landing's own `daysAhead=30` feed always resolves immediately so the page
 * can render.
 */
async function stubCrewApis(
  page: Page,
  onCertExpiring?: (route: Route) => Promise<void> | void,
): Promise<void> {
  // Order matters: Playwright checks the most recently registered route first,
  // so register the broad `/api/crew*` glob BEFORE the narrower globs.
  await page.route("**/api/crew*", (route: Route) => {
    if (route.request().method() !== "GET") {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CREW_FIXTURE),
    });
  });
  await page.route("**/api/crew/former*", EMPTY_ARRAY);
  await page.route("**/api/crew/**/documents*", EMPTY_ARRAY);
  await page.route("**/api/crew-tasks*", EMPTY_ARRAY);
  await page.route("**/api/vessels*", EMPTY_ARRAY);
  await page.route("**/api/crew-documents/expiring*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ documents: [] }),
    }),
  );
  await page.route("**/api/crew-certifications/expiring*", async (route: Route) => {
    // The alert-log feed (daysAhead=365) can be held by a test; the landing's
    // attention feed (daysAhead=30) must resolve so the page renders.
    if (onCertExpiring && route.request().url().includes("daysAhead=365")) {
      return onCertExpiring(route);
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ certifications: [] }),
    });
  });
  await page.route("**/api/permissions/me*", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: permissionsBody() }),
  );
}

/** Landing -> current roster -> open the member's profile dialog. */
async function openProfile(page: Page): Promise<void> {
  await page.goto("/crew-management", { waitUntil: "domcontentloaded" });
  await page.getByTestId("card-open-current").click();
  await expect(page.getByTestId(`row-crew-${MEMBER_ID}`)).toBeVisible();
  await page.getByTestId(`button-crew-actions-${MEMBER_ID}`).click();
  await page.getByTestId(`action-view-${MEMBER_ID}`).click();
  await expect(page.getByTestId("text-profile-name")).toBeVisible();
}

test.describe("Crew profile + Add/Edit wizard", () => {
  test("Assign opens the wizard on the assignment step; Edit on step 0; Add Crew resets to step 0", async ({
    page,
  }) => {
    await stubCrewApis(page);
    await openProfile(page);

    // Assign -> wizard opens on the Profile (assignment) step: the vessel
    // select is shown and the step-0 identity name input is absent.
    await page.getByTestId("button-profile-assign").click();
    await expect(page.getByTestId("crew-form-stepper")).toBeVisible();
    await expect(page.getByTestId("select-crew-vessel")).toBeVisible();
    await expect(page.getByTestId("input-crew-name")).toHaveCount(0);

    // Close the wizard.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("crew-form-stepper")).toHaveCount(0);

    // Re-open the profile and Edit -> wizard opens on step 0 (name input shown,
    // assignment vessel select absent).
    await openProfile(page);
    await page.getByTestId("button-profile-edit").click();
    await expect(page.getByTestId("input-crew-name")).toBeVisible();
    await expect(page.getByTestId("select-crew-vessel")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("crew-form-stepper")).toHaveCount(0);

    // Assign again, close, then Add Crew -> must open on step 0 (the per-open
    // step intent self-resets on close).
    await openProfile(page);
    await page.getByTestId("button-profile-assign").click();
    await expect(page.getByTestId("select-crew-vessel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("crew-form-stepper")).toHaveCount(0);

    await page.getByTestId("button-add-crew").click();
    await expect(page.getByTestId("input-crew-name")).toBeVisible();
    await expect(page.getByTestId("select-crew-vessel")).toHaveCount(0);
  });

  test("profile header + Overview show the explicit lifecycle status label", async ({ page }) => {
    await stubCrewApis(page);
    await openProfile(page);

    // The header chip surfaces the enum label, not a bare Active/Inactive.
    const statusChip = page.getByTestId("chip-status");
    await expect(statusChip).toHaveText("On leave");

    // The Overview tab Status field shows the same explicit label.
    await page.getByTestId("tab-crew-details").click();
    await expect(page.getByText("On leave")).toBeVisible();
  });

  test("alert log does not flash 'No active alerts' while certifications load", async ({ page }) => {
    let releaseCert: () => void = () => {};
    const certHeld = new Promise<void>((resolve) => {
      releaseCert = resolve;
    });

    await stubCrewApis(page, async (route: Route) => {
      // Hold the alert-log certification feed until the test releases it.
      await certHeld;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ certifications: [] }),
      });
    });

    await openProfile(page);
    await page.getByTestId("tab-crew-notifications").click();

    // The alert-log tab has mounted (its "New alert" CTA renders above the
    // gate), but while the cert feed is still in flight the empty-state copy
    // must NOT be shown — a skeleton stands in its place.
    await expect(page.getByTestId("button-create-alert")).toBeVisible();
    await expect(page.getByTestId("text-no-alerts")).toHaveCount(0);
    await expect(page.getByTestId("list-crew-alerts")).toHaveCount(0);

    // Once the feed settles (empty), the empty state finally appears.
    releaseCert();
    await expect(page.getByTestId("text-no-alerts")).toBeVisible();
  });
});
