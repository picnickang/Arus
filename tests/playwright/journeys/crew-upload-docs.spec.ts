/**
 * Journey: Crew "Upload docs" click-through (Task #329).
 *
 * Task #328 rerouted the Crew landing's "Upload docs" fast-action so it no
 * longer dead-ends on the compliance page — it now drops the user into the
 * current roster to pick a member, and every roster row exposes a one-click
 * "Documents" action that opens that member's profile dialog on the Documents
 * tab. The existing coverage (`tests/unit/crew-roster-grouping.test.ts`,
 * "crew upload-docs destination source-scan") only string-matches the wiring;
 * this spec drives the *live* path in a real browser so a roster/dialog/tab
 * regression is caught even if the source strings still look correct.
 *
 * Like `crew-photo-mobile.spec.ts`, the journey needs no backend seed — it
 * stubs the crew list, the per-member documents endpoint, the expiry feeds,
 * and `/api/permissions/me` with `page.route`, so it exercises the real client
 * wiring without depending on a populated database.
 *
 * Two cases:
 *   1. A user WITH crew-management (document) capability completes the full
 *      click-through: landing "Upload docs" -> current roster -> a member
 *      row's "Documents" action -> profile dialog opens on the Documents tab.
 *   2. A user WITHOUT that capability sees the "Upload docs" tile rendered as a
 *      disabled "No access" placeholder (a non-interactive <div>, not a
 *      clickable <button>) — i.e. the permission gate holds.
 */

import { test, expect, type Route, type Page } from "@playwright/test";

const MEMBER_ID = "crew-doc-target";

const CREW_FIXTURE = [
  {
    id: MEMBER_ID,
    name: "Ada Mariner",
    rank: "captain",
    photoPath: null,
    active: true,
    onDuty: true,
    skills: [],
    maxHours7d: 0,
    minRestH: 0,
  },
];

/** Build a permissions payload; `canManageDocs` toggles crew_members.edit. */
function permissionsBody(canManageDocs: boolean): string {
  return JSON.stringify({
    userId: "u-test",
    orgId: "org-test",
    roles: [{ id: "r1", name: "crew_member", displayName: "Crew Member" }],
    permissions: {
      crew_members: {
        view: true,
        create: canManageDocs,
        edit: canManageDocs,
        delete: false,
        export: false,
      },
    },
    hubAdmin: false,
    hubAccess: null,
    isDevMode: false,
  });
}

const EMPTY_JSON = (route: Route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "[]" });

/** Stub every backend dependency the crew landing + profile dialog touch. */
async function stubCrewApis(page: Page, canManageDocs: boolean): Promise<void> {
  // Order matters: Playwright checks the most recently registered route
  // first, so register the broad `/api/crew*` glob BEFORE the narrower
  // former/documents globs that must win for their specific paths.
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
  await page.route("**/api/crew/former*", EMPTY_JSON);
  await page.route("**/api/crew/**/documents*", EMPTY_JSON);

  await page.route("**/api/vessels*", EMPTY_JSON);
  await page.route("**/api/crew-certifications/expiring*", EMPTY_JSON);
  await page.route("**/api/crew-documents/expiring*", EMPTY_JSON);

  await page.route("**/api/permissions/me*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: permissionsBody(canManageDocs),
    }),
  );
}

test.describe("Crew Upload docs click-through", () => {
  test("drives landing -> roster -> member Documents action -> Documents tab", async ({
    page,
  }) => {
    await stubCrewApis(page, true);
    await page.goto("/crew-management", { waitUntil: "domcontentloaded" });

    // 1) Landing: the "Upload docs" fast-action is an enabled button.
    const uploadDocs = page.getByTestId("action-upload-docs");
    await expect(uploadDocs).toBeVisible();
    await expect(uploadDocs).toHaveJSProperty("tagName", "BUTTON");

    // 2) It opens the current roster (not the compliance page) — the member row
    //    appears and the URL stays on the crew page.
    await uploadDocs.click();
    const memberRow = page.getByTestId(`row-crew-${MEMBER_ID}`);
    await expect(memberRow).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/crew-management");

    // 3) Open the row action menu and click the "Documents" shortcut.
    await page.getByTestId(`button-crew-actions-${MEMBER_ID}`).click();
    await page.getByTestId(`action-documents-${MEMBER_ID}`).click();

    // 4) The profile dialog opens with the Documents tab active, and the
    //    documents surface (its "Add Document" CTA) is rendered.
    const docsTab = page.getByTestId("tab-crew-documents");
    await expect(docsTab).toBeVisible();
    await expect(docsTab).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("button-add-document")).toBeVisible();
  });

  test("hides the Upload docs action from a user without document capability", async ({
    page,
  }) => {
    await stubCrewApis(page, false);
    await page.goto("/crew-management", { waitUntil: "domcontentloaded" });

    // The tile is rendered as a disabled "No access" placeholder: a
    // non-interactive <div>, never the clickable <button> the granted user
    // sees, and it carries no onClick to reach the roster.
    const uploadDocs = page.getByTestId("action-upload-docs");
    await expect(uploadDocs).toBeVisible();
    await expect(uploadDocs).toHaveJSProperty("tagName", "DIV");
    await expect(uploadDocs).toContainText("No access");
  });
});
