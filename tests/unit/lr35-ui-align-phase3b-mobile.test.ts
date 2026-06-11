/**
 * UI Align Phase 3B — mobile/tablet admin home re-skin.
 *
 * Pins the visual contract for client/src/pages/home.tsx:
 *   - Both the admin branch and the UserPortalHome branch wrap
 *     their root in the dark `ops-surface` shell so the mobile
 *     preview matches the Figma spec (no light `bg-background`
 *     shell).
 *   - The admin branch (Figma 1:1417, "Replace fully") renders a
 *     clean Admin Hubs list: a title + role pill, and one tappable
 *     card per accessible hub derived from the nav policy
 *     (`getAdminPrimaryCategories` + the remaining
 *     `navigationCategories`), gated by the account's `hubAccess`
 *     allow-list. The legacy command-center widgets (KPI grid, AI
 *     recommendation, Critical Attention, module shortcuts) are
 *     gone.
 *   - None of the admin widgets leak into the user-portal branch.
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
    // from the "Admin portal" derivation comment through the hub-list
    // footer testid.
    const adminMatch = homeSrc.match(/\/\/ Admin portal:[\s\S]*?data-testid="text-hubs-footer"/);
    expect(adminMatch).not.toBeNull();
    adminBranch = adminMatch![0];
  });

  it("wraps the admin branch in the dark ops-surface shell", () => {
    expect(adminBranch).toMatch(/ops-surface/);
    expect(adminBranch).toMatch(/ops-safe-bottom/);
    expect(adminBranch).toMatch(/data-testid="shell-admin-hubs"/);
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

  it("renders the Admin Hubs list with a per-hub card", () => {
    expect(adminBranch).toMatch(/data-testid="text-admin-hubs-title"/);
    expect(adminBranch).toMatch(/data-testid="list-admin-hubs"/);
    expect(adminBranch).toMatch(/data-testid={`card-hub-\$\{hub\.id\}`}/);
    // Legacy command-center widgets must be fully removed.
    expect(adminBranch).not.toMatch(/data-testid="grid-admin-kpis"/);
    expect(adminBranch).not.toMatch(/data-testid="card-ai-recommendation"/);
    expect(adminBranch).not.toMatch(/data-testid="section-critical-attention"/);
    expect(adminBranch).not.toMatch(/data-testid="section-module-shortcuts"/);
  });

  it("surfaces the role pill and per-hub granted-access affordance", () => {
    expect(adminBranch).toMatch(/data-testid="pill-role"/);
    expect(adminBranch).toMatch(/data-testid={`pill-granted-\$\{hub\.id\}`}/);
  });

  it("shows locked hubs as non-actionable alongside accessible ones", () => {
    // Task #359: the overview lists EVERY hub — locked ones are rendered
    // but non-actionable (no Link wrapper, aria-disabled, a Locked pill).
    expect(adminBranch).toMatch(/data-testid={`pill-locked-\$\{hub\.id\}`}/);
    expect(adminBranch).toMatch(/aria-disabled="true"/);
    // The no-accessible-hub banner replaces the old blank fallback shell.
    expect(adminBranch).toMatch(/data-testid="banner-no-hubs"/);
    expect(adminBranch).not.toMatch(/data-testid="shell-admin-no-hubs"/);
  });

  it("derives the hub list from the nav policy, not mock data", () => {
    // Admin primaries + remaining nav categories, deduped — every hub
    // (accessible or locked) is listed, sourced from the real policy module.
    expect(adminBranch).toMatch(/getAdminPrimaryCategories\(\)/);
    expect(adminBranch).toMatch(/navigationCategories/);
    expect(adminBranch).toMatch(/allHubs/);
  });

  it("gates the hub list by the account's hubAccess allow-list", () => {
    // The per-hub allow-list is the #194 security perimeter: a hub the
    // account is not granted must never render even if it appears in the
    // nav config.
    expect(adminBranch).toMatch(/isHubAllowed/);
    expect(adminBranch).toMatch(/permissions\.hubAccess/);
  });

  it("does not leak admin command-center widgets into the user-portal branch", () => {
    expect(userBranch).not.toMatch(/data-testid="shell-admin-hubs"/);
    expect(userBranch).not.toMatch(/data-testid="list-admin-hubs"/);
    expect(userBranch).not.toMatch(/data-testid="pill-role"/);
    expect(userBranch).not.toMatch(/card-hub-/);
  });

  it("adds a greeting header to the user-portal branch", () => {
    expect(userBranch).toMatch(/data-testid="text-user-greeting-label"/);
    expect(userBranch).toMatch(/data-testid="text-user-greeting-name"/);
  });
});
