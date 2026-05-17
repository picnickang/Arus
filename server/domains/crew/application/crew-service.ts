// @ts-nocheck
/**
 * Crew Application Service
 * Orchestrates use cases with dependency injection.
 *
 * Hexagonal note: this service depends only on ports declared in this file
 * and on the existing domain ports (`ICrewMemberRepository`,
 * `ICrewEventPublisher`). Concrete adapters are wired in
 * `server/composition/crew-application-service.ts`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ICrewMemberRepository, ICrewEventPublisher, SelectCrew, InsertCrew } from "../domain";
import { db } from "../../../db-config";
import { skills } from "@shared/schema-runtime";
import { eq, and } from "drizzle-orm";

/**
 * Port for the crew storage adapter. Methods mirror the shape of
 * `dbCrewStorage` but the service does not know that concrete name.
 */
export interface CrewStoragePort {
  getCrewSkills(crewId: string): Promise<any>;
  assignSkillToCrew(crewId: string, skillId: string, level: string): Promise<any>;
  removeSkillFromCrew(crewId: string, skillId: string): Promise<any>;
  getCrewLeave(crewId?: string, orgId?: string): Promise<any>;
  createCrewLeave(data: any): Promise<any>;
  updateCrewLeave(id: string, data: any, orgId: string): Promise<any>;
  deleteCrewLeave(id: string, orgId: string): Promise<any>;
  getCrewAssignments(orgId?: string, filters?: { vesselId?: string; crewId?: string }): Promise<any>;
  createCrewAssignment(data: any): Promise<any>;
  updateCrewAssignment(id: string, data: any, orgId: string): Promise<any>;
  deleteCrewAssignment(id: string, orgId: string): Promise<any>;
}

/**
 * Port for the crew-extensions storage adapter (certifications, documents,
 * notification settings). Mirrors `dbCrewExtensionsStorage` shape only.
 */
export interface CrewExtensionsStoragePort {
  getCrewCertifications(crewId: string, orgId: string): Promise<any>;
  createCrewCertification(data: any): Promise<any>;
  updateCrewCertification(id: string, data: any, orgId: string): Promise<any>;
  deleteCrewCertification(id: string, orgId: string): Promise<any>;
  getCertificationsExpiring(orgId: string, daysAhead: number, includeAcknowledged: boolean): Promise<any>;
  acknowledgeCertificationAlert(certId: string, userId: string | undefined, notes: string | undefined): Promise<any>;
  updateCertificationAlertFlags(orgId: string): Promise<any>;
  getCrewDocuments(crewId: string, orgId: string): Promise<any>;
  createCrewDocument(data: any): Promise<any>;
  updateCrewDocument(id: string, data: any, orgId: string): Promise<any>;
  deleteCrewDocument(id: string, orgId: string): Promise<any>;
  getDocumentsExpiring(orgId: string, daysAhead: number, includeAcknowledged: boolean): Promise<any>;
  acknowledgeDocumentAlert(docId: string, userId: string | undefined, notes: string | undefined): Promise<any>;
  updateDocumentAlertFlags(orgId: string): Promise<any>;
  getCrewNotificationSettings(crewId: string, orgId: string): Promise<any>;
  upsertCrewNotificationSettings(crewId: string, orgId: string, data: any): Promise<any>;
  getAllCrewNotificationSettings(orgId: string): Promise<any>;
}

export interface CrewServiceDependencies {
  crewMemberRepository: ICrewMemberRepository;
  eventPublisher: ICrewEventPublisher;
  crewStorage: CrewStoragePort;
  crewExtensionsStorage: CrewExtensionsStoragePort;
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

  async updateCrew(
    id: string,
    data: Partial<InsertCrew>,
    userId?: string,
    orgId?: string
  ): Promise<SelectCrew> {
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

  // Certifications - delegated via port (orgId from request context via data.orgId)
  async listCertifications(crewId?: string, orgId?: string) {
    if (crewId && orgId) {
      return this.deps.crewExtensionsStorage.getCrewCertifications(crewId, orgId);
    }
    return [];
  }

  async createCertification(data: any, userId?: string) {
    return this.deps.crewExtensionsStorage.createCrewCertification(data);
  }

  async updateCertification(id: string, data: any, userId?: string, orgId?: string) {
    return this.deps.crewExtensionsStorage.updateCrewCertification(id, data, orgId || data.orgId);
  }

  async deleteCertification(id: string, userId?: string, orgId?: string) {
    return this.deps.crewExtensionsStorage.deleteCrewCertification(id, orgId || "");
  }

  async getCertificationsExpiring(
    orgId: string,
    daysAhead: number = 90,
    includeAcknowledged: boolean = false
  ) {
    return this.deps.crewExtensionsStorage.getCertificationsExpiring(orgId, daysAhead, includeAcknowledged);
  }

  async acknowledgeCertificationAlert(certId: string, userId?: string, notes?: string) {
    return this.deps.crewExtensionsStorage.acknowledgeCertificationAlert(certId, userId, notes);
  }

  async scanAndFlagExpiringCertifications(orgId: string) {
    return this.deps.crewExtensionsStorage.updateCertificationAlertFlags(orgId);
  }

  // Documents - delegated via port (orgId from request context via data.orgId)
  async getCrewDocuments(crewId: string, orgId?: string) {
    return this.deps.crewExtensionsStorage.getCrewDocuments(crewId, orgId || "");
  }

  async createCrewDocument(data: any, userId?: string) {
    return this.deps.crewExtensionsStorage.createCrewDocument(data);
  }

  async updateCrewDocument(id: string, data: any, userId?: string, orgId?: string) {
    return this.deps.crewExtensionsStorage.updateCrewDocument(id, data, orgId || data.orgId);
  }

  async deleteCrewDocument(id: string, userId?: string, orgId?: string) {
    return this.deps.crewExtensionsStorage.deleteCrewDocument(id, orgId || "");
  }

  async getDocumentsExpiring(
    orgId: string,
    daysAhead: number = 90,
    includeAcknowledged: boolean = false
  ) {
    return this.deps.crewExtensionsStorage.getDocumentsExpiring(orgId, daysAhead, includeAcknowledged);
  }

  async acknowledgeDocumentAlert(docId: string, userId?: string, notes?: string) {
    return this.deps.crewExtensionsStorage.acknowledgeDocumentAlert(docId, userId, notes);
  }

  async scanAndFlagExpiringDocuments(orgId: string) {
    return this.deps.crewExtensionsStorage.updateDocumentAlertFlags(orgId);
  }

  // Notification settings - delegated via port
  async getCrewNotificationSettings(crewId: string, orgId: string) {
    return this.deps.crewExtensionsStorage.getCrewNotificationSettings(crewId, orgId);
  }

  async upsertCrewNotificationSettings(crewId: string, orgId: string, data: any) {
    return this.deps.crewExtensionsStorage.upsertCrewNotificationSettings(crewId, orgId, data);
  }

  async getAllCrewNotificationSettings(orgId: string) {
    return this.deps.crewExtensionsStorage.getAllCrewNotificationSettings(orgId);
  }

  async listSkills(orgId: string) {
    return db.select().from(skills).where(eq(skills.orgId, orgId));
  }

  async createSkill(data: any, userId?: string) {
    const [newSkill] = await db.insert(skills).values(data).returning();
    return newSkill;
  }

  async deleteSkill(id: string, orgId?: string) {
    const conditions = orgId ? and(eq(skills.id, id), eq(skills.orgId, orgId)) : eq(skills.id, id);
    await db.delete(skills).where(conditions);
  }

  async getCrewSkills(crewId: string) {
    return this.deps.crewStorage.getCrewSkills(crewId);
  }

  async assignSkillToCrew(crewId: string, skillId: string, level: string, userId?: string) {
    return this.deps.crewStorage.assignSkillToCrew(crewId, skillId, level);
  }

  async removeSkillFromCrew(crewId: string, skillId: string, userId?: string) {
    return this.deps.crewStorage.removeSkillFromCrew(crewId, skillId);
  }

  // Leave - delegated via port
  async listLeave(orgId?: string, crewId?: string, status?: string) {
    return this.deps.crewStorage.getCrewLeave(crewId, orgId);
  }

  async createLeave(data: any, userId?: string) {
    return this.deps.crewStorage.createCrewLeave(data);
  }

  async updateLeave(id: string, data: any, userId?: string, orgId?: string) {
    return this.deps.crewStorage.updateCrewLeave(id, data, orgId || data.orgId);
  }

  async deleteLeave(id: string, userId?: string, orgId?: string) {
    return this.deps.crewStorage.deleteCrewLeave(id, orgId || "");
  }

  // Assignments - delegated via port
  async listAssignments(orgId?: string, vesselId?: string, crewId?: string) {
    return this.deps.crewStorage.getCrewAssignments(orgId, { vesselId, crewId });
  }

  async createAssignment(data: any, userId?: string) {
    return this.deps.crewStorage.createCrewAssignment(data);
  }

  async updateAssignment(id: string, data: any, orgId: string, userId?: string) {
    return this.deps.crewStorage.updateCrewAssignment(id, data, orgId);
  }

  async deleteAssignment(id: string, userId?: string, orgId?: string) {
    return this.deps.crewStorage.deleteCrewAssignment(id, orgId || "");
  }
}
