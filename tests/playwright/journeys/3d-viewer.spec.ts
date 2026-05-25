/**
 * LR-2 Journey: 3D Digital Twin viewer.
 *
 * Walks the documented UX contract for /vessels/:id/3d:
 *   1. Page loads the vessel's GLB model.
 *   2. Equipment pins render and are clickable.
 *   3. Clicking a pin tints downstream equipment amber (dependency
 *      overlay from Push A2 graph).
 *   4. The 6-hour replay scrubber loads twin-state history and updates
 *      the in-scene state as the scrubber moves.
 *
 * Blocked on LR-3: requires (a) a vessel with an uploaded GLB in
 * object storage and (b) at least 6h of twin-state history. The GLB
 * round-trip is expensive in CI without object-storage credentials;
 * a synthesized "mini-GLB" fixture would unblock this. The state-
 * history requirement is met by running the physics-aware vessel
 * simulator for 6 simulated hours.
 */

import { test, expect } from "@playwright/test";

test.describe("3D Digital Twin journey", () => {
  test.fixme(
    "loads GLB, selects a pin, and scrubs the 6h replay",
    async ({ page }) => {
      // [LR-3] Seed: vessel + uploaded GLB + 6h twin-state history.
      const vesselId = "LR3-FIXTURE-VESSEL";

      await page.goto(`/vessels/${vesselId}/3d`);
      await expect(page.getByTestId("viewer-3d")).toBeVisible();

      // Wait for GLTFLoader to mount the scene (a single canvas + a
      // pin overlay element). Click the first pin, assert downstream
      // amber tint via the dependency-overlay test ids. Drag the
      // scrubber from t-0 to t-6h and assert pin state changes.

      throw new Error("LR-3 GLB + twin-state-history fixtures not yet wired");
    },
  );
});
