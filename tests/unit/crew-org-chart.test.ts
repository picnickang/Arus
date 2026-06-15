/**
 * Crew org chart reporting-tree — pure-logic verification (Task #355).
 *
 * The org chart renders a reporting tree built from each crew member's
 * `reportsToId` supervisor link. Root detection and cycle breaking are the only
 * place a bad data shape (self-link, dangling supervisor, circular chain) could
 * cause a broken or infinite render, so the tree builder and the child-ordering
 * comparator are extracted into a pure module (`reportingTree.ts`) and exercised
 * here directly — deterministic, no browser, no React.
 *
 * What this DOES verify (automated):
 *  - `buildReportingTree`: no supervisor → root, supervisor outside the active
 *    set → root, self-reference → root, and 2-/3-node cycles resolve to a finite
 *    tree (no infinite recursion).
 *  - `makeMemberComparator` (the exact comparator the chart applies to a
 *    manager's children) orders reports by role rank then name.
 *  - Source-scan: the route now delegates to the mobile crew replacement while
 *    the extracted reporting-tree helpers remain covered by the pure tests.
 *
 * What this does NOT verify (covered by the CI Playwright crew specs): live DOM
 * rendering, real hook/API wiring, permissions. The unit suite runs in a Node
 * environment with no jsdom/RTL, matching the existing crew unit tests.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildReportingTree,
  makeMemberComparator,
} from "@/components/UnifiedCrewManagement/reportingTree";
import {
  buildRoleLookup,
  type CrewListItem,
  type CrewManagementRole,
} from "@/features/crew/lib/crewManagementUtils";

function member(partial: Partial<CrewListItem> & { id: string }): CrewListItem {
  return {
    name: partial.id,
    rank: "",
    maxHours7d: 0,
    minRestH: 0,
    active: true,
    onDuty: false,
    skills: [],
    ...partial,
  };
}

describe("buildReportingTree — root detection", () => {
  it("treats a member with no supervisor as a root", () => {
    const { roots, childrenByParent } = buildReportingTree([
      member({ id: "captain", reportsToId: null }),
    ]);
    expect(roots.map((m) => m.id)).toEqual(["captain"]);
    expect(childrenByParent.size).toBe(0);
  });

  it("treats a supervisor pointing outside the active set as a root", () => {
    // "mate" reports to "former-captain", who is not in this set (e.g. an
    // inactive/former supervisor filtered out of the active roster).
    const { roots, childrenByParent } = buildReportingTree([
      member({ id: "mate", reportsToId: "former-captain" }),
    ]);
    expect(roots.map((m) => m.id)).toEqual(["mate"]);
    expect(childrenByParent.has("former-captain")).toBe(false);
  });

  it("treats a member pointing at themselves as a root", () => {
    const { roots, childrenByParent } = buildReportingTree([
      member({ id: "loner", reportsToId: "loner" }),
    ]);
    expect(roots.map((m) => m.id)).toEqual(["loner"]);
    expect(childrenByParent.has("loner")).toBe(false);
  });

  it("nests a valid report under its in-set supervisor", () => {
    const { roots, childrenByParent } = buildReportingTree([
      member({ id: "captain" }),
      member({ id: "mate", reportsToId: "captain" }),
    ]);
    expect(roots.map((m) => m.id)).toEqual(["captain"]);
    expect(childrenByParent.get("captain")?.map((m) => m.id)).toEqual(["mate"]);
  });
});

describe("buildReportingTree — cycle breaking (finite tree)", () => {
  it("breaks a 2-node circular link into a finite tree", () => {
    const members = [member({ id: "a", reportsToId: "b" }), member({ id: "b", reportsToId: "a" })];
    const { roots, childrenByParent } = buildReportingTree(members);
    // Exactly one of the two is promoted to a root; the other nests under it.
    expect(roots).toHaveLength(1);
    const totalChildren = Array.from(childrenByParent.values()).reduce(
      (n, list) => n + list.length,
      0
    );
    expect(totalChildren).toBe(1);
    // No node is ever its own child.
    for (const [parent, kids] of childrenByParent) {
      expect(kids.map((k) => k.id)).not.toContain(parent);
    }
  });

  it("breaks a 3-node circular link into a finite tree", () => {
    const members = [
      member({ id: "a", reportsToId: "b" }),
      member({ id: "b", reportsToId: "c" }),
      member({ id: "c", reportsToId: "a" }),
    ];
    const { roots, childrenByParent } = buildReportingTree(members);
    expect(roots.length).toBeGreaterThanOrEqual(1);
    // Every member appears exactly once across roots + children (finite, no loss).
    const placed = new Set(roots.map((m) => m.id));
    let childCount = 0;
    for (const kids of childrenByParent.values()) {
      for (const k of kids) {
        placed.add(k.id);
        childCount += 1;
      }
    }
    expect(placed).toEqual(new Set(["a", "b", "c"]));
    expect(roots.length + childCount).toBe(3);
  });

  it("does not recurse infinitely when walking a fully cyclic set", () => {
    // A deliberately nasty shape: a long cycle. The builder must return.
    const members = Array.from({ length: 50 }, (_, i) =>
      member({ id: `n${i}`, reportsToId: `n${(i + 1) % 50}` })
    );
    // If cycle breaking failed this would hang; the test timeout would catch it.
    const { roots, childrenByParent } = buildReportingTree(members);
    const childCount = Array.from(childrenByParent.values()).reduce(
      (n, list) => n + list.length,
      0
    );
    expect(roots.length + childCount).toBe(50);
  });
});

describe("makeMemberComparator — children render in role order", () => {
  const roles: CrewManagementRole[] = [
    { id: "r1", orgId: "o", name: "Captain", category: "Captains", sortOrder: 10, active: true },
    {
      id: "r2",
      orgId: "o",
      name: "Chief Officer",
      category: "Officers",
      sortOrder: 20,
      active: true,
    },
    {
      id: "r3",
      orgId: "o",
      name: "Able Seaman",
      category: "Deck Crew",
      sortOrder: 30,
      active: true,
    },
  ];
  const sortMembers = makeMemberComparator(buildRoleLookup(roles).sortIndex);

  it("orders a manager's reports by role rank, lowest sortOrder first", () => {
    const reports = [
      member({ id: "3", rank: "able_seaman" }),
      member({ id: "1", rank: "captain" }),
      member({ id: "2", rank: "chief_officer" }),
    ];
    expect(sortMembers(reports).map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("falls back to name order for reports sharing a rank", () => {
    const reports = [
      member({ id: "z", name: "Zane", rank: "able_seaman" }),
      member({ id: "a", name: "Aaron", rank: "able_seaman" }),
      member({ id: "m", name: "Mary", rank: "able_seaman" }),
    ];
    expect(sortMembers(reports).map((m) => m.name)).toEqual(["Aaron", "Mary", "Zane"]);
  });

  it("does not mutate the input array", () => {
    const reports = [
      member({ id: "2", rank: "chief_officer" }),
      member({ id: "1", rank: "captain" }),
    ];
    const original = reports.map((m) => m.id);
    sortMembers(reports);
    expect(reports.map((m) => m.id)).toEqual(original);
  });
});

describe("mobile crew route source-scan", () => {
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

  it("routes crew-management to the mobile crew replacement", () => {
    const page = read("client/src/pages/crew-management.tsx");
    expect(page).toContain("MobileCrewPage");
    expect(page).not.toContain("CrewOrgChart");
    expect(page).not.toContain("UnifiedCrewManagement");
  });

  it("the replacement screen keeps current crew rows as the active reporting surface", () => {
    const screens = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    const model = read("client/src/features/mobile-readiness/mobile-readiness-model.ts");
    expect(screens).toContain("crew.currentCrew.map");
    expect(screens).toContain("Current Crew (18)");
    expect(model).toContain("currentCrew");
    expect(model).toContain("Chief Officer");
    expect(model).toContain("Chief Engineer");
  });
});
