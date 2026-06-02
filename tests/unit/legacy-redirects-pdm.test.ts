/**
 * Legacy PdM redirect contract — regression test
 *
 * Phase-1 cleanup removed the standalone PdM routes (/pdm-dashboard,
 * /health-monitor, /pdm-pack, /pdm/schedule) and folded them into the
 * Equipment Intelligence and PdM Platform hubs. External bookmarks and any
 * lingering deep links must keep resolving to the canonical targets, with
 * tab deep-links preserved as query strings.
 *
 * This pins the configuration contract: every retired PdM route must appear
 * in `routeMigrations`, point at the expected canonical target, and surface
 * through the consolidated `legacyRedirects` map the Router consumes.
 */

import { describe, it, expect } from "@jest/globals";
import { routeMigrations } from "@/config/navigationConfig";
import { legacyRedirects } from "@/routes/legacy-redirects";

const EXPECTED_PDM_REDIRECTS: Record<string, string> = {
  "/pdm-dashboard": "/equipment-intelligence",
  "/health-monitor": "/equipment-intelligence",
  "/pdm-pack": "/pdm-platform?tab=diagnostics",
  "/pdm/schedule": "/pdm-platform?tab=schedule",
};

describe("Legacy PdM redirects", () => {
  it("routeMigrations maps every retired PdM route to its canonical target", () => {
    for (const [from, to] of Object.entries(EXPECTED_PDM_REDIRECTS)) {
      expect(routeMigrations[from]).toBe(to);
    }
  });

  it("tab deep-links survive as query strings on the migrated target", () => {
    expect(routeMigrations["/pdm-pack"]).toContain("?tab=diagnostics");
    expect(routeMigrations["/pdm/schedule"]).toContain("?tab=schedule");
  });

  it("legacyRedirects exposes each retired PdM route for the Router", () => {
    const map = new Map(legacyRedirects.map((r) => [r.from, r.to]));
    for (const [from, to] of Object.entries(EXPECTED_PDM_REDIRECTS)) {
      expect(map.get(from)).toBe(to);
    }
  });

  it("does not 404: no retired PdM route maps to itself or an empty target", () => {
    for (const from of Object.keys(EXPECTED_PDM_REDIRECTS)) {
      const to = routeMigrations[from];
      expect(to).toBeTruthy();
      expect(to).not.toBe(from);
    }
  });
});
