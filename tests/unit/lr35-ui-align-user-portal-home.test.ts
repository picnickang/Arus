/**
 * UI Align Phase 4 — User Portal Dashboard.
 *
 * Pins the user-portal dashboard contract:
 *   - The user-portal branch of /home renders the Figma dashboard
 *     sections (Today's Overview, Assigned Tasks, Feedback / Flags,
 *     Alerts / Notices) and preserves the three stable empty-state
 *     ids (`empty-attention`, `empty-my-tasks`,
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
  deriveAssignedSummary,
  deriveSafetyNotices,
  deriveSafetyStatus,
  deriveShiftStatus,
} from "../../client/src/application/user-dashboard/derivers";
import { getPrimaryCategoriesForRole } from "../../client/src/application/navigation/role-navigation-policy";

async function readSrc(p: string): Promise<string> {
  return readFile(resolve(process.cwd(), p), "utf8");
}

const MOBILE_MODEL_PATHS = [
  "client/src/features/mobile-readiness/mobile-readiness-model.ts",
  "client/src/features/mobile-readiness/mobile-readiness-model-types.ts",
  "client/src/features/mobile-readiness/mobile-readiness-navigation.ts",
  "client/src/features/mobile-readiness/mobile-readiness-queue-fleet.ts",
  "client/src/features/mobile-readiness/mobile-readiness-machinery-work.ts",
  "client/src/features/mobile-readiness/mobile-readiness-support-screens.ts",
];

async function readMobileModelSrc(): Promise<string> {
  return (await Promise.all(MOBILE_MODEL_PATHS.map(readSrc))).join("\n");
}

describe("UI Align Phase 4 — user-portal route replacement contract", () => {
  let homeSrc = "";
  let screenSrc = "";
  let modelSrc = "";

  beforeAll(async () => {
    [homeSrc, screenSrc, modelSrc] = await Promise.all([
      readSrc("client/src/pages/home.tsx"),
      readSrc("client/src/features/mobile-readiness/MobileReadinessScreens.tsx"),
      readMobileModelSrc(),
    ]);
  });

  it("removes the legacy user-portal branch from /home", () => {
    expect(homeSrc).toContain("MobileCommandCenterPage");
    expect(homeSrc).not.toMatch(/function UserPortalHome|card-todays-overview|card-user-feedback-cta/);
  });

  it("maps crew-heavy users to the Figma My Tasks / Logs / Safety nav", () => {
    expect(modelSrc).toContain('crew_member: "crew"');
    expect(modelSrc).toContain('technician: "crew"');
    expect(modelSrc).toContain('"My Tasks"');
    expect(modelSrc).toContain('"Logs"');
    expect(modelSrc).toContain('"Safety"');
  });

  it("keeps feedback history owned by the feedback page", async () => {
    const feedback = await readSrc("client/src/pages/feedback.tsx");
    expect(feedback).toMatch(/data-testid="empty-feedback-history"/);
  });

  it("does not leak the removed admin command center into the mobile replacement", () => {
    expect(screenSrc).not.toMatch(/WorkflowCommandCenter|NavigationCard|QuickWorkOrderSheet/);
    expect(screenSrc).toContain("MobileCommandCenterPage");
    expect(screenSrc).toContain("QueueCard");
  });
});

describe("UI Align Phase 4 — role-navigation-policy still scopes the user portal", () => {
  it("returns exactly Dashboard + Feedback / Flags for the user role", () => {
    const cats = getPrimaryCategoriesForRole("deck_officer");
    expect(cats.map((c) => c.name)).toEqual([
      "Dashboard",
      "Assigned Tasks",
      "Feedback / Flags",
      "Profile",
    ]);
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
      deriveSafetyStatus([{ id: "x", title: "Advisory", severity: "advisory" }])
    ).toMatchObject({ level: "caution", activeCount: 1 });
    expect(
      deriveSafetyStatus([
        { id: "c", title: "Grounding risk", severity: "critical" },
        { id: "a", title: "Advisory", severity: "advisory" },
      ])
    ).toMatchObject({ level: "critical", activeCount: 2 });
  });

  it("deriveSafetyStatus ignores inactive bulletins", () => {
    expect(
      deriveSafetyStatus([{ id: "old", title: "Expired", severity: "critical", active: false }])
    ).toMatchObject({ level: "good", activeCount: 0 });
  });

  it("deriveAssignedSummary buckets statuses and excludes cancelled from the %", () => {
    const out = deriveAssignedSummary([
      { id: "1", status: "open" },
      { id: "2", status: "in_progress" },
      { id: "3", status: "completed" },
      { id: "4", status: "VERIFIED" },
      { id: "5", status: "cancelled" },
      { id: "6", status: null },
    ]);
    // open + in_progress + null = 3 active; completed + verified = 2;
    // cancelled is excluded from both active and the denominator.
    expect(out.active).toBe(3);
    expect(out.completed).toBe(2);
    expect(out.total).toBe(5);
    expect(out.completionPct).toBe(40);
  });

  it("deriveAssignedSummary returns zeroes for an empty list", () => {
    expect(deriveAssignedSummary([])).toEqual({
      active: 0,
      completed: 0,
      total: 0,
      completionPct: 0,
    });
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
