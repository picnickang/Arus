/**
 * Journey: Crew org chart live rendering (Task #356).
 *
 * Task #355 locked the org chart's tree-building logic (root detection, cycle
 * breaking, child ordering) with pure unit tests, but the sandbox has no
 * jsdom/RTL so the *live* DOM behaviour stayed unverified. This spec drives the
 * real client in a browser to cover what the unit suite cannot:
 *
 *   1. Tree render + role ordering: under a manager, the reports render in role
 *      order (by each crew role's `sortOrder`), NOT alphabetical order — the
 *      fixture deliberately makes the two orders differ.
 *   2. The "N reports" pill (data-testid `orgnode-reports-<id>`) shows the
 *      manager's direct-report count.
 *   3. Expand/collapse: the toggle (data-testid `orgnode-toggle-<id>`) hides the
 *      reports when collapsed (they leave the DOM) and shows them again when
 *      re-expanded.
 *   4. Click-to-open: clicking a node (data-testid `orgnode-open-<id>`) opens
 *      that crew member's profile dialog.
 *
 * Like the other crew journeys (`crew-profile-wizard.spec.ts`), it needs no
 * backend seed — it stubs `/api/crew`, `/api/crew-roles` (the ordering source),
 * vessels, the per-member docs/tasks/expiry feeds, and `/api/permissions/me`
 * with `page.route`, exercising the real client wiring without a populated DB.
 */

import { test, expect, type Route, type Page } from "@playwright/test";

const MANAGER_ID = "mgr-captain";
const REPORT_CHIEF = "rpt-chief";
const REPORT_SECOND = "rpt-second";
const REPORT_AB = "rpt-ab";

/**
 * One manager (captain, root) with three direct reports. Ranks are role NAMES
 * (`crew.rank` stores the role name, matched to a crew role by a normalized
 * key). Names are chosen so ALPHABETICAL order (Amy, Mike, Zoe) is the reverse
 * of ROLE order (Chief Engineer < Second Officer < Able Seaman), proving the
 * chart sorts by role, not name.
 */
const CREW_FIXTURE = [
  {
    id: MANAGER_ID,
    name: "Maria Captain",
    rank: "Captain",
    crewCode: "CRW-0001",
    photoPath: null,
    active: true,
    onDuty: false,
    status: "active",
    employmentType: "permanent",
    reportsToId: null,
    vesselId: "v1",
    skills: [],
    maxHours7d: 72,
    minRestH: 10,
  },
  {
    id: REPORT_CHIEF,
    name: "Zoe Chief",
    rank: "Chief Engineer",
    crewCode: "CRW-0002",
    photoPath: null,
    active: true,
    onDuty: false,
    status: "active",
    employmentType: "permanent",
    reportsToId: MANAGER_ID,
    vesselId: "v1",
    skills: [],
    maxHours7d: 72,
    minRestH: 10,
  },
  {
    id: REPORT_SECOND,
    name: "Mike Second",
    rank: "Second Officer",
    crewCode: "CRW-0003",
    photoPath: null,
    active: true,
    onDuty: false,
    status: "active",
    employmentType: "permanent",
    reportsToId: MANAGER_ID,
    vesselId: "v1",
    skills: [],
    maxHours7d: 72,
    minRestH: 10,
  },
  {
    id: REPORT_AB,
    name: "Amy Able",
    rank: "Able Seaman",
    crewCode: "CRW-0004",
    photoPath: null,
    active: true,
    onDuty: false,
    status: "active",
    employmentType: "permanent",
    reportsToId: MANAGER_ID,
    vesselId: "v1",
    skills: [],
    maxHours7d: 72,
    minRestH: 10,
  },
];

/**
 * Crew-role catalog supplying the ordering: lower `sortOrder` ranks higher in
 * the chart. Reports must render Chief Engineer → Second Officer → Able Seaman.
 */
const CREW_ROLES_FIXTURE = [
  { id: "role-cap", orgId: "org-test", name: "Captain", category: "Deck", sortOrder: 10, active: true },
  { id: "role-ce", orgId: "org-test", name: "Chief Engineer", category: "Engine", sortOrder: 20, active: true },
  { id: "role-2o", orgId: "org-test", name: "Second Officer", category: "Deck", sortOrder: 30, active: true },
  { id: "role-ab", orgId: "org-test", name: "Able Seaman", category: "Deck", sortOrder: 40, active: true },
];

/**
 * Two crew members who are BOTH inactive (`active: false`). CrewOrgChart filters
 * on `active` before building the tree, so this fixture must produce the same
 * empty state as an empty list — proving the active-filter branch, not just the
 * "no rows at all" branch.
 */
const INACTIVE_CREW_FIXTURE = [
  {
    id: "off-1",
    name: "Former Captain",
    rank: "Captain",
    crewCode: "CRW-9001",
    photoPath: null,
    active: false,
    onDuty: false,
    status: "inactive",
    employmentType: "permanent",
    reportsToId: null,
    vesselId: "v1",
    skills: [],
    maxHours7d: 72,
    minRestH: 10,
  },
  {
    id: "off-2",
    name: "Former Engineer",
    rank: "Chief Engineer",
    crewCode: "CRW-9002",
    photoPath: null,
    active: false,
    onDuty: false,
    status: "inactive",
    employmentType: "permanent",
    reportsToId: "off-1",
    vesselId: "v1",
    skills: [],
    maxHours7d: 72,
    minRestH: 10,
  },
];

const VESSELS_FIXTURE = [{ id: "v1", name: "MV Northern Star" }];

/** Permissions payload granting crew view/create/edit. */
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
 * Stub every backend dependency the crew landing + org chart + profile touch.
 * `crew` defaults to the populated fixture; pass an empty or all-inactive list
 * to exercise the org chart's empty state.
 */
async function stubCrewApis(page: Page, crew: unknown[] = CREW_FIXTURE): Promise<void> {
  // Order matters: Playwright checks the most recently registered route first,
  // so register the broad `/api/crew*` glob BEFORE the narrower globs.
  await page.route("**/api/crew*", (route: Route) => {
    if (route.request().method() !== "GET") {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(crew),
    });
  });
  await page.route("**/api/crew/former*", EMPTY_ARRAY);
  await page.route("**/api/crew/**/documents*", EMPTY_ARRAY);
  await page.route("**/api/crew-tasks*", EMPTY_ARRAY);
  await page.route("**/api/crew-roles*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CREW_ROLES_FIXTURE),
    }),
  );
  await page.route("**/api/vessels*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(VESSELS_FIXTURE),
    }),
  );
  await page.route("**/api/crew-documents/expiring*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ documents: [] }),
    }),
  );
  await page.route("**/api/crew-certifications/expiring*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ certifications: [] }),
    }),
  );
  await page.route("**/api/permissions/me*", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: permissionsBody() }),
  );
}

/** Landing -> open the org chart view. */
async function openOrgChart(page: Page): Promise<void> {
  await page.goto("/crew-management", { waitUntil: "domcontentloaded" });
  await page.getByTestId("card-open-orgchart").click();
  await expect(page.getByTestId("crew-org-chart")).toBeVisible();
  await expect(page.getByTestId("org-chart-roots")).toBeVisible();
}

/**
 * Landing -> open the org chart view when no active crew exist. Unlike
 * `openOrgChart`, this does NOT wait for `org-chart-roots` — that branch never
 * renders here. The chart container still mounts; the empty card replaces the
 * roots tree.
 */
async function openOrgChartEmpty(page: Page): Promise<void> {
  await page.goto("/crew-management", { waitUntil: "domcontentloaded" });
  await page.getByTestId("card-open-orgchart").click();
  await expect(page.getByTestId("crew-org-chart")).toBeVisible();
}

test.describe("Crew org chart", () => {
  test("renders reports under a manager in role order with a report-count pill", async ({ page }) => {
    await stubCrewApis(page);
    await openOrgChart(page);

    // The manager (root) renders.
    await expect(page.getByTestId(`orgnode-${MANAGER_ID}`)).toBeVisible();
    await expect(page.getByTestId(`orgnode-name-${MANAGER_ID}`)).toHaveText("Maria Captain");

    // All three reports render under the manager.
    await expect(page.getByTestId(`orgnode-${REPORT_CHIEF}`)).toBeVisible();
    await expect(page.getByTestId(`orgnode-${REPORT_SECOND}`)).toBeVisible();
    await expect(page.getByTestId(`orgnode-${REPORT_AB}`)).toBeVisible();

    // The pill shows the manager's direct-report count.
    await expect(page.getByTestId(`orgnode-reports-${MANAGER_ID}`)).toHaveText("3 reports");

    // Reports appear in ROLE order (Chief 20 → Second 30 → Able 40), which is
    // the reverse of their alphabetical order — proving role-based sorting.
    const reportNames = page.locator('[data-testid^="orgnode-name-rpt-"]');
    await expect(reportNames).toHaveText(["Zoe Chief", "Mike Second", "Amy Able"]);
  });

  test("the toggle collapses and re-expands a manager's reports", async ({ page }) => {
    await stubCrewApis(page);
    await openOrgChart(page);

    // Reports start expanded.
    await expect(page.getByTestId(`orgnode-${REPORT_CHIEF}`)).toBeVisible();

    // Collapse — the reports leave the DOM (the children subtree is unmounted).
    await page.getByTestId(`orgnode-toggle-${MANAGER_ID}`).click();
    await expect(page.getByTestId(`orgnode-toggle-${MANAGER_ID}`)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.getByTestId(`orgnode-${REPORT_CHIEF}`)).toHaveCount(0);
    await expect(page.getByTestId(`orgnode-${REPORT_SECOND}`)).toHaveCount(0);
    await expect(page.getByTestId(`orgnode-${REPORT_AB}`)).toHaveCount(0);

    // Re-expand — the reports come back.
    await page.getByTestId(`orgnode-toggle-${MANAGER_ID}`).click();
    await expect(page.getByTestId(`orgnode-toggle-${MANAGER_ID}`)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.getByTestId(`orgnode-${REPORT_CHIEF}`)).toBeVisible();
    await expect(page.getByTestId(`orgnode-${REPORT_SECOND}`)).toBeVisible();
    await expect(page.getByTestId(`orgnode-${REPORT_AB}`)).toBeVisible();
  });

  test("clicking a node opens that crew member's profile", async ({ page }) => {
    await stubCrewApis(page);
    await openOrgChart(page);

    // Click a report node — the profile dialog opens for that member.
    await page.getByTestId(`orgnode-open-${REPORT_CHIEF}`).click();
    await expect(page.getByTestId("text-profile-name")).toBeVisible();
    await expect(page.getByTestId("text-profile-name")).toHaveText("Zoe Chief");
  });

  test("shows the empty state when there are no active crew", async ({ page }) => {
    // Only inactive crew exist — CrewOrgChart filters on `active`, so the tree
    // never builds and the empty card renders instead of the roots branch.
    await stubCrewApis(page, INACTIVE_CREW_FIXTURE);
    await openOrgChartEmpty(page);

    // The empty card is visible with its copy...
    await expect(page.getByTestId("org-chart-empty")).toBeVisible();
    await expect(page.getByTestId("org-chart-empty")).toHaveText("No active crew to chart yet.");

    // ...and the roots branch (and any org nodes) are absent from the DOM.
    await expect(page.getByTestId("org-chart-roots")).toHaveCount(0);
    await expect(page.locator('[data-testid^="orgnode-"]')).toHaveCount(0);
  });

  test("shows the empty state when the crew list is empty", async ({ page }) => {
    // No crew at all — same empty branch as the all-inactive case.
    await stubCrewApis(page, []);
    await openOrgChartEmpty(page);

    await expect(page.getByTestId("org-chart-empty")).toBeVisible();
    await expect(page.getByTestId("org-chart-roots")).toHaveCount(0);
  });
});
