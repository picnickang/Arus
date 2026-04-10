/**
 * Crew Application Service
 * Orchestrates use cases with dependency injection
 */

import type {
  ICrewMemberRepository,
  ICrewEventPublisher,
  SelectCrew,
  InsertCrew,
} from "../domain";
import { dbCrewExtensionsStorage, dbCrewStorage } from "../../../repositories";
import { db } from "../../../db-config";
import { skills } from "@shared/schema-runtime";
import { eq } from "drizzle-orm";

export interface CrewServiceDependencies {
  crewMemberRepository: ICrewMemberRepository;
  eventPublisher: ICrewEventPublisher;
}

export class CrewApplicationService {
  constructor(private deps: CrewServiceDependencies) {}

  async listCrew(orgId?: string, vesselId?: string): Promise<SelectCrew[]> {
    return this.deps.crewMemberRepository.findAllCrew(orgId, vesselId);
  }

  async getCrewById(id: string, orgId?: string): Promise<SelectCrew | undefined> {
    return this.deps.crewMemberRepository.findCrewById(id, orgId);
  }

  async getCrewMemberById(id: string, orgId?: string): Promise<SelectCrew | undefined> {
    return this.deps.crewMemberRepository.findCrewById(id, orgId);
  }

  async createCrew(data: InsertCrew, userId?: string): Promise<SelectCrew> {
    const sanitizedData = {
      ...data,
      vesselId: data.vesselId || null,
      roleId: data.roleId || null,
    };
    
    const crew = await this.deps.crewMemberRepository.createCrew(sanitizedData);

    await this.deps.eventPublisher.publish({
      type: "CREW_MEMBER_CREATED",
      crewMemberId: crew.id,
      orgId: crew.orgId || "default",
      vesselId: crew.vesselId || undefined,
      timestamp: new Date(),
    });

    return crew;
  }

  async updateCrew(id: string, data: Partial<InsertCrew>, userId?: string, orgId?: string): Promise<SelectCrew> {
    const sanitizedData = {
      ...data,
      ...(data.vesselId !== undefined && { vesselId: data.vesselId || null }),
      ...(data.roleId !== undefined && { roleId: data.roleId || null }),
    };
    
    const crew = await this.deps.crewMemberRepository.updateCrew(id, sanitizedData, orgId);

    await this.deps.eventPublisher.publish({
      type: "CREW_MEMBER_UPDATED",
      crewMemberId: crew.id,
      orgId: crew.orgId || orgId || "default",
      changes: data,
      timestamp: new Date(),
    });

    return crew;
  }

  async deleteCrew(id: string, userId?: string, orgId?: string): Promise<void> {
    await this.deps.crewMemberRepository.deleteCrew(id, orgId);

    await this.deps.eventPublisher.publish({
      type: "CREW_MEMBER_DELETED",
      crewMemberId: id,
      orgId: orgId || "default",
      timestamp: new Date(),
    });
  }

  // Certifications - delegated to storage (orgId from request context via data.orgId)
  async listCertifications(crewId?: string, orgId?: string) {
    if (crewId && orgId) {
      return dbCrewExtensionsStorage.getCrewCertifications(crewId, orgId);
    }
    return [];
  }

  async createCertification(data: any, userId?: string) {
    return dbCrewExtensionsStorage.createCrewCertification(data);
  }

  async updateCertification(id: string, data: any, userId?: string, orgId?: string) {
    return dbCrewExtensionsStorage.updateCrewCertification(id, data, orgId || data.orgId);
  }

  async deleteCertification(id: string, userId?: string, orgId?: string) {
    return dbCrewExtensionsStorage.deleteCrewCertification(id, orgId || "");
  }

  async getCertificationsExpiring(orgId: string, daysAhead: number = 90, includeAcknowledged: boolean = false) {
    return dbCrewExtensionsStorage.getCertificationsExpiring(orgId, daysAhead, includeAcknowledged);
  }

  async acknowledgeCertificationAlert(certId: string, userId?: string, notes?: string) {
    return dbCrewExtensionsStorage.acknowledgeCertificationAlert(certId, userId, notes);
  }

  async scanAndFlagExpiringCertifications(orgId: string) {
    return dbCrewExtensionsStorage.updateCertificationAlertFlags(orgId);
  }

  // Documents - delegated to storage (orgId from request context via data.orgId)
  async getCrewDocuments(crewId: string, orgId?: string) {
    return dbCrewExtensionsStorage.getCrewDocuments(crewId, orgId || "");
  }

  async createCrewDocument(data: any, userId?: string) {
    return dbCrewExtensionsStorage.createCrewDocument(data);
  }

  async updateCrewDocument(id: string, data: any, userId?: string, orgId?: string) {
    return dbCrewExtensionsStorage.updateCrewDocument(id, data, orgId || data.orgId);
  }

  async deleteCrewDocument(id: string, userId?: string, orgId?: string) {
    return dbCrewExtensionsStorage.deleteCrewDocument(id, orgId || "");
  }

  async getDocumentsExpiring(orgId: string, daysAhead: number = 90, includeAcknowledged: boolean = false) {
    return dbCrewExtensionsStorage.getDocumentsExpiring(orgId, daysAhead, includeAcknowledged);
  }

  async acknowledgeDocumentAlert(docId: string, userId?: string, notes?: string) {
    return dbCrewExtensionsStorage.acknowledgeDocumentAlert(docId, userId, notes);
  }

  async scanAndFlagExpiringDocuments(orgId: string) {
    return dbCrewExtensionsStorage.updateDocumentAlertFlags(orgId);
  }

  // Notification settings - delegated to storage
  async getCrewNotificationSettings(crewId: string, orgId: string) {
    return dbCrewExtensionsStorage.getCrewNotificationSettings(crewId, orgId);
  }

  async upsertCrewNotificationSettings(crewId: string, orgId: string, data: any) {
    return dbCrewExtensionsStorage.upsertCrewNotificationSettings(crewId, orgId, data);
  }

  async getAllCrewNotificationSettings(orgId: string) {
    return dbCrewExtensionsStorage.getAllCrewNotificationSettings(orgId);
  }

  async listSkills(orgId: string) {
    return db.select().from(skills).where(eq(skills.orgId, orgId));
  }

  async createSkill(data: any, userId?: string) {
    const [newSkill] = await db.insert(skills).values(data).returning();
    return newSkill;
  }

  async deleteSkill(id: string, userId?: string) {
    await db.delete(skills).where(eq(skills.id, id));
  }

  async getCrewSkills(crewId: string) {
    return dbCrewStorage.getCrewSkills(crewId);
  }

  async assignSkillToCrew(crewId: string, skillId: string, level: string, userId?: string) {
    return dbCrewStorage.assignSkillToCrew(crewId, skillId, level);
  }

  async removeSkillFromCrew(crewId: string, skillId: string, userId?: string) {
    return dbCrewStorage.removeSkillFromCrew(crewId, skillId);
  }

  // Leave - delegated to storage
  async listLeave(orgId?: string, crewId?: string, status?: string) {
    return dbCrewStorage.getCrewLeave(crewId, orgId);
  }

  async createLeave(data: any, userId?: string) {
    return dbCrewStorage.createCrewLeave(data);
  }

  async updateLeave(id: string, data: any, userId?: string, orgId?: string) {
    return dbCrewStorage.updateCrewLeave(id, data, orgId || data.orgId);
  }

  async deleteLeave(id: string, userId?: string, orgId?: string) {
    return dbCrewStorage.deleteCrewLeave(id, orgId || "");
  }

  // Assignments - delegated to storage
  async listAssignments(orgId?: string, vesselId?: string, crewId?: string) {
    return dbCrewStorage.getCrewAssignments(orgId, { vesselId, crewId });
  }

  async createAssignment(data: any, userId?: string) {
    return dbCrewStorage.createCrewAssignment(data);
  }

  async updateAssignment(id: string, data: any, orgId: string, userId?: string) {
    return dbCrewStorage.updateCrewAssignment(id, data, orgId);
  }

  async deleteAssignment(id: string, userId?: string, orgId?: string) {
    return dbCrewStorage.deleteCrewAssignment(id, orgId || "");
  }
}
