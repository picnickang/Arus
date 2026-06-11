import type { CrewListItem } from "@/features/crew";

/**
 * Builds the reporting tree from the flat crew list using `reportsToId`.
 *
 * - A member's parent is its `reportsToId` only when that id points to another
 *   member in the same set and is not the member itself; otherwise the member is
 *   a top-level root (covers null links and links to crew outside this set, e.g.
 *   a former/inactive supervisor).
 * - Circular links are broken defensively: walking up the chain from each member,
 *   the first node that repeats has its parent edge dropped so it becomes a root.
 *   This guarantees a finite tree no matter how the data is shaped.
 */
export function buildReportingTree(members: CrewListItem[]) {
  const byId = new Map(members.map((m) => [m.id, m]));

  const parentOf = new Map<string, string | null>();
  for (const m of members) {
    const supervisorId = m.reportsToId ?? null;
    const valid = supervisorId != null && supervisorId !== m.id && byId.has(supervisorId);
    parentOf.set(m.id, valid ? supervisorId : null);
  }

  // Break any cycles by promoting the repeated node to a root.
  for (const m of members) {
    const seen = new Set<string>();
    let cur: string | null = m.id;
    while (cur != null) {
      if (seen.has(cur)) {
        parentOf.set(cur, null);
        break;
      }
      seen.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }

  const childrenByParent = new Map<string, CrewListItem[]>();
  const roots: CrewListItem[] = [];
  for (const m of members) {
    const parentId = parentOf.get(m.id) ?? null;
    if (parentId == null) {
      roots.push(m);
    } else {
      const list = childrenByParent.get(parentId);
      if (list) {
        list.push(m);
      } else {
        childrenByParent.set(parentId, [m]);
      }
    }
  }

  return { roots, childrenByParent };
}

/**
 * Orders a set of crew members for display: primarily by role rank
 * (`sortIndex`, lower = higher in the roster), then alphabetically by name as a
 * stable tiebreaker. Returns a copy — the input array is never mutated.
 */
export function makeMemberComparator(sortIndex: (rank: string) => number) {
  return (members: CrewListItem[]) =>
    [...members].sort((a, b) => {
      const diff = sortIndex(a.rank) - sortIndex(b.rank);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    });
}
