/**
 * LR-2 Journey: PR → PO → Receive → Stock update.
 *
 * The full procurement loop:
 *   1. Create a purchase requisition from a low-stock part.
 *   2. Convert PR → PO (approval + supplier selection).
 *   3. Receive PO against a goods receipt note (full or partial).
 *   4. Verify stock_qty was incremented and the linked work order
 *      that triggered the PR sees the new ROB.
 *
 * Blocked on LR-3: this needs a deterministic procurement seed
 * (vessel + part + supplier + open PR pointing at the low-stock part).
 * The seed harness lives in scripts/seed/* but does not yet have a
 * "procurement-journey" preset. Once that lands, flip the fixme into
 * the real assertions below.
 */

import { test, expect } from "@playwright/test";

test.describe("Procurement journey — PR → PO → Receive → Stock", () => {
  test.fixme(
    "creates a PR, converts it to a PO, receives it, and updates stock",
    async ({ page }) => {
      // [LR-3] Seed: an org + vessel + part with stock_qty below
      // reorder_point + a supplier already on the part's supplier list.

      await page.goto("/inventory");
      await expect(page.getByTestId("page-inventory")).toBeVisible();

      // Click low-stock part → "Create PR" → fill quantity → submit.
      // Navigate to /purchase-orders, find draft PR, approve to PO.
      // Open PO, click "Receive", confirm received quantity.
      // Back on /inventory, the row's stock_qty should reflect the
      // received quantity within 2s (cache invalidation window).

      throw new Error("LR-3 seed not yet wired");
    }
  );
});
