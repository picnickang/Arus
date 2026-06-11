/**
 * LR-2 Journey: AMOS import flow (UI smoke).
 *
 * Backend correctness for AMOS parsing, validation, and idempotency
 * is already pinned by `tests/integration/import-amos-golden.test.ts`.
 * This spec is the browser-level smoke that an admin can actually
 * complete the upload → preview → import flow without console errors.
 *
 * Blocked on LR-3: the admin import page has not yet been migrated to
 * the simplified-nav surface (post-LR-1). Once `/admin/import/amos`
 * is wired, this spec uploads `tests/fixtures/imports/amos-equipment-valid.csv`,
 * asserts the preview row counts match the golden, and confirms the
 * post-import summary card.
 */

import { test, expect } from "@playwright/test";

test.describe("AMOS import journey (UI)", () => {
  test.fixme("uploads the valid fixture and confirms the preview matches", async ({ page }) => {
    // [LR-3] Requires /admin/import/amos to be reachable in the
    // simplified-nav admin portal.

    await page.goto("/admin/import/amos");
    await expect(page.getByTestId("page-import-amos")).toBeVisible();

    // setInputFiles → "Preview" → assert imported=5/skipped=0.
    // Click "Import" → assert success toast + summary card.

    throw new Error("LR-3 /admin/import/amos page not yet on simplified nav");
  });
});
