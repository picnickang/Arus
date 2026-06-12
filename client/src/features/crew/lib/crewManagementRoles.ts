const RANK_DISPLAY_MAP: Record<string, string> = {
  captain: "Captain",
  chief_officer: "Chief Officer",
  first_officer: "First Officer",
  second_officer: "Second Officer",
  third_officer: "Third Officer",
  chief_engineer: "Chief Engineer",
  senior_engineer: "Senior Engineer",
  second_engineer: "Second Engineer",
  third_engineer: "Third Engineer",
  fourth_engineer: "Fourth Engineer",
  bosun: "Bosun",
  able_seaman: "Able Seaman",
  ordinary_seaman: "Ordinary Seaman",
  chief_cook: "Chief Cook",
  engine_fitter: "Engine Fitter",
  oiler: "Oiler",
  wiper: "Wiper",
  navigator: "Navigator",
  engineer: "Engineer",
};

export const MARITIME_RANKS = [
  "Captain",
  "Chief Officer",
  "Second Officer",
  "Third Officer",
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Bosun",
  "Able Seaman",
  "Ordinary Seaman",
  "Chief Cook",
  "Engine Fitter",
  "Oiler",
  "Wiper",
] as const;

export function formatRank(rank: string): string {
  if (!rank) {
    return "Unassigned";
  }
  const mapped = RANK_DISPLAY_MAP[rank.toLowerCase()];
  if (mapped) {
    return mapped;
  }
  if ((MARITIME_RANKS as readonly string[]).includes(rank)) {
    return rank;
  }
  return rank.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ROLE_GROUP_ORDER = [
  "Captains",
  "Officers",
  "Engineering",
  "Deck Crew",
  "Catering",
  "Other",
] as const;

export type RoleGroup = (typeof ROLE_GROUP_ORDER)[number];

const RANK_TO_ROLE_GROUP: Record<string, RoleGroup> = {
  captain: "Captains",
  master: "Captains",
  chief_officer: "Officers",
  first_officer: "Officers",
  second_officer: "Officers",
  third_officer: "Officers",
  navigator: "Officers",
  chief_engineer: "Engineering",
  senior_engineer: "Engineering",
  second_engineer: "Engineering",
  third_engineer: "Engineering",
  fourth_engineer: "Engineering",
  engineer: "Engineering",
  engine_fitter: "Engineering",
  oiler: "Engineering",
  wiper: "Engineering",
  bosun: "Deck Crew",
  able_seaman: "Deck Crew",
  ordinary_seaman: "Deck Crew",
  chief_cook: "Catering",
};

export function getRoleGroup(rank: string | null | undefined): RoleGroup {
  if (!rank) {
    return "Other";
  }
  const key = rank.toLowerCase().replace(/\s+/g, "_");
  return RANK_TO_ROLE_GROUP[key] ?? "Other";
}

export interface RoleGroupBucket<T> {
  group: RoleGroup;
  members: T[];
}

export function groupCrewByRole<T extends { rank: string }>(crew: T[]): RoleGroupBucket<T>[] {
  const buckets = new Map<RoleGroup, T[]>();
  for (const member of crew) {
    const group = getRoleGroup(member.rank);
    const list = buckets.get(group);
    if (list) {
      list.push(member);
    } else {
      buckets.set(group, [member]);
    }
  }
  return ROLE_GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
    group,
    members: buckets.get(group) ?? [],
  }));
}

export interface CrewManagementRole {
  id: string;
  orgId: string;
  name: string;
  category: string;
  sortOrder: number;
  active: boolean;
  defaultDepartment?: string | null;
  defaultMinRestHours?: number | null;
  defaultMaxHours?: number | null;
  defaultWatchKeeping?: string | null;
  defaultRoleId?: string | null;
  requiredDocuments?: string[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RoleLookup {
  /** Roles keyed by a normalized name (lowercase, spaces -> underscore). */
  byKey: Map<string, CrewManagementRole>;
  /** Distinct categories in display order (by each category's min sortOrder). */
  orderedCategories: string[];
  /** Position index for a rank - lower = higher in the roster. */
  sortIndex: (rank: string) => number;
  /** Display category/group for a rank. */
  categoryOf: (rank: string) => string;
}

export function normRoleKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "_");
}

export function buildRoleLookup(roles: CrewManagementRole[]): RoleLookup {
  const effective: CrewManagementRole[] =
    roles.length > 0
      ? roles
      : MARITIME_RANKS.map((name, i) => ({
          id: `legacy-${i}`,
          orgId: "",
          name,
          category: getRoleGroup(name),
          sortOrder: (i + 1) * 10,
          active: true,
        }));

  const byKey = new Map<string, CrewManagementRole>();
  for (const role of effective) {
    byKey.set(normRoleKey(role.name), role);
  }

  const categoryMinOrder = new Map<string, number>();
  for (const role of effective) {
    const current = categoryMinOrder.get(role.category);
    if (current === undefined || role.sortOrder < current) {
      categoryMinOrder.set(role.category, role.sortOrder);
    }
  }
  const orderedCategories = Array.from(categoryMinOrder.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([category]) => category);

  const maxIndex = Number.MAX_SAFE_INTEGER;
  const sortIndex = (rank: string): number => {
    if (!rank) {
      return maxIndex;
    }
    return byKey.get(normRoleKey(rank))?.sortOrder ?? maxIndex;
  };
  const categoryOf = (rank: string): string => {
    if (!rank) {
      return "Other";
    }
    return byKey.get(normRoleKey(rank))?.category ?? getRoleGroup(rank);
  };

  return { byKey, orderedCategories, sortIndex, categoryOf };
}

interface RoleCategoryBucket<T> {
  group: string;
  members: T[];
}

export function groupCrewByRoleWith<T extends { rank: string }>(
  crew: T[],
  lookup: RoleLookup
): RoleCategoryBucket<T>[] {
  const buckets = new Map<string, T[]>();
  for (const member of crew) {
    const group = lookup.categoryOf(member.rank);
    const list = buckets.get(group);
    if (list) {
      list.push(member);
    } else {
      buckets.set(group, [member]);
    }
  }
  const order = [...lookup.orderedCategories];
  if (!order.includes("Other")) {
    order.push("Other");
  }
  return order
    .filter((group) => buckets.has(group))
    .map((group) => ({
      group,
      members: buckets.get(group) ?? [],
    }));
}
