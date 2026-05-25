import type { WidenPartial } from "../../../lib/widen-partial";
/**
 * Crew Application Service
 * Orchestrates use cases with dependency injection.
 *
 * Hexagonal note: this service depends only on ports declared in this file
 * and on the existing domain ports (`ICrewMemberRepository`,
 * `ICrewEventPublisher`). Concrete adapters are wired in
 * `server/composition/crew-application-service.ts`.
 */

import type { ICrewMemberRepository, ICrewEventPublisher, SelectCrew, InsertCrew } from "../domain";
import { db } from "../../../db-config";
import { skills } from "@shared/schema-runtime";
import { eq, and } from "drizzle-orm";
import type {
  SelectCrewCertification,
  SelectCrewDocument,
} from "@shared/schema";

interface CrewNotificationSettingsLike {
  emailAlertsEnabled?: boolean | null;
  certExpiryEmailEnabled?: boolean | null;
  documentExpiryEmailEnabled?: boolean | null;
  complianceEmailEnabled?: boolean | null;
  overrideEmail?: string | null;
  [key: string]: unknown;
}

/**
 * Port for the crew storage adapter. Methods mirror the shape of
 * `dbCrewStorage` but the service does not know that concrete name.
 */
export interface CrewStoragePort {
  getCrewSkills(crewId: string): Promise<unknown>;
  assignSkillToCrew(crewId: string, skillId: string, level: string): Promise<unknown>;
  removeSkillFromCrew(crewId: string, skillId: string): Promise<unknown>;
  getCrewLeave(crewId?: string, orgId?: string): Promise<unknown>;
  createCrewLeave(data: Record<string, unknown>): Promise<unknown>;
  updateCrewLeave(id: string, data: Record<string, unknown>, orgId: string): Promise<unknown>;
  deleteCrewLeave(id: string, orgId: string): Promise<unknown>;
  getCrewAssignments(orgId?: string, filters?: { vesselId?: string; crewId?: string }): Promise<unknown>;
  createCrewAssignment(data: Record<string, unknown>): Promise<unknown>;
  updateCrewAssignment(id: string, data: Record<string, unknown>, orgId: string): Promise<unknown>;
  deleteCrewAssignment(id: string, orgId: string): Promise<unknown>;
}

/**
 * Port for the crew-extensions storage adapter (certifications, documents,
 * notification settings). Mirrors `dbCrewExtensionsStorage` shape only.
 */
export interface CrewExtensionsStoragePort {
  getCrewCertifications(crewId: string, orgId: string): Promise<unknown>;
  createCrewCertification(data: Record<string, unknown>): Promise<unknown>;
  updateCrewCertification(id: string, data: Record<string, unknown>, orgId: string): Promise<unknown>;
  deleteCrewCertification(id: string, orgId: string): Promise<unknown>;
  getCertificationsExpiring(orgId: string, daysAhead: number, includeAcknowledged: boolean): Promise<SelectCrewCertification[]>;
  acknowledgeCertificationAlert(certId: string, userId: string | undefined, notes: string | undefined): Promise<unknown>;
  updateCertificationAlertFlags(orgId: string): Promise<unknown>;
  getCrewDocuments(crewId: string, orgId: string): Promise<unknown>;
  createCrewDocument(data: Record<string, unknown>): Promise<unknown>;
  updateCrewDocument(id: string, data: Record<string, unknown>, orgId: string): Promise<unknown>;
  deleteCrewDocument(id: string, orgId: string): Promise<unknown>;
  getDocumentsExpiring(orgId: string, daysAhead: number, includeAcknowledged: boolean): Promise<SelectCrewDocument[]>;
  acknowledgeDocumentAlert(docId: string, userId: string | undefined, notes: string | undefined): Promise<unknown>;
  updateDocumentAlertFlags(orgId: string): Promise<unknown>;
  getCrewNotificationSettings(crewId: string, orgId: string): Promise<CrewNotificationSettingsLike | undefined>;
  upsertCrewNotificationSettings(crewId: string, orgId: string, data: Record<string, unknown>): Promise<unknown>;
  getAllCrewNotificationSettings(orgId: string): Promise<unknown>;
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
    data: WidenPartial<InsertCrew>,
    userId?: string,
    orgId?: string
  ): Promise<SelectCrew> {
    const sanitizedData = {
      ...data,
      ...(data.vesselId !== undefined && { vesselId: data.vesselId || null }),
      ...(data.roleId !== undefined && { roleId: data.roleId || null }),
    };

    const crew = await (
      this.deps.crewMemberRepository.updateCrew as (
        id: string,
        data: WidenPartial<InsertCrew>,
        orgId?: string,
      ) => Promise<SelectCrew>
    )(id, sanitizedData, orgId);

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
    await (
      this.deps.crewMemberRepository.deleteCrew as (id: string, orgId?: string) => Promise<void>
    )(id, orgId);

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

  async createCertification(data: Record<string, unknown>, userId?: string) {
    return this.deps.crewExtensionsStorage.createCrewCertification(data);
  }

  async updateCertification(id: string, data: Record<string, unknown>, userId?: string, orgId?: string) {
    return this.deps.crewExtensionsStorage.updateCrewCertification(
      id,
      data,
      orgId || (typeof data['orgId'] === "string" ? data['orgId'] : ""),
    );
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

  async createCrewDocument(data: Record<string, unknown>, userId?: string) {
    return this.deps.crewExtensionsStorage.createCrewDocument(data);
  }

  async updateCrewDocument(id: string, data: Record<string, unknown>, userId?: string, orgId?: string) {
    return this.deps.crewExtensionsStorage.updateCrewDocument(
      id,
      data,
      orgId || (typeof data['orgId'] === "string" ? data['orgId'] : ""),
    );
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

  async upsertCrewNotificationSettings(crewId: string, orgId: string, data: Record<string, unknown>) {
    return this.deps.crewExtensionsStorage.upsertCrewNotificationSettings(crewId, orgId, data);
  }

  async getAllCrewNotificationSettings(orgId: string) {
    return this.deps.crewExtensionsStorage.getAllCrewNotificationSettings(orgId);
  }

  async listSkills(orgId: string) {
    return db.select().from(skills).where(eq(skills.orgId, orgId));
  }

  async createSkill(data: typeof skills.$inferInsert, userId?: string) {
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

  async createLeave(data: Record<string, unknown>, userId?: string) {
    return this.deps.crewStorage.createCrewLeave(data);
  }

  async updateLeave(id: string, data: Record<string, unknown>, userId?: string, orgId?: string) {
    return this.deps.crewStorage.updateCrewLeave(
      id,
      data,
      orgId || (typeof data['orgId'] === "string" ? data['orgId'] : ""),
    );
  }

  async deleteLeave(id: string, userId?: string, orgId?: string) {
    return this.deps.crewStorage.deleteCrewLeave(id, orgId || "");
  }

  // Assignments - delegated via port
  async listAssignments(orgId?: string, vesselId?: string, crewId?: string) {
    return this.deps.crewStorage.getCrewAssignments(orgId, {
      ...(vesselId !== undefined ? { vesselId } : {}),
      ...(crewId !== undefined ? { crewId } : {}),
    });
  }

  async createAssignment(data: Record<string, unknown>, userId?: string) {
    return this.deps.crewStorage.createCrewAssignment(data);
  }

  async updateAssignment(id: string, data: Record<string, unknown>, orgId: string, userId?: string) {
    return this.deps.crewStorage.updateCrewAssignment(id, data, orgId);
  }

  async deleteAssignment(id: string, userId?: string, orgId?: string) {
    return this.deps.crewStorage.deleteCrewAssignment(id, orgId || "");
  }
}
