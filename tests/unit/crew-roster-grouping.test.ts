/**
 * Crew roster grouping + rehire-derivation — pure-logic verification.
 *
 * The mobile Crew Management redesign (Figma 47:1391) splits crew into a
 * Current roster (grouped/collapsible by role or vessel) and a Former archive
 * (rehire-aware). The grouping and the rehire status are pure functions in
 * `crewManagementUtils.ts` — there is NO stored rehire-eligibility column, so
 * the status is DERIVED only from each former record's real offboarding fields
 * (terminationType + contractPenalty). Testing these directly is deterministic
 * and runs in the sandbox (no browser, no React).
 *
 * What this DOES verify (automated):
 *  - `deriveRehireStatus` maps real offboarding data → rehire_ok / review / no_rehire.
 *  - `groupCrewByRole` buckets ranks into the fixed display groups, in order.
 *  - `groupCrewByVessel` groups by vessel and always sinks the relief/unassigned
 *    pool to the end.
 *  - Source-scan: the live mobile crew replacement still renders current and
 *    former crew collections, document completion, blockers, and route
 *    consolidation.
 *
 * What this does NOT verify (covered by the CI Playwright mobile spec and by
 * the backend crew API tests): live rendering, real API wiring, permissions.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveRehireStatus,
  groupCrewByRole,
  groupCrewByVessel,
  RELIEF_POOL_ID,
  ROLE_GROUP_ORDER,
  type FormerEmploymentLike,
} from "@/features/crew/lib/crewManagementUtils";

describe("deriveRehireStatus", () => {
  it("treats a retired record as Rehire OK", () => {
    const period: FormerEmploymentLike = { terminationType: "retired", contractPenalty: null };
    expect(deriveRehireStatus(period)).toEqual({ key: "rehire_ok", label: "Rehire OK" });
  });

  it("treats a retired record as Rehire OK even if a penalty value lingers", () => {
    const period: FormerEmploymentLike = { terminationType: "retired", contractPenalty: 500 };
    expect(deriveRehireStatus(period).key).toBe("rehire_ok");
  });

  it("treats a cancelled contract WITH a penalty as No rehire", () => {
    const period: FormerEmploymentLike = { terminationType: "cancelled", contractPenalty: 1200 };
    expect(deriveRehireStatus(period)).toEqual({ key: "no_rehire", label: "No rehire" });
  });

  it("treats a cancelled contract with NO penalty as Review", () => {
    const period: FormerEmploymentLike = { terminationType: "cancelled", contractPenalty: 0 };
    expect(deriveRehireStatus(period)).toEqual({ key: "review", label: "Review" });
  });

  it("treats a cancelled contract with null penalty as Review", () => {
    const period: FormerEmploymentLike = { terminationType: "cancelled", contractPenalty: null };
    expect(deriveRehireStatus(period).key).toBe("review");
  });

  it("falls back to Review when there is no employment period at all", () => {
    expect(deriveRehireStatus(undefined).key).toBe("review");
  });

  it("falls back to Review for a null termination type", () => {
    const period: FormerEmploymentLike = { terminationType: null, contractPenalty: null };
    expect(deriveRehireStatus(period).key).toBe("review");
  });
});

describe("groupCrewByRole", () => {
  it("buckets ranks into the fixed display groups", () => {
    const crew = [
      { id: "1", rank: "captain" },
      { id: "2", rank: "chief_engineer" },
      { id: "3", rank: "able_seaman" },
      { id: "4", rank: "chief_officer" },
      { id: "5", rank: "chief_cook" },
    ];
    const groups = groupCrewByRole(crew);
    const byGroup = Object.fromEntries(groups.map((g) => [g.group, g.members.map((m) => m.id)]));
    expect(byGroup["Captains"]).toEqual(["1"]);
    expect(byGroup["Officers"]).toEqual(["4"]);
    expect(byGroup["Engineering"]).toEqual(["2"]);
    expect(byGroup["Deck Crew"]).toEqual(["3"]);
    expect(byGroup["Catering"]).toEqual(["5"]);
  });

  it("emits groups in the canonical ROLE_GROUP_ORDER, skipping empty ones", () => {
    const crew = [
      { id: "a", rank: "able_seaman" }, // Deck Crew
      { id: "b", rank: "captain" }, // Captains
    ];
    const order = groupCrewByRole(crew).map((g) => g.group);
    // Captains comes before Deck Crew in the canonical order.
    expect(order).toEqual(["Captains", "Deck Crew"]);
    // Only present groups are emitted (no empty Officers/Engineering/etc.).
    expect(order.length).toBe(2);
    expect(order.every((g) => (ROLE_GROUP_ORDER as readonly string[]).includes(g))).toBe(true);
  });

  it("routes unknown ranks to the Other group", () => {
    const groups = groupCrewByRole([{ id: "x", rank: "supercargo" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe("Other");
  });

  it("normalizes spaced/cased ranks before bucketing", () => {
    // "Chief Officer" must resolve to the same Officers group as "chief_officer".
    const groups = groupCrewByRole([{ id: "x", rank: "Chief Officer" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe("Officers");
  });
});

describe("groupCrewByVessel", () => {
  const getVesselName = (id: string) =>
    ({ v1: "MV Aurora", v2: "MV Borealis" })[id] ?? "Unknown vessel";

  it("groups assigned crew by vessel and resolves the vessel name", () => {
    const crew = [
      { id: "1", vesselId: "v1" },
      { id: "2", vesselId: "v2" },
      { id: "3", vesselId: "v1" },
    ];
    const groups = groupCrewByVessel(crew, getVesselName);
    const aurora = groups.find((g) => g.vesselId === "v1");
    expect(aurora?.vesselName).toBe("MV Aurora");
    expect(aurora?.members.map((m) => m.id).sort()).toEqual(["1", "3"]);
    expect(aurora?.isReliefPool).toBe(false);
  });

  it("sinks unassigned/relief crew into a relief pool at the end", () => {
    const crew = [
      { id: "1", vesselId: "v2" },
      { id: "2", vesselId: undefined },
      { id: "3", vesselId: "" },
    ];
    const groups = groupCrewByVessel(crew, getVesselName);
    const last = groups[groups.length - 1];
    expect(last.isReliefPool).toBe(true);
    expect(last.vesselId).toBe(RELIEF_POOL_ID);
    expect(last.members.map((m) => m.id).sort()).toEqual(["2", "3"]);
  });

  it("emits no relief pool when every member is assigned to a vessel", () => {
    const crew = [
      { id: "1", vesselId: "v1" },
      { id: "2", vesselId: "v2" },
    ];
    const groups = groupCrewByVessel(crew, getVesselName);
    expect(groups.some((g) => g.isReliefPool)).toBe(false);
    expect(groups.some((g) => g.vesselId === RELIEF_POOL_ID)).toBe(false);
  });

  it("sorts assigned vessels alphabetically by name", () => {
    const crew = [
      { id: "1", vesselId: "v2" }, // Borealis
      { id: "2", vesselId: "v1" }, // Aurora
    ];
    const names = groupCrewByVessel(crew, getVesselName)
      .filter((g) => !g.isReliefPool)
      .map((g) => g.vesselName);
    expect(names).toEqual(["MV Aurora", "MV Borealis"]);
  });
});

describe("mobile roster replacement source-scan", () => {
  const read = (rel: string) => {
    if (rel.includes("features/mobile-readiness/")) {
      const dir = resolve(process.cwd(), "client/src/features/mobile-readiness");
      return readdirSync(dir)
        .filter((f: string) => /\.(ts|tsx)$/.test(f))
        .map((f: string) => readFileSync(resolve(dir, f), "utf8"))
        .join("\n");
    }
    return readFileSync(resolve(process.cwd(), rel), "utf8");
  };

  it("renders current crew from the replacement model with status and document counts", () => {
    const src = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    expect(src).toContain("crew.currentCrew.map");
    expect(src).toContain("Current Crew (18)");
    expect(src).toContain("{person.status}");
    expect(src).toContain("{person.docs}");
  });

  it("renders former crew from the replacement model", () => {
    const src = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    const model = read("client/src/features/mobile-readiness/mobile-readiness-model.ts");
    expect(src).toContain("crew.formerCrew.map");
    expect(src).toContain("Former Crew");
    expect(model).toContain("formerCrew");
    expect(model).toContain("Signed Off");
  });
});

/**
 * Consolidated crew page source-scan.
 *
 * Crew Overview (/crew) and Crew Management (/crew-management) now land on the
 * mobile readiness replacement. These checks pin that the route consolidation
 * keeps the active crew, former crew, blockers, and document state visible.
 */
describe("consolidated mobile crew route source-scan", () => {
  const read = (rel: string) => {
    if (rel.includes("features/mobile-readiness/")) {
      const dir = resolve(process.cwd(), "client/src/features/mobile-readiness");
      return readdirSync(dir)
        .filter((f: string) => /\.(ts|tsx)$/.test(f))
        .map((f: string) => readFileSync(resolve(dir, f), "utf8"))
        .join("\n");
    }
    return readFileSync(resolve(process.cwd(), rel), "utf8");
  };

  it("page wrapper delegates to the mobile crew page and drops the old tab shell", () => {
    const src = read("client/src/pages/crew-management.tsx");
    expect(src).not.toContain("TabsTrigger");
    expect(src).not.toContain('data-testid="tab-crew-roster"');
    expect(src).not.toContain("UnifiedCrewManagement");
    expect(src).toContain("MobileCrewPage");
  });

  it("replacement screen renders readiness, blockers, current crew, and former crew", () => {
    const src = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    expect(src).toContain("Crew Readiness Overview");
    expect(src).toContain("crew.blockers.map");
    expect(src).toContain("crew.currentCrew.map");
    expect(src).toContain("crew.formerCrew.map");
    expect(src).toContain("Missing Required Roles");
  });

  it("replacement model keeps the consolidated crew summary data", () => {
    const src = read("client/src/features/mobile-readiness/mobile-readiness-model.ts");
    expect(src).toContain("function buildCrewScreen");
    expect(src).toContain("currentCrew");
    expect(src).toContain("formerCrew");
    expect(src).toContain("Certificate Expired");
    expect(src).toContain("Missing Roles");
    expect(src).toContain('href: "/crew-management"');
  });

  it("retired /crew route redirects to the consolidated page", () => {
    const nav = read("client/src/config/navigationConfig.ts");
    expect(nav).toContain('"/crew": "/crew-management"');
    const routes = read("client/src/routes/crew.ts");
    expect(routes).not.toContain("crew-hub");
  });
});

/**
 * Crew document destination source-scan.
 *
 * Crew documents are still stored per individual crew member
 * (`POST /api/crew/:id/documents`). The legacy upload shortcut was removed with
 * the dead component tree, so these checks pin the live document hook and the
 * mobile replacement's visible document status.
 */
describe("crew document destination source-scan", () => {
  const read = (rel: string) => {
    if (rel.includes("features/mobile-readiness/")) {
      const dir = resolve(process.cwd(), "client/src/features/mobile-readiness");
      return readdirSync(dir)
        .filter((f: string) => /\.(ts|tsx)$/.test(f))
        .map((f: string) => readFileSync(resolve(dir, f), "utf8"))
        .join("\n");
    }
    return readFileSync(resolve(process.cwd(), rel), "utf8");
  };

  it("the mobile crew page exposes document completion for each current crew member", () => {
    const src = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    expect(src).toContain("crew.currentCrew.map");
    expect(src).toContain("{person.docs}");
    expect(src).toContain("Current Crew (18)");
  });

  it("document upload and renewal stay scoped to the selected crew member", () => {
    const src = read("client/src/features/crew/hooks/useCrewDocumentsData.ts");
    expect(src).toContain("useCrewDocumentsData(crewId: string)");
    expect(src).toContain("`/api/crew/${crewId}/documents`");
    expect(src).toContain("`/api/crew/${crewId}/documents/${docId}/file`");
    expect(src).toContain("decideRenewalTask");
  });

  it("renewal tasks link back to the crew document source", () => {
    const src = read("client/src/features/crew/hooks/useCrewDocumentsData.ts");
    expect(src).toContain('linkedSourceType: "crew_document"');
    expect(src).toContain("linkedSourceId: doc.id");
    expect(src).toContain("linkedSourceLabel: label");
  });
});
