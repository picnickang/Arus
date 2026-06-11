import type { WidenPartial } from "../../../lib/widen-partial";
/**
 * Crew Domain - Port Interfaces
 * Repository and service interfaces for dependency inversion
 */

import type {
  SelectCrew,
  InsertCrew,
  SelectSkill,
  InsertSkill,
  SelectCrewSkill,
  SelectCrewLeave,
  InsertCrewLeave,
  SelectCrewAssignment,
  InsertCrewAssignment,
  SelectCrewCertification,
  InsertCrewCertification,
  SelectCrewDocument,
  InsertCrewDocument,
} from "./types";
import type { CrewDomainEvent } from "./events";

export interface ICrewMemberRepository {
  findAllCrew(orgId?: string, vesselId?: string): Promise<SelectCrew[]>;
  findCrewById(id: string, orgId?: string): Promise<SelectCrew | undefined>;
  createCrew(data: InsertCrew): Promise<SelectCrew>;
  updateCrew(id: string, data: WidenPartial<InsertCrew>): Promise<SelectCrew>;
  deleteCrew(id: string): Promise<void>;
}

export interface ISkillRepository {
  findAllSkills(orgId?: string): Promise<SelectSkill[]>;
  findSkillById(id: string): Promise<SelectSkill | undefined>;
  createSkill(data: InsertSkill): Promise<SelectSkill>;
  updateSkill(id: string, data: WidenPartial<InsertSkill>): Promise<SelectSkill>;
  deleteSkill(id: string): Promise<void>;
  findCrewSkills(crewId: string): Promise<SelectCrewSkill[]>;
  assignSkill(crewId: string, skillId: string, level?: string): Promise<SelectCrewSkill>;
  removeSkill(crewId: string, skillId: string): Promise<void>;
}

export interface ILeaveRepository {
  findAllLeave(orgId?: string, crewId?: string): Promise<SelectCrewLeave[]>;
  findLeaveById(id: string): Promise<SelectCrewLeave | undefined>;
  createLeave(data: InsertCrewLeave): Promise<SelectCrewLeave>;
  updateLeave(id: string, data: WidenPartial<InsertCrewLeave>): Promise<SelectCrewLeave>;
  deleteLeave(id: string): Promise<void>;
}

export interface IAssignmentRepository {
  findAllAssignments(orgId?: string, vesselId?: string): Promise<SelectCrewAssignment[]>;
  findAssignmentById(id: string): Promise<SelectCrewAssignment | undefined>;
  createAssignment(data: InsertCrewAssignment): Promise<SelectCrewAssignment>;
  updateAssignment(
    id: string,
    data: WidenPartial<InsertCrewAssignment>
  ): Promise<SelectCrewAssignment>;
  deleteAssignment(id: string): Promise<void>;
  findActiveAssignments(crewId: string): Promise<SelectCrewAssignment[]>;
}

export interface ICertificationRepository {
  findAllCertifications(crewId?: string): Promise<SelectCrewCertification[]>;
  findCertificationById(id: string): Promise<SelectCrewCertification | undefined>;
  createCertification(data: InsertCrewCertification): Promise<SelectCrewCertification>;
  updateCertification(
    id: string,
    data: WidenPartial<InsertCrewCertification>
  ): Promise<SelectCrewCertification>;
  deleteCertification(id: string): Promise<void>;
  findExpiringCertifications(daysAhead: number): Promise<SelectCrewCertification[]>;
}

export interface IDocumentRepository {
  findAllDocuments(crewId?: string): Promise<SelectCrewDocument[]>;
  findDocumentById(id: string): Promise<SelectCrewDocument | undefined>;
  createDocument(data: InsertCrewDocument): Promise<SelectCrewDocument>;
  updateDocument(id: string, data: WidenPartial<InsertCrewDocument>): Promise<SelectCrewDocument>;
  deleteDocument(id: string): Promise<void>;
}

export interface ICrewEventPublisher {
  publish(event: CrewDomainEvent): Promise<void>;
  publishBatch(events: CrewDomainEvent[]): Promise<void>;
}
