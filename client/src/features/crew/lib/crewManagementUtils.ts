import { z } from "zod";
import type {
  CrewAccessReadiness,
  CrewAccessReadinessStatus,
  FormerCrewAccessRisk,
  FormerCrewAccessRiskFilter,
} from "@shared/crew-access-readiness";

export type {
  CrewAccessReadiness,
  CrewAccessReadinessStatus,
  FormerCrewAccessRisk,
  FormerCrewAccessRiskFilter,
};

export interface CrewListItem {
  id: string;
  name: string;
  rank: string;
  department?: string | null;
  watchKeeping?: string | null;
  roleId?: string | null;
  photoPath?: string | null;
  vesselId?: string | undefined;
  maxHours7d: number;
  minRestH: number;
  hourlyRate?: number;
  active: boolean;
  onDuty: boolean;
  skills: string[];
  userId?: string | null;
  email?: string | undefined;
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  crewCode?: string | null;
  status?: string | null;
  employmentType?: string | null;
  reportsToId?: string | null;
  rotationOnDays?: number | null;
  rotationOffDays?: number | null;
  startDate?: string;
  contractEndDate?: string;
  contractPenalty?: number;
  terminationType?: string;
  terminationDate?: string;
  terminationNotes?: string;
}

const EMPLOYMENT_TYPES = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "rotational", label: "Rotational" },
] as const;

export const CREW_STATUSES = [
  { value: "active", label: "Active" },
  { value: "onboard", label: "Onboard" },
  { value: "on_leave", label: "On leave" },
  { value: "standby", label: "Standby" },
] as const;

export function crewStatusLabel(status?: string | null): string {
  if (!status) {
    return "Active";
  }
  return CREW_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function employmentTypeLabel(type?: string | null): string {
  if (!type) {
    return "Not set";
  }
  return EMPLOYMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function formatRotation(onDays?: number | null, offDays?: number | null): string | null {
  if (onDays == null && offDays == null) {
    return null;
  }
  return `${onDays ?? 0} on / ${offDays ?? 0} off`;
}

export type CrewProfileTab =
  | "details"
  | "history"
  | "documents"
  | "notifications"
  | "access"
  | "tasks";

export const CREW_ACCESS_STATUS_LABELS: Record<CrewAccessReadinessStatus, string> = {
  ready: "Ready",
  no_login: "No login",
  login_disabled: "Login disabled",
  no_password_set: "No password set",
  temporary_password_issued: "Temporary password issued",
  password_change_required: "Password change required",
  password_required: "Password required",
  no_vessel_scope: "No vessel scope",
  no_dashboard: "No dashboard",
  fleet_scope_review: "Fleet access review",
};

export const FORMER_ACCESS_RISK_LABELS: Record<FormerCrewAccessRiskFilter, string> = {
  all: "All former crew",
  linked_login: "Former with linked login",
  login_enabled: "Former with login enabled",
  vessel_access: "Former with vessel access",
  hub_access: "Former with admin/hub access",
};

export interface VesselListItem {
  id: string;
  name: string;
  imo?: string;
  active: boolean;
}

export type SortField = "name" | "rank" | "vessel" | "status" | "duty";
export type SortDirection = "asc" | "desc";

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

function formatRank(rank: string): string {
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

export const COMMON_SKILLS = [
  "watchkeeping",
  "diesel_maintenance",
  "crane_operation",
  "welding",
  "electrical",
  "navigation",
  "safety_officer",
  "first_aid",
  "fire_fighting",
  "ecdis_operation",
  "radio_operation",
] as const;

export const crewFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  rank: z.string().min(1, "Rank is required"),
  department: z.string().optional(),
  watchKeeping: z.string().optional(),
  roleId: z.string().optional(),
  vesselId: z.string().optional(),
  crewCode: z.string().optional(),
  status: z.string().optional(),
  employmentType: z.string().optional(),
  reportsToId: z.string().optional(),
  rotationOnDays: z.coerce.number().int().min(0).max(365).optional(),
  rotationOffDays: z.coerce.number().int().min(0).max(365).optional(),
  maxHours7d: z.coerce.number().min(40).max(84),
  minRestH: z.coerce.number().min(6).max(12),
  hourlyRate: z.coerce.number().min(0).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  startDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  contractPenalty: z.coerce.number().min(0).optional(),
});

export type CrewFormData = z.infer<typeof crewFormSchema>;

export const skillFormSchema = z.object({
  crewId: z.string().min(1, "Crew member is required"),
  skill: z.string().min(1, "Skill is required"),
  level: z.coerce.number().min(1).max(5),
});

export type SkillFormData = z.infer<typeof skillFormSchema>;

export function createDefaultCrewFormValues(): CrewFormData {
  return {
    name: "",
    rank: "Able Seaman",
    department: "",
    watchKeeping: "",
    roleId: "",
    vesselId: "",
    crewCode: "",
    status: "active",
    employmentType: "",
    reportsToId: "",
    rotationOnDays: undefined,
    rotationOffDays: undefined,
    maxHours7d: 72,
    minRestH: 10,
    hourlyRate: undefined,
    email: "",
    phone: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    startDate: "",
    contractEndDate: "",
    contractPenalty: undefined,
  };
}

export function createDefaultSkillFormValues(): SkillFormData {
  return {
    crewId: "",
    skill: "",
    level: 1,
  };
}

export function capitalizeNames(name: string): string {
  return name
    .split(" ")
    .map((word) => {
      if (word.length === 0) {
        return "";
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export interface CrewStats {
  totalCrew: number;
  activeCrew: number;
  onDutyCrew: number;
  uniqueVessels: number;
  uniqueSkills: number;
}

export function calculateCrewStats(crew: CrewListItem[]): CrewStats {
  const totalCrew = crew.length;
  const activeCrew = crew.filter((c) => c.active).length;
  const onDutyCrew = crew.filter((c) => c.onDuty).length;
  const uniqueVessels = new Set(crew.map((c) => c.vesselId)).size;
  const uniqueSkills = new Set(crew.flatMap((c) => c.skills ?? [])).size;

  return {
    totalCrew,
    activeCrew,
    onDutyCrew,
    uniqueVessels,
    uniqueSkills,
  };
}

export interface CrewFilterOptions {
  searchTerm: string;
  selectedVessel: string;
  selectedRank: string;
  selectedStatus: string;
  selectedSkill: string;
  selectedAccessStatus?: string;
  // When provided, the free-text search also matches the resolved vessel name
  // (the roster lets users search "crew, role, vessel").
  getVesselName?: (vesselId: string) => string;
}

export function filterCrew(crew: CrewListItem[], filters: CrewFilterOptions): CrewListItem[] {
  let filtered = [...crew];

  if (filters.searchTerm) {
    const search = filters.searchTerm.toLowerCase();
    const resolveVessel = filters.getVesselName;
    filtered = filtered.filter(
      (c) =>
        c.name?.toLowerCase().includes(search) ||
        c.rank?.toLowerCase().includes(search) ||
        formatRank(c.rank).toLowerCase().includes(search) ||
        (c.skills ?? []).some((skill) => skill.toLowerCase().includes(search)) ||
        (!!resolveVessel &&
          !!c.vesselId &&
          resolveVessel(c.vesselId).toLowerCase().includes(search))
    );
  }

  if (filters.selectedVessel !== "all") {
    filtered = filtered.filter((c) => c.vesselId === filters.selectedVessel);
  }

  if (filters.selectedRank !== "all") {
    filtered = filtered.filter(
      (c) =>
        c.rank.toLowerCase() === filters.selectedRank.toLowerCase() ||
        formatRank(c.rank) === filters.selectedRank
    );
  }

  if (filters.selectedStatus !== "all") {
    if (filters.selectedStatus === "active") {
      filtered = filtered.filter((c) => c.active);
    } else if (filters.selectedStatus === "inactive") {
      filtered = filtered.filter((c) => !c.active);
    } else if (filters.selectedStatus === "on_duty") {
      filtered = filtered.filter((c) => c.onDuty);
    } else if (filters.selectedStatus === "off_duty") {
      filtered = filtered.filter((c) => !c.onDuty);
    }
  }

  if (filters.selectedSkill !== "all") {
    filtered = filtered.filter((c) => (c.skills ?? []).includes(filters.selectedSkill));
  }

  return filtered;
}

export function sortCrew(
  crew: CrewListItem[],
  sortField: SortField,
  sortDirection: SortDirection,
  getVesselName: (vesselId: string) => string,
  getRankIndex?: (rank: string) => number
): CrewListItem[] {
  const rankIndex =
    getRankIndex ?? ((rank: string) => (MARITIME_RANKS as readonly string[]).indexOf(rank));
  return [...crew].sort((a, b) => {
    let compareA: string | number;
    let compareB: string | number;

    switch (sortField) {
      case "name":
        compareA = a.name.toLowerCase();
        compareB = b.name.toLowerCase();
        break;
      case "rank":
        compareA = rankIndex(a.rank);
        compareB = rankIndex(b.rank);
        break;
      case "vessel":
        compareA = getVesselName(a.vesselId ?? "").toLowerCase();
        compareB = getVesselName(b.vesselId ?? "").toLowerCase();
        break;
      case "status":
        compareA = a.active ? 1 : 0;
        compareB = b.active ? 1 : 0;
        break;
      case "duty":
        compareA = a.onDuty ? 1 : 0;
        compareB = b.onDuty ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (compareA < compareB) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (compareA > compareB) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });
}

export function countActiveFilters(filters: CrewFilterOptions): number {
  let count = 0;
  if (filters.searchTerm) {
    count++;
  }
  if (filters.selectedVessel !== "all") {
    count++;
  }
  if (filters.selectedRank !== "all") {
    count++;
  }
  if (filters.selectedStatus !== "all") {
    count++;
  }
  if (filters.selectedSkill !== "all") {
    count++;
  }
  if (filters.selectedAccessStatus && filters.selectedAccessStatus !== "all") {
    count++;
  }
  return count;
}

export interface CrewExportRow {
  name: string;
  rank: string;
  vessel: string;
  status: string;
  dutyStatus: string;
  maxHoursWeek: number;
  minRestH: number;
  skills: string;
}

export function prepareCrewExportData(
  crew: CrewListItem[],
  getVesselName: (vesselId: string) => string
): CrewExportRow[] {
  return crew.map((c) => ({
    name: c.name,
    rank: c.rank,
    vessel: getVesselName(c.vesselId ?? ""),
    status: c.active ? "Active" : "Inactive",
    dutyStatus: c.onDuty ? "On Duty" : "Off Duty",
    maxHoursWeek: c.maxHours7d,
    minRestH: c.minRestH,
    skills: (c.skills ?? []).join("; "),
  }));
}

export function getVesselNameById(vessels: VesselListItem[], vesselId: string): string {
  const vessel = vessels.find((v) => v.id === vesselId);
  return vessel ? vessel.name : vesselId;
}

// --- Role-group bucketing (current roster "sort by role") ---------------------
// Maps an individual maritime rank into one of a small set of display groups so
// the roster can render collapsible role sections (Figma crew-management board).
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

function getRoleGroup(rank: string | null | undefined): RoleGroup {
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

// --- Data-driven role lookup (manageable crew roles) -------------------------
// `crew.rank` stores a role NAME (e.g. "Chief Engineer"). The org's manageable
// crew roles (from /api/crew-roles) supply the ordering (sortOrder) and the
// grouping category. `buildRoleLookup` turns that list into the small set of
// helpers the roster needs. When the list is empty (e.g. roles not loaded yet)
// it synthesizes the same behaviour from the legacy MARITIME_RANKS + getRoleGroup
// constants, so there is a single code path whether roles are loaded or not.

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
  /** Roles keyed by a normalized name (lowercase, spaces → underscore). */
  byKey: Map<string, CrewManagementRole>;
  /** Distinct categories in display order (by each category's min sortOrder). */
  orderedCategories: string[];
  /** Position index for a rank — lower = higher in the roster. */
  sortIndex: (rank: string) => number;
  /** Display category/group for a rank. */
  categoryOf: (rank: string) => string;
}

export function normRoleKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "_");
}

export function buildRoleLookup(roles: CrewManagementRole[]): RoleLookup {
  // Fall back to the legacy constants when no roles are provided so the roster
  // still groups/sorts identically before the API responds.
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

  // Order categories by the smallest sortOrder seen within each.
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

  const MAX = Number.MAX_SAFE_INTEGER;
  const sortIndex = (rank: string): number => {
    if (!rank) {
      return MAX;
    }
    return byKey.get(normRoleKey(rank))?.sortOrder ?? MAX;
  };
  const categoryOf = (rank: string): string => {
    if (!rank) {
      return "Other";
    }
    return byKey.get(normRoleKey(rank))?.category ?? getRoleGroup(rank);
  };

  return { byKey, orderedCategories, sortIndex, categoryOf };
}

export interface RoleCategoryBucket<T> {
  group: string;
  members: T[];
}

/**
 * Group crew into category buckets using a data-driven RoleLookup. Categories
 * appear in the lookup's order, with any uncategorized crew falling into
 * "Other" at the end.
 */
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

export const RELIEF_POOL_ID = "__relief_pool__";

export interface VesselGroupBucket<T> {
  vesselId: string;
  vesselName: string;
  isReliefPool: boolean;
  members: T[];
}

export function groupCrewByVessel<T extends { vesselId?: string | null | undefined }>(
  crew: T[],
  getVesselName: (vesselId: string) => string
): VesselGroupBucket<T>[] {
  const buckets = new Map<string, T[]>();
  for (const member of crew) {
    const vesselId = member.vesselId ?? RELIEF_POOL_ID;
    const key = vesselId === "" ? RELIEF_POOL_ID : vesselId;
    const list = buckets.get(key);
    if (list) {
      list.push(member);
    } else {
      buckets.set(key, [member]);
    }
  }
  const assigned: VesselGroupBucket<T>[] = [];
  let reliefPool: VesselGroupBucket<T> | null = null;
  for (const [vesselId, members] of buckets.entries()) {
    if (vesselId === RELIEF_POOL_ID) {
      reliefPool = {
        vesselId: RELIEF_POOL_ID,
        vesselName: "Unassigned / Relief Pool",
        isReliefPool: true,
        members,
      };
    } else {
      assigned.push({
        vesselId,
        vesselName: getVesselName(vesselId) || "Unknown vessel",
        isReliefPool: false,
        members,
      });
    }
  }
  assigned.sort((a, b) => a.vesselName.localeCompare(b.vesselName));
  return reliefPool ? [...assigned, reliefPool] : assigned;
}

// --- Former-crew rehire status -----------------------------------------------
// NOTE: there is no dedicated rehire-eligibility / do-not-rehire column on the
// crew or employment-history records. We derive a transparent status from the
// real fields we DO have (most-recent employment period's terminationType and
// contractPenalty) rather than fabricating a flag:
//   retired                          -> Rehire OK   (left on good terms)
//   cancelled WITH contract penalty  -> No rehire   (contract breached)
//   cancelled (no penalty) / unknown -> Review      (needs manual review)
export type RehireStatusKey = "rehire_ok" | "review" | "no_rehire";

export interface RehireStatus {
  key: RehireStatusKey;
  label: string;
}

export interface FormerEmploymentLike {
  terminationType: "retired" | "cancelled" | null;
  contractPenalty: number | null;
  endDate?: string | null;
  vesselId?: string | null;
  rank?: string | null;
}

export function deriveRehireStatus(latestPeriod: FormerEmploymentLike | undefined): RehireStatus {
  const terminationType = latestPeriod?.terminationType ?? null;
  const penalty = latestPeriod?.contractPenalty ?? 0;
  if (terminationType === "retired") {
    return { key: "rehire_ok", label: "Rehire OK" };
  }
  if (terminationType === "cancelled" && penalty > 0) {
    return { key: "no_rehire", label: "No rehire" };
  }
  return { key: "review", label: "Review" };
}

// Offboarding reasons — generic so the same list serves retire and cancel. The
// chosen reason is folded into the structured exit note saved on the lifecycle
// action (the backend already accepts a free-text note, so no new field).
export const OFFBOARD_REASONS = [
  { value: "end_of_contract", label: "End of contract" },
  { value: "resignation", label: "Resignation" },
  { value: "performance", label: "Performance" },
  { value: "medical", label: "Medical" },
  { value: "redundancy", label: "Redundancy" },
  { value: "contract_breach", label: "Contract breach" },
  { value: "other", label: "Other" },
] as const;

export function offboardReasonLabel(value?: string | null): string {
  if (!value) {
    return "";
  }
  return OFFBOARD_REASONS.find((r) => r.value === value)?.label ?? value;
}

/**
 * Preview the rehire signal an offboarding choice WILL produce, before it is
 * confirmed. Maps the operator's in-dialog action + the EFFECTIVE contract
 * penalty (the amount that will actually persist) onto the same
 * `deriveRehireStatus` rules the former-archive uses on stored records, so the
 * dialog and the archive can never disagree:
 *   retire                            -> Rehire OK
 *   cancel WITH a positive penalty    -> No rehire
 *   cancel (no/zero penalty)          -> Review
 * Non-offboarding actions (reinstate/delete) have no rehire preview.
 *
 * `effectivePenalty` must be the amount that will be saved: the backend persists
 * `applyPenalty ? crew.contractPenalty : null`, so the caller passes
 * `applyPenalty ? (crew.contractPenalty ?? 0) : 0`. Ticking "apply penalty" when
 * no penalty is configured still resolves to Review — matching the archive.
 */
export function previewRehireFromAction(
  action: string,
  effectivePenalty: number
): RehireStatus | null {
  if (action === "retire") {
    return deriveRehireStatus({ terminationType: "retired", contractPenalty: null });
  }
  if (action === "cancel") {
    return deriveRehireStatus({
      terminationType: "cancelled",
      contractPenalty: effectivePenalty,
    });
  }
  return null;
}

export interface OffboardingNoteInput {
  reason?: string | null;
  endDate?: string | null;
  vesselName?: string | null | undefined;
  handoverDocs?: boolean;
  returnPpe?: boolean;
  finalPayroll?: boolean;
  exitNotes?: string | null | undefined;
}

/**
 * Build the structured exit summary saved as the lifecycle note, so all the
 * offboarding context (reason, end date, final vessel, checklist, exit notes)
 * is preserved without a new backend field. Returns undefined when nothing was
 * captured so we don't send an empty note.
 */
export function composeOffboardingNote(input: OffboardingNoteInput): string | undefined {
  const lines: string[] = [];
  if (input.reason) {
    lines.push(`Reason: ${offboardReasonLabel(input.reason)}`);
  }
  if (input.endDate) {
    lines.push(`End date: ${input.endDate}`);
  }
  if (input.vesselName) {
    lines.push(`Final vessel: ${input.vesselName}`);
  }
  const checklist = [
    input.handoverDocs && "Handed over documents",
    input.returnPpe && "Returned PPE / access card",
    input.finalPayroll && "Final payroll settled",
  ].filter(Boolean) as string[];
  if (checklist.length > 0) {
    lines.push(`Checklist: ${checklist.join("; ")}`);
  }
  const trimmedExit = input.exitNotes?.trim();
  if (trimmedExit) {
    lines.push(`Exit notes: ${trimmedExit}`);
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}
