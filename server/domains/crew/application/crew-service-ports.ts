import type { WidenPartial } from "../../../lib/widen-partial";
import type { ICrewEventPublisher, ICrewMemberRepository } from "../domain";
import type {
  InsertCrewAlert,
  InsertCrewRole,
  SelectCrewAlert,
  SelectCrewCertification,
  SelectCrewDocument,
  SelectCrewRole,
} from "@shared/schema";

export interface CrewNotificationSettingsLike {
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
 * suggested default-access role actually exists in the org WITHOUT importing
 * the permissions domain directly. The crew-role and RBAC-role systems stay
 * separate; this only confirms a referenced role id is real before persisting.
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
