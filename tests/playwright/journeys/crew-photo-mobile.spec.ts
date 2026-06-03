/**
 * Journey: Crew profile photo on a mobile viewport.
 *
 * Covers the new crew-photo surface added to the mobile Crew Management
 * redesign (Figma 47:1391). A crew row carries an optional `photoPath`
 * (an auth-gated `/objects/...` entity); the roster avatar must fetch
 * that path WITH credentials and render it as an <img>, falling back to
 * initials when no photo exists.
 *
 * Like `offline-outbox.spec.ts`, this journey needs no backend seed — it
 * stubs the crew list + the object blob with `page.route`, so it asserts
 * the real client wiring (CrewAvatar's authed-blob loader) without
 * depending on a populated database.
 *
 * Two crew members are returned: one WITH a photo (asserts the <img>
 * renders from the mocked blob) and one WITHOUT (asserts the initials
 * fallback is shown). The context uses a mobile device profile so the
 * mobile-card layout — not the desktop table — is exercised.
 */

import { test, expect, devices, type Route } from "@playwright/test";

const PHOTO_PATH = "/objects/uploads/test-crew-photo";

// Minimal 1x1 PNG (the avatar loader only needs a decodable image blob).
const PNG_1X1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082",
  "hex",
);

const WITH_PHOTO_ID = "crew-with-photo";
const NO_PHOTO_ID = "crew-no-photo";

const CREW_FIXTURE = [
  {
    id: WITH_PHOTO_ID,
    name: "Ada Mariner",
    rank: "Captain",
    photoPath: PHOTO_PATH,
    active: true,
    onDuty: true,
    skills: [],
    maxHours7d: 0,
    minRestH: 0,
  },
  {
    id: NO_PHOTO_ID,
    name: "Bo Sailor",
    rank: "Engineer",
    photoPath: null,
    active: true,
    onDuty: false,
    skills: [],
    maxHours7d: 0,
    minRestH: 0,
  },
];

test.use({ ...devices["Pixel 5"] });

test.describe("Crew profile photo — mobile roster", () => {
  test.beforeEach(async ({ page }) => {
    // Serve the crew roster from a fixture (active list + empty former list).
    await page.route("**/api/crew/former*", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
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
    // The avatar loader fetches the object path with credentials; return the PNG.
    await page.route(`**${PHOTO_PATH}`, (route: Route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 }),
    );
  });

  test("renders an authed photo for a crew member who has one, initials otherwise", async ({
    page,
  }) => {
    await page.goto("/crew-management", { waitUntil: "domcontentloaded" });

    // The member with a photoPath resolves to an <img> from the mocked blob.
    const photoAvatar = page.getByTestId(`avatar-crew-${WITH_PHOTO_ID}`);
    await expect(photoAvatar).toBeVisible();
    await expect(photoAvatar).toHaveJSProperty("tagName", "IMG");

    // The member without a photo falls back to the initials chip (a DIV).
    const initialsAvatar = page.getByTestId(`avatar-crew-${NO_PHOTO_ID}`);
    await expect(initialsAvatar).toBeVisible();
    await expect(initialsAvatar).toHaveJSProperty("tagName", "DIV");
  });
});
