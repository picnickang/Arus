/**
 * Crew profile + Add/Edit wizard contracts (Task #340) — sandbox-runnable.
 *
 * The reshaped crew profile, 3-step Add/Edit wizard, and alert log were only
 * verified by type-checking + code review. The full behavioral coverage lives
 * in the route-mocked browser journey
 * (`tests/playwright/journeys/crew-profile-wizard.spec.ts`), which CI runs in a
 * real browser. This unit lane pins the same contracts in two sandbox-safe
 * ways (the unit jest config is node-env with `tsx: false`, so it cannot
 * render React):
 *
 *  - Pure-logic: `crewStatusLabel` maps every lifecycle enum value to its
 *    explicit human label (so the header/Overview never collapse to a bare
 *    Active/Inactive for on_leave/standby/onboard).
 *  - Source-scan: the wizard step-targeting wiring (Assign -> assignment step,
 *    Edit/Add -> step 0, reset-on-close) and the alert-log loading gate
 *    (skeleton before the empty state) are actually wired into the components.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { crewStatusLabel, CREW_STATUSES } from "@/features/crew/lib/crewManagementUtils";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("crewStatusLabel — explicit lifecycle status", () => {
  it("maps each lifecycle enum value to its explicit label", () => {
    expect(crewStatusLabel("on_leave")).toBe("On leave");
    expect(crewStatusLabel("standby")).toBe("Standby");
    expect(crewStatusLabel("onboard")).toBe("Onboard");
    expect(crewStatusLabel("active")).toBe("Active");
  });

  it("falls back to Active for a missing status, passes unknown through", () => {
    expect(crewStatusLabel(null)).toBe("Active");
    expect(crewStatusLabel(undefined)).toBe("Active");
    expect(crewStatusLabel("")).toBe("Active");
    // An unknown value is shown verbatim rather than swallowed.
    expect(crewStatusLabel("seconded")).toBe("seconded");
  });

  it("every catalogued status resolves to a non-empty label", () => {
    for (const s of CREW_STATUSES) {
      expect(crewStatusLabel(s.value)).toBe(s.label);
    }
    // The non-trivial enum values (beyond active) are all present.
    const values = CREW_STATUSES.map((s) => s.value);
    expect(values).toEqual(expect.arrayContaining(["on_leave", "standby", "onboard"]));
  });
});

describe("source-scan: profile status surfaces the enum label", () => {
  const src = read("client/src/components/unified-crew-components.tsx");

  it("header chip + Overview render crewStatusLabel(crew.status), not a bare flag", () => {
    // Both the header chip and the Overview Status field must route through the
    // enum label (only collapsing to Inactive when the member is inactive).
    const occurrences =
      src.split('crew.active ? crewStatusLabel(crew.status) : "Inactive"').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(src).toContain('data-testid="chip-status"');
  });
});

describe("source-scan: wizard step targeting", () => {
  const index = read("client/src/components/UnifiedCrewManagement/index.tsx");
  const dialog = read("client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx");

  it("Assign jumps to the assignment step; Edit opens at step 0", () => {
    // onAssign bumps the step intent to the assignment (Profile) step (index 1);
    // onEdit explicitly resets it to step 0.
    const assignIdx = index.indexOf("onAssign={() => {");
    const editIdx = index.indexOf("onEdit={() => {");
    expect(assignIdx).toBeGreaterThan(-1);
    expect(editIdx).toBeGreaterThan(-1);

    const assignBlock = index.slice(assignIdx, assignIdx + 400);
    const editBlock = index.slice(editIdx, editIdx + 400);
    expect(assignBlock).toContain("setCrewFormInitialStep(1)");
    expect(editBlock).toContain("setCrewFormInitialStep(0)");

    // The intent is forwarded to the wizard.
    expect(index).toContain("initialStep={crewFormInitialStep}");
  });

  it("the step intent self-resets to 0 whenever the form is closed", () => {
    expect(index).toContain("if (!d.isAddCrewDialogOpen && !d.isEditCrewDialogOpen)");
    expect(index).toContain("setCrewFormInitialStep(0)");
  });

  it("the wizard applies initialStep on open and resets to 0 on close", () => {
    // STEPS order: identity first, assignment second, pay last.
    const identifyIdx = dialog.indexOf('key: "identify"');
    const profileIdx = dialog.indexOf('key: "profile"');
    const payIdx = dialog.indexOf('key: "pay"');
    expect(identifyIdx).toBeGreaterThan(-1);
    expect(identifyIdx).toBeLessThan(profileIdx);
    expect(profileIdx).toBeLessThan(payIdx);

    // On open the wizard seeds the requested step; on close it falls back to 0,
    // and the open effect re-runs when initialStep changes.
    expect(dialog).toContain("setStep(initialStep)");
    expect(dialog).toContain("setStep(0)");
    expect(dialog).toContain("[open, d.editingCrew, initialStep]");
  });
});

describe("source-scan: alert-log loading gate", () => {
  const src = read("client/src/components/CrewNotificationSettingsTab.tsx");

  it("renders a skeleton while loading BEFORE the empty 'No active alerts' state", () => {
    const loadingIdx = src.indexOf("certData.isLoading || docsLoading ?");
    const skeletonIdx = src.indexOf("<Skeleton", loadingIdx);
    const noAlertsIdx = src.indexOf('data-testid="text-no-alerts"');
    expect(loadingIdx).toBeGreaterThan(-1);
    expect(skeletonIdx).toBeGreaterThan(loadingIdx);
    // The empty-state branch must come AFTER the loading branch so the log never
    // flashes "No active alerts" while documents/certifications are in flight.
    expect(noAlertsIdx).toBeGreaterThan(skeletonIdx);
  });
});
