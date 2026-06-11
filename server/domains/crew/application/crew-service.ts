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
  SelectCrewAlert,
  InsertCrewAlert,
  SelectCrewRole,
  InsertCrewRole,
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
  getCrewAssignments(
    orgId?: string,
    filters?: { vesselId?: string; crewId?: string }
  ): Promise<unknown>;
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
  updateCrewCertification(
    id: string,
    data: Record<string, unknown>,
    orgId: string
  ): Promise<unknown>;
  deleteCrewCertification(id: string, orgId: string): Promise<unknown>;
  getCertificationsExpiring(
    orgId: string,
    daysAhead: number,
    includeAcknowledged: boolean
  ): Promise<SelectCrewCertification[]>;
  acknowledgeCertificationAlert(
    certId: string,
    userId: string | undefined,
    notes: string | undefined
  ): Promise<unknown>;
  updateCertificationAlertFlags(orgId: string): Promise<unknown>;
  getCrewDocuments(crewId: string, orgId: string): Promise<unknown>;
  createCrewDocument(data: Record<string, unknown>): Promise<unknown>;
  updateCrewDocument(id: string, data: Record<string, unknown>, orgId: string): Promise<unknown>;
  deleteCrewDocument(id: string, orgId: string): Promise<unknown>;
  getDocumentsExpiring(
    orgId: string,
    daysAhead: number,
    includeAcknowledged: boolean
  ): Promise<SelectCrewDocument[]>;
  getCrewDocumentTypesByOrg(
    orgId: string
  ): Promise<{ crewId: string; documentType: string; expiresAt: Date | null }[]>;
  acknowledgeDocumentAlert(
    docId: string,
    userId: string | undefined,
    notes: string | undefined
  ): Promise<unknown>;
  updateDocumentAlertFlags(orgId: string): Promise<unknown>;
  getCrewNotificationSettings(
    crewId: string,
    orgId: string
  ): Promise<CrewNotificationSettingsLike | undefined>;
  upsertCrewNotificationSettings(
    crewId: string,
    orgId: string,
    data: Record<string, unknown>
  ): Promise<unknown>;
  getAllCrewNotificationSettings(orgId: string): Promise<unknown>;
  getCrewAlerts(crewId: string, orgId: string): Promise<SelectCrewAlert[]>;
  createCrewAlert(data: InsertCrewAlert): Promise<SelectCrewAlert>;
  acknowledgeCrewAlert(
    alertId: string,
    orgId: string,
    userId?: string,
    notes?: string
  ): Promise<SelectCrewAlert>;
  deleteCrewAlert(alertId: string, orgId: string): Promise<void>;
  getCrewRoles(orgId: string): Promise<SelectCrewRole[]>;
  getCrewRoleById(id: string, orgId: string): Promise<SelectCrewRole | undefined>;
  createCrewRole(data: InsertCrewRole): Promise<SelectCrewRole>;
  updateCrewRole(
    id: string,
    orgId: string,
    data: WidenPartial<InsertCrewRole>
  ): Promise<SelectCrewRole>;
  deleteCrewRole(id: string, orgId: string): Promise<void>;
  reorderCrewRoles(orgId: string, orderedIds: string[]): Promise<SelectCrewRole[]>;
  countCrewByRoleName(orgId: string, name: string): Promise<number>;
}

/**
 * Narrow port into the RBAC permissions domain so the crew service can verify a
 * suggested default-access role actually exists in the org WITHOUT importing the
 * permissions domain directly (hexagonal boundary; wired in
 * server/composition/). The crew-role and RBAC-role systems stay separate — this
 * only confirms a referenced role id is real before we persist it.
 */
export interface PermissionRolesPort {
  roleExists(orgId: string, roleId: string): Promise<boolean>;
}

export interface CrewServiceDependencies {
  crewMemberRepository: ICrewMemberRepository;
  eventPublisher: ICrewEventPublisher;
  crewStorage: CrewStoragePort;
  crewExtensionsStorage: CrewExtensionsStoragePort;
  permissionRoles: PermissionRolesPort;
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
        orgId?: string
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

  async updateCertification(
    id: string,
    data: Record<string, unknown>,
    userId?: string,
    orgId?: string
  ) {
    return this.deps.crewExtensionsStorage.updateCrewCertification(
      id,
      data,
      orgId || (typeof data["orgId"] === "string" ? data["orgId"] : "")
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
    return this.deps.crewExtensionsStorage.getCertificationsExpiring(
      orgId,
      daysAhead,
      includeAcknowledged
    );
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

  async updateCrewDocument(
    id: string,
    data: Record<string, unknown>,
    userId?: string,
    orgId?: string
  ) {
    return this.deps.crewExtensionsStorage.updateCrewDocument(
      id,
      data,
      orgId || (typeof data["orgId"] === "string" ? data["orgId"] : "")
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
    return this.deps.crewExtensionsStorage.getDocumentsExpiring(
      orgId,
      daysAhead,
      includeAcknowledged
    );
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

  async upsertCrewNotificationSettings(
    crewId: string,
    orgId: string,
    data: Record<string, unknown>
  ) {
    return this.deps.crewExtensionsStorage.upsertCrewNotificationSettings(crewId, orgId, data);
  }

  async getAllCrewNotificationSettings(orgId: string) {
    return this.deps.crewExtensionsStorage.getAllCrewNotificationSettings(orgId);
  }

  // Crew alerts (manager-raised, ad-hoc) - delegated via port
  async listCrewAlerts(crewId: string, orgId: string) {
    return this.deps.crewExtensionsStorage.getCrewAlerts(crewId, orgId);
  }

  async createCrewAlert(data: InsertCrewAlert) {
    return this.deps.crewExtensionsStorage.createCrewAlert(data);
  }

  async acknowledgeCrewAlert(alertId: string, orgId: string, userId?: string, notes?: string) {
    return this.deps.crewExtensionsStorage.acknowledgeCrewAlert(alertId, orgId, userId, notes);
  }

  async deleteCrewAlert(alertId: string, orgId: string) {
    return this.deps.crewExtensionsStorage.deleteCrewAlert(alertId, orgId);
  }

  // ---- Crew Roles (manageable positions backing crew.rank) ------------------
  async listCrewRoles(orgId: string): Promise<SelectCrewRole[]> {
    return this.deps.crewExtensionsStorage.getCrewRoles(orgId);
  }

  /**
   * Validate the optional suggested default-access role: if a non-null
   * defaultRoleId is set, it must reference a real RBAC role in this org.
   * Fails explicitly rather than silently dropping a bad reference.
   */
  private async assertDefaultRoleValid(
    orgId: string,
    defaultRoleId: string | null | undefined
  ): Promise<void> {
    if (typeof defaultRoleId !== "string" || defaultRoleId.length === 0) {
      return;
    }
    const exists = await this.deps.permissionRoles.roleExists(orgId, defaultRoleId);
    if (!exists) {
      throw new Error(`Suggested access role ${defaultRoleId} does not exist in this organization`);
    }
  }

  async createCrewRole(data: InsertCrewRole): Promise<SelectCrewRole> {
    await this.assertDefaultRoleValid(data.orgId, data.defaultRoleId);
    // New roles append to the bottom (lowest position). Seeding defaults first
    // (via getCrewRoles) keeps the ordering relative to the seeded list.
    const existing = await this.deps.crewExtensionsStorage.getCrewRoles(data.orgId);
    const maxOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), 0);
    return this.deps.crewExtensionsStorage.createCrewRole({ ...data, sortOrder: maxOrder + 10 });
  }

  async updateCrewRole(
    id: string,
    orgId: string,
    data: WidenPartial<InsertCrewRole>
  ): Promise<SelectCrewRole> {
    await this.assertDefaultRoleValid(orgId, data.defaultRoleId);
    return this.deps.crewExtensionsStorage.updateCrewRole(id, orgId, data);
  }

  /**
   * Per-crew document compliance against each crew member's role requirements.
   * For every active crew member whose role declares required document types,
   * reports which required types are MISSING (no document on file) and which are
   * EXPIRING (on file but expired or within 30 days). Roles with no requirements
   * are skipped entirely, so crew on those roles never appear here.
   */
  async getRoleDocumentCompliance(
    orgId: string
  ): Promise<{ crewId: string; missing: string[]; expiring: string[] }[]> {
    const roles = await this.deps.crewExtensionsStorage.getCrewRoles(orgId);
    // Crew ranks are stored inconsistently (slug "first_officer", mixed-case
    // "Chief Engineer", lowercase "captain"), so match on a normalized role key
    // — lowercase with spaces collapsed to underscores — exactly as the client
    // RoleLookup does, otherwise a rank never matches its role.
    const normRoleKey = (value: string): string => value.toLowerCase().replace(/\s+/g, "_");
    const requiredByRoleKey = new Map<string, string[]>();
    for (const role of roles) {
      const required = role.requiredDocuments ?? [];
      if (required.length > 0) {
        requiredByRoleKey.set(normRoleKey(role.name), required);
      }
    }
    if (requiredByRoleKey.size === 0) {
      return [];
    }

    const [crew, docs] = await Promise.all([
      this.deps.crewMemberRepository.findAllCrew(orgId),
      this.deps.crewExtensionsStorage.getCrewDocumentTypesByOrg(orgId),
    ]);

    // crewId -> documentType -> "best" (latest / non-expiring) expiry on file.
    const heldByCrew = new Map<string, Map<string, Date | null>>();
    for (const doc of docs) {
      let held = heldByCrew.get(doc.crewId);
      if (!held) {
        held = new Map<string, Date | null>();
        heldByCrew.set(doc.crewId, held);
      }
      const incoming = doc.expiresAt ?? null;
      if (!held.has(doc.documentType)) {
        held.set(doc.documentType, incoming);
      } else {
        const current = held.get(doc.documentType) ?? null;
        // A null expiry means "never expires" — always best. Otherwise keep the
        // furthest-out expiry so a renewed document supersedes an old one.
        if (current !== null && (incoming === null || incoming.getTime() > current.getTime())) {
          held.set(doc.documentType, incoming);
        }
      }
    }

    const soonMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const result: { crewId: string; missing: string[]; expiring: string[] }[] = [];
    for (const member of crew) {
      if (!member.active) {
        continue;
      }
      const required = member.rank ? requiredByRoleKey.get(normRoleKey(member.rank)) : undefined;
      if (!required) {
        continue;
      }
      const held = heldByCrew.get(member.id);
      const missing: string[] = [];
      const expiring: string[] = [];
      for (const type of required) {
        if (!held || !held.has(type)) {
          missing.push(type);
          continue;
        }
        const expiry = held.get(type) ?? null;
        if (expiry !== null && expiry.getTime() - now <= soonMs) {
          expiring.push(type);
        }
      }
      if (missing.length > 0 || expiring.length > 0) {
        result.push({ crewId: member.id, missing, expiring });
      }
    }
    return result;
  }

  async reorderCrewRoles(orgId: string, orderedIds: string[]): Promise<SelectCrewRole[]> {
    return this.deps.crewExtensionsStorage.reorderCrewRoles(orgId, orderedIds);
  }

  /**
   * Usage of a role = number of crew whose `rank` matches the role name. Used to
   * block deletion of an in-use role so no crew member is left uncategorized.
   */
  async getCrewRoleUsage(
    id: string,
    orgId: string
  ): Promise<{ role: SelectCrewRole | undefined; assignedCount: number }> {
    const role = await this.deps.crewExtensionsStorage.getCrewRoleById(id, orgId);
    if (!role) {
      return { role: undefined, assignedCount: 0 };
    }
    const assignedCount = await this.deps.crewExtensionsStorage.countCrewByRoleName(
      orgId,
      role.name
    );
    return { role, assignedCount };
  }

  async deleteCrewRole(id: string, orgId: string): Promise<void> {
    const { role, assignedCount } = await this.getCrewRoleUsage(id, orgId);
    if (!role) {
      throw new Error(`Crew role ${id} not found`);
    }
    if (assignedCount > 0) {
      throw new Error(
        `Cannot delete crew role "${role.name}" while ${assignedCount} crew member(s) are assigned to it`
      );
    }
    return this.deps.crewExtensionsStorage.deleteCrewRole(id, orgId);
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
      orgId || (typeof data["orgId"] === "string" ? data["orgId"] : "")
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

  async updateAssignment(
    id: string,
    data: Record<string, unknown>,
    orgId: string,
    userId?: string
  ) {
    return this.deps.crewStorage.updateCrewAssignment(id, data, orgId);
  }

  async deleteAssignment(id: string, userId?: string, orgId?: string) {
    return this.deps.crewStorage.deleteCrewAssignment(id, orgId || "");
  }
}
