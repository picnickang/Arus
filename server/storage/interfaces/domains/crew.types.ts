/**
 * Crew Storage Interface - Crew Management, Skills, Certifications, Rest
 * Part of IStorage modularization for improved maintainability
 */

import type {
  SelectCrew,
  InsertCrew,
  SelectCrewSkill,
  SelectSkill,
  InsertSkill,
  SelectCrewLeave,
  InsertCrewLeave,
  SelectShiftTemplate,
  InsertShiftTemplate,
  SelectCrewAssignment,
  InsertCrewAssignment,
  Crew as CrewWithSkills,
  SelectCrewCertification,
  InsertCrewCertification,
  SelectCrewDocument,
  InsertCrewDocument,
  CrewNotificationSettings,
  SelectCrewRestSheet,
  InsertCrewRestSheet,
  SelectCrewRestDay,
} from "@shared/schema";

/**
 * Crew storage operations for crew management, skills, certifications, and scheduling
 */
export interface ICrewStorage {
  // Crew Members
  getCrew(orgId?: string, vesselId?: string): Promise<CrewWithSkills[]>;
  getCrewMember(id: string, orgId?: string): Promise<SelectCrew | undefined>;
  createCrew(crew: InsertCrew): Promise<SelectCrew>;
  updateCrew(id: string, crew: Partial<InsertCrew>): Promise<SelectCrew>;
  deleteCrew(id: string): Promise<void>;

  // Crew Skills
  setCrewSkill(crewId: string, skill: string, level: number): Promise<SelectCrewSkill>;
  getCrewSkills(crewId: string): Promise<SelectCrewSkill[]>;
  deleteCrewSkill(crewId: string, skill: string): Promise<void>;
  validateCrewSkills(
    crewId: string,
    requiredSkills: string[],
    orgId?: string
  ): Promise<{ hasAllSkills: boolean; missingSkills: string[]; matchingSkills: string[] }>;
  findQualifiedCrew(
    requiredSkills: string[],
    vesselId?: string,
    availableFrom?: Date,
    availableTo?: Date,
    orgId?: string
  ): Promise<SelectCrew[]>;

  // Skills
  getSkills(orgId?: string): Promise<SelectSkill[]>;
  createSkill(skill: InsertSkill): Promise<SelectSkill>;
  updateSkill(id: string, skill: Partial<InsertSkill>): Promise<SelectSkill>;
  deleteSkill(id: string): Promise<void>;

  // Crew Leave
  getCrewLeave(crewId?: string, startDate?: Date, endDate?: Date): Promise<SelectCrewLeave[]>;
  createCrewLeave(leave: InsertCrewLeave): Promise<SelectCrewLeave>;
  updateCrewLeave(id: string, leave: Partial<InsertCrewLeave>): Promise<SelectCrewLeave>;
  deleteCrewLeave(id: string): Promise<void>;

  // Shift Templates
  getShiftTemplates(vesselId?: string): Promise<SelectShiftTemplate[]>;
  getShiftTemplate(id: string): Promise<SelectShiftTemplate | undefined>;
  createShiftTemplate(template: InsertShiftTemplate): Promise<SelectShiftTemplate>;
  updateShiftTemplate(
    id: string,
    template: Partial<InsertShiftTemplate>
  ): Promise<SelectShiftTemplate>;
  deleteShiftTemplate(id: string): Promise<void>;

  // Crew Assignments
  getCrewAssignments(
    date?: string,
    crewId?: string,
    vesselId?: string
  ): Promise<SelectCrewAssignment[]>;
  createCrewAssignment(assignment: InsertCrewAssignment): Promise<SelectCrewAssignment>;
  updateCrewAssignment(
    id: string,
    assignment: Partial<InsertCrewAssignment>
  ): Promise<SelectCrewAssignment>;
  deleteCrewAssignment(id: string): Promise<void>;
  createBulkCrewAssignments(assignments: InsertCrewAssignment[]): Promise<SelectCrewAssignment[]>;
  getCrewAssignmentsByDateRange(
    from: Date,
    to: Date,
    orgId?: string
  ): Promise<SelectCrewAssignment[]>;
  deleteCrewAssignmentsByRunId(orgId: string, runId: string): Promise<number>;

  // Crew Certifications
  getCrewCertifications(crewId?: string): Promise<SelectCrewCertification[]>;
  createCrewCertification(cert: InsertCrewCertification): Promise<SelectCrewCertification>;
  updateCrewCertification(
    id: string,
    cert: Partial<InsertCrewCertification>
  ): Promise<SelectCrewCertification>;
  deleteCrewCertification(id: string): Promise<void>;
  getCertificationsExpiring(
    orgId: string,
    daysAhead?: number,
    includeAcknowledged?: boolean
  ): Promise<SelectCrewCertification[]>;
  acknowledgeCertificationAlert(
    certId: string,
    userId?: string,
    notes?: string
  ): Promise<SelectCrewCertification>;
  updateCertificationAlertFlags(
    orgId: string
  ): Promise<{
    scanned: number;
    flagged: number;
    critical: number;
    warning: number;
    notice: number;
  }>;

  // Crew Documents
  getCrewDocuments(crewId: string): Promise<SelectCrewDocument[]>;
  getCrewDocumentById(id: string): Promise<SelectCrewDocument | undefined>;
  createCrewDocument(doc: InsertCrewDocument): Promise<SelectCrewDocument>;
  updateCrewDocument(id: string, doc: Partial<InsertCrewDocument>): Promise<SelectCrewDocument>;
  deleteCrewDocument(id: string): Promise<void>;
  getDocumentsExpiring(
    orgId: string,
    daysAhead?: number,
    includeAcknowledged?: boolean
  ): Promise<SelectCrewDocument[]>;
  acknowledgeDocumentAlert(
    docId: string,
    userId?: string,
    notes?: string
  ): Promise<SelectCrewDocument>;
  updateDocumentAlertFlags(
    orgId: string
  ): Promise<{
    scanned: number;
    flagged: number;
    critical: number;
    warning: number;
    notice: number;
  }>;

  // Crew Notification Settings
  getCrewNotificationSettings(
    crewId: string,
    orgId: string
  ): Promise<CrewNotificationSettings | undefined>;
  upsertCrewNotificationSettings(
    crewId: string,
    orgId: string,
    data: {
      emailAlertsEnabled?: boolean;
      certExpiryEmailEnabled?: boolean;
      documentExpiryEmailEnabled?: boolean;
      complianceEmailEnabled?: boolean;
      overrideEmail?: string | null;
    }
  ): Promise<CrewNotificationSettings>;
  getAllCrewNotificationSettings(orgId: string): Promise<CrewNotificationSettings[]>;

  // Crew Rest Hours
  createCrewRestSheet(sheet: InsertCrewRestSheet): Promise<SelectCrewRestSheet>;
  upsertCrewRestDay(sheetId: string, dayData: any): Promise<SelectCrewRestDay>;
  getCrewRestMonth(
    crewId: string,
    year: number,
    month: string
  ): Promise<{ sheet: SelectCrewRestSheet | null; days: any[] }>;
  getCrewRestRange(
    crewId: string,
    startDate: string,
    endDate: string
  ): Promise<{ sheets: SelectCrewRestSheet[]; days: SelectCrewRestDay[] }>;
  getMultipleCrewRest(
    crewIds: string[],
    year: number,
    month: string
  ): Promise<{
    [crewId: string]: { sheet: SelectCrewRestSheet | null; days: SelectCrewRestDay[] };
  }>;
  getVesselCrewRest(
    vesselId: string,
    year: number,
    month: string
  ): Promise<{
    [crewId: string]: { sheet: SelectCrewRestSheet | null; days: SelectCrewRestDay[] };
  }>;
  getCrewRestByDateRange(
    vesselId?: string,
    startDate?: string,
    endDate?: string,
    complianceFilter?: boolean
  ): Promise<
    { crewId: string; vesselId: string; sheet: SelectCrewRestSheet; days: SelectCrewRestDay[] }[]
  >;
}
