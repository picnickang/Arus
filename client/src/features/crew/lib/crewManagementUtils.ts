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
  vesselId?: string;
  maxHours7d: number;
  minRestH: number;
  hourlyRate?: number;
  active: boolean;
  onDuty: boolean;
  skills: string[];
  userId?: string | null;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  startDate?: string;
  contractEndDate?: string;
  contractPenalty?: number;
  terminationType?: string;
  terminationDate?: string;
  terminationNotes?: string;
}

export type CrewProfileTab = "details" | "history" | "documents" | "notifications" | "access";

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
  vesselId: z.string().optional(),
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
    vesselId: "",
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
}

export function filterCrew(crew: CrewListItem[], filters: CrewFilterOptions): CrewListItem[] {
  let filtered = [...crew];

  if (filters.searchTerm) {
    const search = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name?.toLowerCase().includes(search) ||
        c.rank?.toLowerCase().includes(search) ||
        (c.skills ?? []).some((skill) => skill.toLowerCase().includes(search))
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
  getVesselName: (vesselId: string) => string
): CrewListItem[] {
  return [...crew].sort((a, b) => {
    let compareA: string | number;
    let compareB: string | number;

    switch (sortField) {
      case "name":
        compareA = a.name.toLowerCase();
        compareB = b.name.toLowerCase();
        break;
      case "rank":
        compareA = (MARITIME_RANKS as readonly string[]).indexOf(a.rank);
        compareB = (MARITIME_RANKS as readonly string[]).indexOf(b.rank);
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
