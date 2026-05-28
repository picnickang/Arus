/**
 * UI Align Phase 3B — mobile/tablet command-center re-skin.
 *
 * Pins the visual contract for client/src/pages/home.tsx:
 *   - Both the admin branch and the UserPortalHome branch wrap
 *     their root in the dark `ops-surface` shell with
 *     `ops-safe-bottom` so the mobile preview matches the
 *     attached spec image (no light `bg-background` shell).
 *   - The admin branch renders the 2x2 KPI grid (Critical
 *     Alerts / Work Orders / At-Risk Assets / Crew Issues), the
 *     elevated-risk status pill, the AI Recommendation card,
 *     the Critical Attention list, and the 5-module shortcut
 *     grid sourced from `getPrimaryCategoriesForRole`.
 *   - The admin command-center widgets do NOT leak into the
 *     user-portal branch.
 *
 * Same Jest harness constraint as the other LR-3.5 UI-align tests
 * in this suite: `testEnvironment: "node"` and the swc/ESM
 * transform mean we cannot mount React. We assert via source-file
 * scanning, mirroring `lr35-ui-align-user-portal-home.test.ts`.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function readSrc(p: string): Promise<string> {
  return readFile(resolve(process.cwd(), p), "utf8");
}

describe("UI Align Phase 3B — home.tsx dark ops-shell", () => {
  let homeSrc = "";
  let userBranch = "";
  let adminBranch = "";

  beforeAll(async () => {
    homeSrc = await readSrc("client/src/pages/home.tsx");

    const userMatch = homeSrc.match(/function UserPortalHome\([\s\S]*?\n\}\n/);
    expect(userMatch).not.toBeNull();
    userBranch = userMatch![0];

    // Admin branch lives inside HomePage()'s final return — everything
    // from the policyCategoryIds derivation through the FAB button.
    const adminMatch = homeSrc.match(
      /\/\/ Admin portal:[\s\S]*?<Plus className="h-6 w-6" \/>/,
    );
    expect(adminMatch).not.toBeNull();
    adminBranch = adminMatch![0];
  });

  it("wraps the admin branch in the dark ops-surface shell", () => {
    expect(adminBranch).toMatch(/ops-surface/);
    expect(adminBranch).toMatch(/ops-safe-bottom/);
    expect(adminBranch).toMatch(/data-testid="shell-admin-command-center"/);
    // The legacy light shell must be gone from the admin branch.
    expect(adminBranch).not.toMatch(/bg-background pb-20 md:pb-4/);
  });

  it("wraps the user-portal branch in the dark ops-surface shell", () => {
    expect(userBranch).toMatch(/ops-surface/);
    expect(userBranch).toMatch(/data-testid="shell-user-portal"/);
    expect(userBranch).not.toMatch(/bg-background pb-20 md:pb-4/);
    // #218: BottomNav is hidden for the user portal, so the shell
    // no longer reserves the ~5rem of mobile clearance that
    // `ops-safe-bottom` adds (or the matching `pb-24`). A calm
    // `pb-6` replaces both. Admin branch keeps `ops-safe-bottom`
    // and is asserted separately above.
    expect(userBranch).not.toMatch(/ops-safe-bottom/);
    expect(userBranch).not.toMatch(/pb-24/);
  });

  it("renders the 4-KPI grid in the admin branch", () => {
    expect(adminBranch).toMatch(/data-testid="grid-admin-kpis"/);
    // OpsMetricCard forwards `testId` -> data-testid at render time.
    expect(adminBranch).toMatch(/testId="kpi-critical-alerts"/);
    expect(adminBranch).toMatch(/testId="kpi-work-orders"/);
    expect(adminBranch).toMatch(/testId="kpi-at-risk-assets"/);
    expect(adminBranch).toMatch(/testId="kpi-crew-issues"/);
    // Mobile-first: 2-col on phones, 4-col from md upward.
    expect(adminBranch).toMatch(/grid-cols-2 gap-3 md:grid-cols-4/);
  });

  it("surfaces the elevated-risk status pill and AI recommendation card", () => {
    expect(adminBranch).toMatch(/pill-elevated-risk/);
    expect(adminBranch).toMatch(/pill-nominal-risk/);
    expect(adminBranch).toMatch(/data-testid="card-ai-recommendation"/);
    // Regression guard: the AI Recommendation card must route to a
    // registered path. `/agent` is NOT registered in `client/src/routes/`
    // (only `/agent/activity` is) — landing there would hit NotFound.
    expect(adminBranch).toMatch(/setLocation\("\/findings"\)/);
    expect(adminBranch).not.toMatch(/setLocation\("\/agent"\)/);
  });

  it("renders the Critical Attention list keyed off useAttentionItems", () => {
    expect(adminBranch).toMatch(/data-testid="section-critical-attention"/);
    expect(adminBranch).toMatch(/row-critical-attention-/);
    expect(adminBranch).toMatch(/link-view-all-attention/);
  });

  it("renders the 5-module shortcut grid from the role policy", () => {
    expect(adminBranch).toMatch(/data-testid="section-module-shortcuts"/);
    expect(adminBranch).toMatch(/data-testid="grid-module-shortcuts"/);
    // The shortcut row collapses to the 5 policy categories on
    // desktop — must use lg:grid-cols-5 to match the BottomNav.
    expect(adminBranch).toMatch(/lg:grid-cols-5/);
  });

  it("does not leak admin command-center widgets into the user-portal branch", () => {
    expect(userBranch).not.toMatch(/data-testid="shell-admin-command-center"/);
    expect(userBranch).not.toMatch(/data-testid="grid-admin-kpis"/);
    expect(userBranch).not.toMatch(/data-testid="section-module-shortcuts"/);
    expect(userBranch).not.toMatch(/data-testid="card-ai-recommendation"/);
  });

  it("adds a greeting header to the user-portal branch", () => {
    expect(userBranch).toMatch(/data-testid="text-user-greeting-label"/);
    expect(userBranch).toMatch(/data-testid="text-user-greeting-name"/);
  });
});
