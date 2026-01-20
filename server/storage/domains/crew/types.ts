/**
 * Crew Storage Types
 * Crew management, skills, certifications, leave, and assignments
 */

import type {
  SelectCrew,
  InsertCrew,
  SelectCrewSkill,
  InsertCrewSkill,
  SelectSkill,
  InsertSkill,
  SelectCrewLeave,
  InsertCrewLeave,
  SelectShiftTemplate,
  InsertShiftTemplate,
  SelectCrewAssignment,
  InsertCrewAssignment,
  SelectCrewCertification,
  InsertCrewCertification,
  SelectCrewDocument,
  InsertCrewDocument,
  CrewWithSkills,
  CrewNotificationSettings,
} from "@shared/schema-runtime";

export interface CrewFilters {
  orgId?: string;
  vesselId?: string;
}

export interface LeaveFilters {
  crewId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AssignmentFilters {
  date?: string;
  crewId?: string;
  vesselId?: string;
}

/**
 * Crew Storage Interface
 * Defines all operations for crew management
 */
export interface ICrewStorage {
  // Core crew operations
  getCrew(orgId?: string, vesselId?: string): Promise<CrewWithSkills[]>;
  getCrewMember(id: string, orgId?: string): Promise<SelectCrew | undefined>;
  createCrew(crewData: InsertCrew): Promise<SelectCrew>;
  updateCrew(id: string, crewData: Partial<InsertCrew>): Promise<SelectCrew>;
  deleteCrew(id: string): Promise<void>;

  // Skills operations
  setCrewSkill(crewId: string, skill: string, level: number): Promise<SelectCrewSkill>;
  getCrewSkills(crewId: string): Promise<SelectCrewSkill[]>;
  deleteCrewSkill(crewId: string, skill: string): Promise<void>;

  // Skills catalog
  getSkills(orgId?: string): Promise<SelectSkill[]>;
  createSkill(skill: InsertSkill): Promise<SelectSkill>;
  updateSkill(id: string, skill: Partial<InsertSkill>): Promise<SelectSkill>;
  deleteSkill(id: string): Promise<void>;

  // Leave management
  getCrewLeave(crewId?: string, startDate?: Date, endDate?: Date): Promise<SelectCrewLeave[]>;
  createCrewLeave(leaveData: InsertCrewLeave): Promise<SelectCrewLeave>;
  updateCrewLeave(id: string, leaveData: Partial<InsertCrewLeave>): Promise<SelectCrewLeave>;
  deleteCrewLeave(id: string): Promise<void>;

  // Shift templates
  getShiftTemplates(vesselId?: string): Promise<SelectShiftTemplate[]>;
  getShiftTemplate(id: string): Promise<SelectShiftTemplate | undefined>;
  createShiftTemplate(templateData: InsertShiftTemplate): Promise<SelectShiftTemplate>;
  updateShiftTemplate(id: string, templateData: Partial<InsertShiftTemplate>): Promise<SelectShiftTemplate>;
  deleteShiftTemplate(id: string): Promise<void>;

  // Crew assignments
  getCrewAssignments(date?: string, crewId?: string, vesselId?: string): Promise<SelectCrewAssignment[]>;
  createCrewAssignment(assignmentData: InsertCrewAssignment): Promise<SelectCrewAssignment>;
  updateCrewAssignment(id: string, assignmentData: Partial<InsertCrewAssignment>): Promise<SelectCrewAssignment>;
  deleteCrewAssignment(id: string): Promise<void>;
  createBulkCrewAssignments(assignments: InsertCrewAssignment[]): Promise<SelectCrewAssignment[]>;

  // Certifications
  getCrewCertifications(crewId?: string): Promise<SelectCrewCertification[]>;
  createCrewCertification(cert: InsertCrewCertification): Promise<SelectCrewCertification>;
  updateCrewCertification(id: string, cert: Partial<InsertCrewCertification>): Promise<SelectCrewCertification>;
  deleteCrewCertification(id: string): Promise<void>;

  // Documents
  getCrewDocuments(crewId: string, orgId: string): Promise<SelectCrewDocument[]>;
  getCrewDocumentById(id: string, orgId: string): Promise<SelectCrewDocument | undefined>;
  createCrewDocument(document: InsertCrewDocument): Promise<SelectCrewDocument>;
  updateCrewDocument(id: string, document: Partial<InsertCrewDocument>, orgId: string): Promise<SelectCrewDocument>;
  deleteCrewDocument(id: string, orgId: string): Promise<void>;

  // Notification settings
  getCrewNotificationSettings(crewId: string, orgId: string): Promise<CrewNotificationSettings | undefined>;
  upsertCrewNotificationSettings(crewId: string, orgId: string, data: Partial<CrewNotificationSettings>): Promise<CrewNotificationSettings>;
  getAllCrewNotificationSettings(orgId: string): Promise<CrewNotificationSettings[]>;
}

// Re-export for convenience
export type {
  SelectCrew,
  InsertCrew,
  SelectCrewSkill,
  InsertCrewSkill,
  SelectSkill,
  InsertSkill,
  SelectCrewLeave,
  InsertCrewLeave,
  SelectShiftTemplate,
  InsertShiftTemplate,
  SelectCrewAssignment,
  InsertCrewAssignment,
  SelectCrewCertification,
  InsertCrewCertification,
  SelectCrewDocument,
  InsertCrewDocument,
  CrewWithSkills,
  CrewNotificationSettings,
};
