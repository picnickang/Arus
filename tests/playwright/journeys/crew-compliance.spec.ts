/**
 * LR-2 Journey: Crew compliance report.
 *
 * Validate the end-to-end crew compliance flow:
 *   1. Open /crew-management → /compliance.
 *   2. Run the report for a vessel.
 *   3. Assert STCW-required certificates appear with expiry status
 *      (valid / expiring-soon / expired).
 *   4. Export PDF and confirm a downloadable artefact is produced.
 *
 * Blocked on LR-3: requires a crew certificate seed fixture (a vessel
 * with at least three crew records, each carrying a representative
 * mix of valid / expiring / expired certificates). Backend assertions
 * for the export pipeline already exist in
 * `tests/integration/compliance-exports.test.ts`; this spec is the
 * missing browser-level smoke.
 */

import { test, expect } from "@playwright/test";

test.describe("Crew compliance report journey", () => {
  test.fixme(
    "produces a compliance report with expiry buckets and a PDF export",
    async ({ page }) => {
      // [LR-3] Seed: crew + certs spanning the three expiry buckets.

      await page.goto("/crew-management");
      await expect(page.getByTestId("page-crew-management")).toBeVisible();

      // Open compliance tab → pick vessel → "Run report".
      // Assert at least one row in each bucket.
      // Click "Export PDF" → wait for downloadEvent → assert .pdf.

      throw new Error("LR-3 crew-cert seed not yet wired");
    }
  );
});
