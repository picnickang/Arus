import type {
  CrewMember,
  InsertCrew,
  CrewCertification,
  InsertCrewCertification,
  CrewLeave,
  InsertCrewLeave,
  CrewAssignment,
  InsertCrewAssignment,
  CrewRestSheet,
  InsertCrewRestSheet,
  CrewRestDay,
  InsertCrewRestDay,
  ShiftTemplate,
  InsertShiftTemplate,
  Skill,
  InsertSkill,
} from "@shared/schema-runtime";

export interface CrewFilters {
  vesselId?: string;
  role?: string;
  status?: "active" | "inactive" | "on_leave";
  orgId?: string;
  limit?: number;
  offset?: number;
}

export interface STCWComplianceResult {
  crewId: string;
  crewName: string;
  compliant: boolean;
  violations: STCWViolation[];
  warnings: STCWWarning[];
  restHoursPer24h: number;
  restHoursPer7d: number;
}

export interface STCWViolation {
  type: string;
  date: Date;
  description: string;
  severity: "critical" | "major" | "minor";
}

export interface STCWWarning {
  type: string;
  date: Date;
  description: string;
}

export interface ICrewMemberStorage {
  getCrew(orgId?: string): Promise<CrewMember[]>;
  getCrewMember(id: string, orgId?: string): Promise<CrewMember | undefined>;
  getCrewByVessel(vesselId: string, orgId?: string): Promise<CrewMember[]>;
  createCrewMember(crew: InsertCrew): Promise<CrewMember>;
  updateCrew(id: string, crew: Partial<InsertCrew>, orgId?: string): Promise<CrewMember>;
  deleteCrew(id: string, orgId: string): Promise<void>;
  toggleDutyStatus(id: string, onDuty: boolean, orgId?: string): Promise<CrewMember>;
}

export interface ICrewCertificationStorage {
  getCrewCertifications(crewId?: string, orgId?: string): Promise<CrewCertification[]>;
  getCrewCertification(id: string, orgId?: string): Promise<CrewCertification | undefined>;
  createCrewCertification(cert: InsertCrewCertification): Promise<CrewCertification>;
  updateCrewCertification(
    id: string,
    cert: Partial<InsertCrewCertification>,
    orgId?: string
  ): Promise<CrewCertification>;
  deleteCrewCertification(id: string, orgId?: string): Promise<void>;
  getExpiringCertifications(daysAhead?: number, orgId?: string): Promise<CrewCertification[]>;
}

export interface ICrewLeaveStorage {
  getCrewLeave(crewId?: string, orgId?: string): Promise<CrewLeave[]>;
  getCrewLeaveById(id: string, orgId?: string): Promise<CrewLeave | undefined>;
  createCrewLeave(leave: InsertCrewLeave): Promise<CrewLeave>;
  updateCrewLeave(id: string, leave: Partial<InsertCrewLeave>, orgId?: string): Promise<CrewLeave>;
  deleteCrewLeave(id: string, orgId?: string): Promise<void>;
  getActiveLeave(crewId: string, date?: Date, orgId?: string): Promise<CrewLeave | undefined>;
}

export interface ICrewAssignmentStorage {
  getCrewAssignments(filters?: CrewFilters): Promise<CrewAssignment[]>;
  getCrewAssignment(id: string, orgId?: string): Promise<CrewAssignment | undefined>;
  createCrewAssignment(assignment: InsertCrewAssignment): Promise<CrewAssignment>;
  updateCrewAssignment(
    id: string,
    assignment: Partial<InsertCrewAssignment>,
    orgId?: string
  ): Promise<CrewAssignment>;
  deleteCrewAssignment(id: string, orgId?: string): Promise<void>;
  getAssignmentsByDate(date: Date, vesselId?: string, orgId?: string): Promise<CrewAssignment[]>;
  getCrewAssignmentsByDateRange(from: Date, to: Date, orgId?: string): Promise<CrewAssignment[]>;
  deleteCrewAssignmentsByRunId(orgId: string, runId: string): Promise<number>;
}

export interface ICrewRestStorage {
  getCrewRestSheet(crewId: string, month: string, orgId?: string): Promise<CrewRestSheet | undefined>;
  createCrewRestSheet(sheet: InsertCrewRestSheet): Promise<CrewRestSheet>;
  getCrewRestMonth(crewId: string, month: string, orgId?: string): Promise<CrewRestDay[]>;
  getCrewRestRange(
    crewId: string,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<CrewRestDay[]>;
  upsertCrewRestDay(restDay: InsertCrewRestDay): Promise<CrewRestDay>;
  checkMonthCompliance(crewId: string, month: string, orgId?: string): Promise<STCWComplianceResult>;
}

export interface IShiftTemplateStorage {
  getShiftTemplates(orgId?: string): Promise<ShiftTemplate[]>;
  getShiftTemplate(id: string, orgId?: string): Promise<ShiftTemplate | undefined>;
  createShiftTemplate(template: InsertShiftTemplate): Promise<ShiftTemplate>;
  updateShiftTemplate(
    id: string,
    template: Partial<InsertShiftTemplate>,
    orgId?: string
  ): Promise<ShiftTemplate>;
  deleteShiftTemplate(id: string, orgId?: string): Promise<void>;
}

export interface ISkillStorage {
  getSkills(orgId?: string): Promise<Skill[]>;
  getSkill(id: string, orgId?: string): Promise<Skill | undefined>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: string, skill: Partial<InsertSkill>, orgId?: string): Promise<Skill>;
  deleteSkill(id: string, orgId?: string): Promise<void>;
  getCrewSkills(crewId: string, orgId?: string): Promise<Skill[]>;
  setCrewSkill(crewId: string, skillId: string, orgId?: string): Promise<void>;
  removeCrewSkill(crewId: string, skillId: string, orgId?: string): Promise<void>;
}
