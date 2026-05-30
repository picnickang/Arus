/**
 * UI Align Phase 4 — User Portal Dashboard.
 *
 * Pins the contract described in task #188:
 *   - The user-portal branch of /home renders the new cards
 *     (current vessel, shift, active alerts, safety notices,
 *     upcoming maintenance) and preserves the three stable
 *     empty-state ids (`empty-attention`, `empty-my-tasks`,
 *     `empty-feedback-history`) that other surfaces key off.
 *   - The user-portal branch does NOT mount the admin
 *     `WorkflowCommandCenter` (admin module must not leak).
 *   - `SwitchPortalButton` remains visible in the user branch.
 *   - role-navigation-policy still resolves the user role to
 *     Dashboard + Feedback only.
 *   - The view-model derivers (`deriveAlertSlots`,
 *     `deriveShiftStatus`) behave per the slot contract.
 *
 * Same Jest harness constraint as the other client-side LR-3.5
 * tests in this suite: `testEnvironment: "node"` and the swc/ESM
 * transform mean we cannot mount React. We assert the page
 * contract via source-file scanning, mirroring the pattern
 * established in `lr35-pdm-tenancy-hardening.test.ts`.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  deriveAlertSlots,
  deriveSafetyNotices,
  deriveSafetyStatus,
  deriveShiftStatus,
} from "../../client/src/application/user-dashboard/derivers";
import { getPrimaryCategoriesForRole } from "../../client/src/application/navigation/role-navigation-policy";

async function readSrc(p: string): Promise<string> {
  return readFile(resolve(process.cwd(), p), "utf8");
}

describe("UI Align Phase 4 — user-portal page contract", () => {
  let homeSrc = "";
  let userBranch = "";

  beforeAll(async () => {
    homeSrc = await readSrc("client/src/pages/home.tsx");
    // Isolate the UserPortalHome component body — the only place the
    // user-portal cards may legitimately render.
    const match = homeSrc.match(
      /function UserPortalHome\([\s\S]*?\n\}\n/,
    );
    expect(match).not.toBeNull();
    userBranch = match![0];
  });

  it("renders the five Phase 4 cards inside the user-portal branch", () => {
    expect(userBranch).toMatch(/<CurrentVesselCard\b/);
    expect(userBranch).toMatch(/<ShiftStatusCard\b/);
    expect(userBranch).toMatch(/<ActiveAlertsCard\b/);
    expect(userBranch).toMatch(/<SafetyNoticesCard\b/);
    expect(userBranch).toMatch(/<UpcomingMaintenanceCard\b/);
  });

  it("preserves the stable empty-state ids in their respective branches", () => {
    // empty-attention + empty-my-tasks live in the user-portal branch.
    expect(userBranch).toMatch(/data-testid="empty-attention"/);
    expect(userBranch).toMatch(/data-testid="empty-my-tasks"/);
    // empty-feedback-history is owned by the feedback page (the third
    // user-portal surface). Pin it there.
    return readSrc("client/src/pages/feedback.tsx").then((feedback) => {
      expect(feedback).toMatch(/data-testid="empty-feedback-history"/);
    });
  });

  it("does NOT leak admin modules into the user portal", () => {
    // WorkflowCommandCenter is the admin command center — it must
    // only render in the admin branch.
    expect(userBranch).not.toMatch(/<WorkflowCommandCenter\b/);
    // The 8-category NavigationCard grid is admin-only too.
    expect(userBranch).not.toMatch(/<NavigationCard\b/);
    // QuickWorkOrderSheet is the admin floating action.
    expect(userBranch).not.toMatch(/<QuickWorkOrderSheet\b/);
  });

  it("keeps SwitchPortalButton visible in the user portal", () => {
    expect(userBranch).toMatch(/<SwitchPortalButton\b/);
  });

  it("does not call useQuery directly in the user-portal branch", () => {
    // All data access for the user portal must go through the
    // user-dashboard view-model. The branch may call view-model
    // hooks and the shared useAttentionItems helper, but not
    // useQuery directly.
    expect(userBranch).not.toMatch(/\buseQuery\s*\(/);
    expect(userBranch).toMatch(/useUserDashboardViewModel\s*\(/);
  });
});

describe("UI Align Phase 4 — role-navigation-policy still scopes the user portal", () => {
  it("returns exactly Dashboard + Feedback / Flags for the user role", () => {
    const cats = getPrimaryCategoriesForRole("deck_officer");
    expect(cats.map((c) => c.name)).toEqual(["Dashboard", "Feedback / Flags"]);
  });

  it("returns the admin five-category set for an admin role", () => {
    const cats = getPrimaryCategoriesForRole("system_admin").map((c) => c.id);
    // Phase 3 anchored five categories; verify none of them is a
    // synthetic user-portal id.
    expect(cats).toContain("maintenance");
    expect(cats).not.toContain("user-dashboard");
    expect(cats).not.toContain("user-feedback");
  });
});

describe("UI Align Phase 4 — view-model derivers", () => {
  it("deriveAlertSlots returns unacknowledged alerts and drops acked rows", () => {
    const out = deriveAlertSlots([
      {
        id: "a1",
        title: "Bilge Pump 2 Overheating",
        severity: "high",
        category: "equipment",
        acknowledged: false,
      },
      {
        id: "ack",
        title: "Already acked",
        severity: "high",
        acknowledged: true,
      },
    ]);
    expect(out.activeAlerts.map((a) => a.id)).toEqual(["a1"]);
    expect(out.activeAlerts[0].severity).toBe("high");
  });

  it("deriveAlertSlots normalises unknown severities to 'low'", () => {
    const out = deriveAlertSlots([
      { id: "u1", title: "Weird", severity: "purple", acknowledged: false },
    ]);
    expect(out.activeAlerts[0].severity).toBe("low");
  });

  it("deriveSafetyNotices maps active bulletins to title + postedAt, capped at three", () => {
    const out = deriveSafetyNotices([
      { id: "b1", title: "Lifeboat drill", effectiveDate: "2026-05-20T00:00:00Z" },
      { id: "b2", title: "Hot work permit", createdAt: "2026-05-19T00:00:00Z" },
      { id: "inactive", title: "Old notice", active: false, effectiveDate: "2026-05-18T00:00:00Z" },
      { id: "b3", title: "PPE reminder" },
      { id: "b4", title: "Fourth notice" },
    ]);
    // Inactive rows are dropped; only the first three actives survive.
    expect(out.map((n) => n.id)).toEqual(["b1", "b2", "b3"]);
    expect(out[0].title).toBe("Lifeboat drill");
    expect(out[0].postedAt).toBe("2026-05-20T00:00:00Z");
    // Falls back to createdAt when effectiveDate is absent.
    expect(out[1].postedAt).toBe("2026-05-19T00:00:00Z");
  });

  it("deriveSafetyStatus reports good / caution / critical from active bulletins", () => {
    expect(deriveSafetyStatus([])).toMatchObject({ level: "good", activeCount: 0 });
    expect(
      deriveSafetyStatus([{ id: "x", title: "Advisory", severity: "advisory" }]),
    ).toMatchObject({ level: "caution", activeCount: 1 });
    expect(
      deriveSafetyStatus([
        { id: "c", title: "Grounding risk", severity: "critical" },
        { id: "a", title: "Advisory", severity: "advisory" },
      ]),
    ).toMatchObject({ level: "critical", activeCount: 2 });
  });

  it("deriveSafetyStatus ignores inactive bulletins", () => {
    expect(
      deriveSafetyStatus([
        { id: "old", title: "Expired", severity: "critical", active: false },
      ]),
    ).toMatchObject({ level: "good", activeCount: 0 });
  });

  it("deriveShiftStatus reports On duty mid-shift and Off duty outside", () => {
    const noon = new Date("2026-05-26T12:00:00");
    const on = deriveShiftStatus(noon);
    expect(on.label).toBe("On duty");
    expect(on.remainingMinutes).toBeGreaterThan(0);
    expect(on.progressPercent).toBeGreaterThan(0);
    expect(on.progressPercent).toBeLessThan(100);

    const earlyMorning = new Date("2026-05-26T05:00:00");
    const off = deriveShiftStatus(earlyMorning);
    expect(off.label).toBe("Off duty");
    expect(off.remainingMinutes).toBe(0);
    expect(off.progressPercent).toBe(0);
  });
});
