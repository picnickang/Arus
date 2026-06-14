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
 *  - Source-scan: the active crew-management route now points at the mobile
 *    readiness replacement, and that replacement keeps explicit status,
 *    document, blocker, current-crew, and former-crew surfaces.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { crewStatusLabel, CREW_STATUSES } from "@/features/crew/lib/crewManagementUtils";

const read = (rel: string): string => {
  // The aggregate `MobileReadinessScreens.tsx` / `mobile-readiness-model.ts`
  // paths are now thin barrels; the screens/model were split into per-area
  // files. For those, concatenate the whole feature dir so this source-scan
  // survives intra-feature file moves.
  if (
    rel.endsWith("mobile-readiness/MobileReadinessScreens.tsx") ||
    rel.endsWith("mobile-readiness/mobile-readiness-model.ts")
  ) {
    const dir = resolve(process.cwd(), "client/src/features/mobile-readiness");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => readFileSync(resolve(dir, f), "utf8"))
      .join("\n");
  }
  return readFileSync(resolve(process.cwd(), rel), "utf8");
};

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

describe("source-scan: crew-management mobile replacement", () => {
  const page = read("client/src/pages/crew-management.tsx");
  const screens = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
  const model = read("client/src/features/mobile-readiness/mobile-readiness-model.ts");

  it("routes crew-management through the mobile crew page", () => {
    expect(page).toContain("MobileCrewPage");
    expect(page).not.toContain("UnifiedCrewManagement");
    expect(page).not.toContain("CrewFormDialog");
  });

  it("renders explicit status and document signals from the replacement model", () => {
    expect(screens).toContain("StatusPill");
    expect(screens).toContain("{person.status}");
    expect(screens).toContain("{person.docs}");
    expect(model).toContain('status: "Onboard"');
    expect(model).toContain('docs: "10/10"');
  });

  it("keeps blocker, current crew, and former crew sections wired", () => {
    expect(screens).toContain("crew.blockers.map");
    expect(screens).toContain("crew.currentCrew.map");
    expect(screens).toContain("crew.formerCrew.map");
    expect(screens).toContain("Crew Readiness Overview");
    expect(model).toContain("currentCrew");
    expect(model).toContain("formerCrew");
    expect(model).toContain("Certificate Expired");
  });
});
