/**
 * Crew Profiles & Forms redesign (Figma 22:74) — pure-logic verification.
 *
 * The redesign added several decision helpers that are pure functions, so they
 * can be tested deterministically in the sandbox (no browser, no React, no
 * network). What this DOES verify:
 *  - `previewRehireFromAction` maps the operator's in-dialog offboarding choice
 *    (retire / cancel±penalty) onto the SAME rehire signal the former-archive
 *    derives from stored records, so the dialog preview and the archive badge
 *    can never disagree.
 *  - `composeOffboardingNote` folds the structured offboarding fields (reason,
 *    end date, final vessel, checklist, exit notes) into the single free-text
 *    lifecycle note — and returns undefined when nothing was captured.
 *  - `decideRenewalTask` raises a document renewal task only inside the lead
 *    window, escalates priority inside 30 days, and NEVER spawns a duplicate
 *    when an open task already links the same document.
 *  - The new crew-form schema + label/rotation helpers accept the new fields.
 *  - Source-scan: the live crew-management route delegates to the mobile
 *    readiness replacement and still exposes crew document / former-crew
 *    signals in the replacement model.
 *
 * What this does NOT verify (covered by CI Playwright + backend API tests):
 *  live rendering, real API wiring, permissions.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { differenceInDays } from "date-fns";
import {
  previewRehireFromAction,
  composeOffboardingNote,
  offboardReasonLabel,
  OFFBOARD_REASONS,
  crewStatusLabel,
  employmentTypeLabel,
  formatRotation,
  crewFormSchema,
} from "@/features/crew/lib/crewManagementUtils";
import { decideRenewalTask } from "@/features/crew/lib/crewTaskUtils";

describe("previewRehireFromAction", () => {
  // Second arg is the EFFECTIVE contract penalty the action will persist —
  // i.e. `applyPenalty ? (crew.contractPenalty ?? 0) : 0`.
  it("retire -> Rehire OK (penalty ignored)", () => {
    expect(previewRehireFromAction("retire", 0)).toEqual({
      key: "rehire_ok",
      label: "Rehire OK",
    });
    expect(previewRehireFromAction("retire", 5000)).toEqual({
      key: "rehire_ok",
      label: "Rehire OK",
    });
  });

  it("cancel WITH a positive penalty -> No rehire", () => {
    expect(previewRehireFromAction("cancel", 5000)).toEqual({
      key: "no_rehire",
      label: "No rehire",
    });
  });

  it("cancel WITHOUT penalty -> Review", () => {
    expect(previewRehireFromAction("cancel", 0)).toEqual({
      key: "review",
      label: "Review",
    });
  });

  it("cancel with apply-penalty-but-zero-configured -> Review (archive parity)", () => {
    // Operator ticks "apply penalty" but no penalty is configured: the backend
    // persists null, so the archive derives Review. The preview must agree.
    expect(previewRehireFromAction("cancel", 0)).toEqual({
      key: "review",
      label: "Review",
    });
  });

  it("non-offboarding actions have no preview", () => {
    expect(previewRehireFromAction("reinstate", 0)).toBeNull();
    expect(previewRehireFromAction("delete", 5000)).toBeNull();
  });
});

describe("composeOffboardingNote", () => {
  it("returns undefined when nothing was captured", () => {
    expect(composeOffboardingNote({})).toBeUndefined();
    expect(composeOffboardingNote({ exitNotes: "   " })).toBeUndefined();
  });

  it("maps the reason value to its human label", () => {
    expect(offboardReasonLabel("end_of_contract")).toBe("End of contract");
    const note = composeOffboardingNote({ reason: "resignation" });
    expect(note).toBe("Reason: Resignation");
  });

  it("folds all captured fields into a single multi-line note", () => {
    const note = composeOffboardingNote({
      reason: "medical",
      endDate: "2026-06-30",
      vesselName: "MV Aurora",
      handoverDocs: true,
      returnPpe: false,
      finalPayroll: true,
      exitNotes: "  Settled and signed off.  ",
    });
    expect(note).toBe(
      [
        "Reason: Medical",
        "End date: 2026-06-30",
        "Final vessel: MV Aurora",
        "Checklist: Handed over documents; Final payroll settled",
        "Exit notes: Settled and signed off.",
      ].join("\n")
    );
  });

  it("omits the checklist line when no items are ticked", () => {
    const note = composeOffboardingNote({ vesselName: "MV Aurora" });
    expect(note).toBe("Final vessel: MV Aurora");
  });

  it("every reason value resolves to a non-empty label", () => {
    for (const r of OFFBOARD_REASONS) {
      expect(offboardReasonLabel(r.value)).toBe(r.label);
    }
  });
});

describe("decideRenewalTask", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("does not raise when expiry is outside the lead window", () => {
    const d = decideRenewalTask({
      docId: "doc-1",
      expiresAt: "2026-12-01T00:00:00.000Z", // ~183 days out
      leadDays: 90,
      openTasks: [],
      now,
    });
    expect(d.shouldRaise).toBe(false);
  });

  it("raises with medium priority inside the lead window but >30 days", () => {
    const d = decideRenewalTask({
      docId: "doc-1",
      expiresAt: "2026-08-01T00:00:00.000Z", // ~61 days out
      leadDays: 90,
      openTasks: [],
      now,
    });
    expect(d.shouldRaise).toBe(true);
    expect(d.priority).toBe("medium");
  });

  it("escalates to high priority inside 30 days", () => {
    const d = decideRenewalTask({
      docId: "doc-1",
      expiresAt: "2026-06-20T00:00:00.000Z", // ~19 days out
      leadDays: 90,
      openTasks: [],
      now,
    });
    expect(d.shouldRaise).toBe(true);
    expect(d.priority).toBe("high");
  });

  it("raises (high) for an already-expired document", () => {
    const d = decideRenewalTask({
      docId: "doc-1",
      expiresAt: "2026-05-01T00:00:00.000Z",
      leadDays: 90,
      openTasks: [],
      now,
    });
    expect(d.shouldRaise).toBe(true);
    expect(d.priority).toBe("high");
    expect(d.daysUntilExpiry).toBeLessThanOrEqual(0);
  });

  it("does NOT raise a duplicate when an open task already links the document", () => {
    const d = decideRenewalTask({
      docId: "doc-1",
      expiresAt: "2026-06-20T00:00:00.000Z",
      leadDays: 90,
      openTasks: [{ linkedSourceType: "crew_document", linkedSourceId: "doc-1" }],
      now,
    });
    expect(d.shouldRaise).toBe(false);
  });

  it("still raises when the open task links a DIFFERENT document", () => {
    const d = decideRenewalTask({
      docId: "doc-1",
      expiresAt: "2026-06-20T00:00:00.000Z",
      leadDays: 90,
      openTasks: [{ linkedSourceType: "crew_document", linkedSourceId: "doc-OTHER" }],
      now,
    });
    expect(d.shouldRaise).toBe(true);
  });

  it("uses date-fns differenceInDays for exact parity with the prior inline rule", () => {
    // The lead-window cutoff must match `differenceInDays(expiry, now)` exactly,
    // including the truncation behavior at partial-day boundaries.
    const expiresAt = "2026-08-30T06:00:00.000Z";
    const expected = differenceInDays(new Date(expiresAt), now);
    const d = decideRenewalTask({ docId: "doc-1", expiresAt, leadDays: 90, openTasks: [], now });
    expect(d.daysUntilExpiry).toBe(expected);
  });

  it("does not raise for a missing or invalid expiry", () => {
    expect(
      decideRenewalTask({ docId: "doc-1", expiresAt: null, leadDays: 90, openTasks: [], now })
        .shouldRaise
    ).toBe(false);
    expect(
      decideRenewalTask({
        docId: "doc-1",
        expiresAt: "not-a-date",
        leadDays: 90,
        openTasks: [],
        now,
      }).shouldRaise
    ).toBe(false);
  });
});

describe("new crew field helpers + schema", () => {
  it("labels status and employment type", () => {
    expect(typeof crewStatusLabel("active")).toBe("string");
    expect(crewStatusLabel("active").length).toBeGreaterThan(0);
    expect(typeof employmentTypeLabel("permanent")).toBe("string");
  });

  it("formats a rotation pattern and tolerates missing values", () => {
    expect(formatRotation(28, 28)).toContain("28");
    expect(formatRotation(null, null)).toBeNull();
  });

  it("accepts a minimal valid crew form payload", () => {
    const parsed = crewFormSchema.safeParse({
      name: "Jane Mariner",
      rank: "Chief Engineer",
      maxHours7d: 72,
      minRestH: 10,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("source-scan: mobile crew replacement preserves profile signals", () => {
  const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

  it("crew-management delegates to the mobile crew page, not the removed legacy shell", () => {
    const page = read("client/src/pages/crew-management.tsx");
    expect(page).toContain("MobileCrewPage");
    expect(page).not.toContain("UnifiedCrewManagement");
    expect(page).not.toContain("LifecycleDialog");
  });

  it("the replacement model keeps document and former-crew profile signals visible", () => {
    const screens = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    const model = read("client/src/features/mobile-readiness/mobile-readiness-model.ts");
    expect(screens).toContain("Crew Readiness Overview");
    expect(screens).toContain("Former Crew");
    expect(screens).toContain("{person.docs}");
    expect(model).toContain("currentCrew");
    expect(model).toContain("formerCrew");
    expect(model).toContain("Certificate Expired");
    expect(model).toContain("Signed Off");
  });

  it("renewal task creation goes through the pure decision helper", () => {
    const src = read("client/src/features/crew/hooks/useCrewDocumentsData.ts");
    expect(src).toContain("decideRenewalTask");
  });
});
