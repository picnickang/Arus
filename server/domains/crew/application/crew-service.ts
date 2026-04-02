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
import { storage } from "../../../storage";

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
    
    const crew = await this.deps.crewMemberRepository.updateCrew(id, sanitizedData);

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
    await this.deps.crewMemberRepository.deleteCrew(id);

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
      return storage.getCrewCertifications(crewId, orgId);
    }
    return [];
  }

  async createCertification(data: any, userId?: string) {
    return storage.createCrewCertification(data);
  }

  async updateCertification(id: string, data: any, userId?: string, orgId?: string) {
    return storage.updateCrewCertification(id, data, orgId || data.orgId);
  }

  async deleteCertification(id: string, userId?: string, orgId?: string) {
    return storage.deleteCrewCertification(id, orgId || "");
  }

  async getCertificationsExpiring(orgId: string, daysAhead: number = 90, includeAcknowledged: boolean = false) {
    return storage.getCertificationsExpiring(orgId, daysAhead, includeAcknowledged);
  }

  async acknowledgeCertificationAlert(certId: string, userId?: string, notes?: string) {
    return storage.acknowledgeCertificationAlert(certId, userId, notes);
  }

  async scanAndFlagExpiringCertifications(orgId: string) {
    return storage.updateCertificationAlertFlags(orgId);
  }

  // Documents - delegated to storage (orgId from request context via data.orgId)
  async getCrewDocuments(crewId: string, orgId?: string) {
    return storage.getCrewDocuments(crewId, orgId || "");
  }

  async createCrewDocument(data: any, userId?: string) {
    return storage.createCrewDocument(data);
  }

  async updateCrewDocument(id: string, data: any, userId?: string, orgId?: string) {
    return storage.updateCrewDocument(id, data, orgId || data.orgId);
  }

  async deleteCrewDocument(id: string, userId?: string, orgId?: string) {
    return storage.deleteCrewDocument(id, orgId || "");
  }

  async getDocumentsExpiring(orgId: string, daysAhead: number = 90, includeAcknowledged: boolean = false) {
    return storage.getDocumentsExpiring(orgId, daysAhead, includeAcknowledged);
  }

  async acknowledgeDocumentAlert(docId: string, userId?: string, notes?: string) {
    return storage.acknowledgeDocumentAlert(docId, userId, notes);
  }

  async scanAndFlagExpiringDocuments(orgId: string) {
    return storage.updateDocumentAlertFlags(orgId);
  }

  // Notification settings - delegated to storage
  async getCrewNotificationSettings(crewId: string, orgId: string) {
    return storage.getCrewNotificationSettings(crewId, orgId);
  }

  async upsertCrewNotificationSettings(crewId: string, orgId: string, data: any) {
    return storage.upsertCrewNotificationSettings(crewId, orgId, data);
  }

  async getAllCrewNotificationSettings(orgId: string) {
    return storage.getAllCrewNotificationSettings(orgId);
  }

  // Skills - delegated to storage
  async listSkills(orgId: string) {
    return storage.getSkills(orgId);
  }

  async createSkill(data: any, userId?: string) {
    return storage.createSkill(data);
  }

  async deleteSkill(id: string, userId?: string) {
    return storage.deleteSkill(id);
  }

  async getCrewSkills(crewId: string) {
    return storage.getCrewSkills(crewId);
  }

  async assignSkillToCrew(crewId: string, skillId: string, level: string, userId?: string) {
    return storage.assignSkillToCrew(crewId, skillId, level);
  }

  async removeSkillFromCrew(crewId: string, skillId: string, userId?: string) {
    return storage.removeSkillFromCrew(crewId, skillId);
  }

  // Leave - delegated to storage
  async listLeave(orgId?: string, crewId?: string, status?: string) {
    return storage.getCrewLeave(crewId, orgId);
  }

  async createLeave(data: any, userId?: string) {
    return storage.createCrewLeave(data);
  }

  async updateLeave(id: string, data: any, userId?: string, orgId?: string) {
    return storage.updateCrewLeave(id, data, orgId || data.orgId);
  }

  async deleteLeave(id: string, userId?: string, orgId?: string) {
    return storage.deleteCrewLeave(id, orgId || "");
  }

  // Assignments - delegated to storage
  async listAssignments(orgId?: string, vesselId?: string, crewId?: string) {
    return storage.getCrewAssignments(orgId, vesselId, crewId);
  }

  async createAssignment(data: any, userId?: string) {
    return storage.createCrewAssignment(data);
  }

  async updateAssignment(id: string, data: any, orgId: string, userId?: string) {
    return storage.updateCrewAssignment(id, data, orgId);
  }

  async deleteAssignment(id: string, userId?: string, orgId?: string) {
    return storage.deleteCrewAssignment(id, orgId || "");
  }
}
