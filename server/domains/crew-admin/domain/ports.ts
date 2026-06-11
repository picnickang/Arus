/**
 * Crew Admin Domain - Ports (Interfaces)
 */

import type { RoleDashboardConfig } from "@shared/role-dashboard";
import type {
  RoleSummary,
  CreateRoleCommand,
  UpdateRoleCommand,
  VesselAssignmentEntity,
  AssignmentInput,
  CrewUserSummary,
  CrewMemberRef,
  CrewAccessMemberRef,
  RoleDashboardConfigView,
} from "./types";

export interface ICrewAdminRepository {
  // Roles
  listRoles(orgId: string): Promise<RoleSummary[]>;
  findRoleById(orgId: string, id: string): Promise<RoleSummary | undefined>;
  findRoleByName(orgId: string, name: string): Promise<RoleSummary | undefined>;
  createRole(command: CreateRoleCommand): Promise<RoleSummary>;
  updateRole(orgId: string, id: string, patch: UpdateRoleCommand): Promise<RoleSummary | undefined>;
  deleteRole(orgId: string, id: string): Promise<void>;
  /** Persist a role's hub-admin grant + allow-list (null hubAccess = all hubs). */
  setRoleHubAccess(
    orgId: string,
    id: string,
    hubAdmin: boolean,
    hubAccess: string[] | null
  ): Promise<RoleSummary | undefined>;

  // Dashboard configs (raw row, undefined when no override stored)
  getStoredConfig(orgId: string, roleId: string): Promise<RoleDashboardConfig | undefined>;
  listStoredConfigs(orgId: string): Promise<Map<string, RoleDashboardConfig>>;
  upsertConfig(
    orgId: string,
    roleId: string,
    config: RoleDashboardConfig,
    updatedBy: string | undefined
  ): Promise<void>;
  deleteConfig(orgId: string, roleId: string): Promise<void>;

  // Users + assignments
  listUsers(orgId: string): Promise<CrewUserSummary[]>;
  findUser(orgId: string, userId: string): Promise<CrewUserSummary | undefined>;
  vesselExists(orgId: string, vesselId: string): Promise<boolean>;
  getAssignments(orgId: string, userId: string): Promise<VesselAssignmentEntity[]>;
  replaceAssignments(
    orgId: string,
    userId: string,
    assignments: AssignmentInput[],
    assignedBy: string | undefined
  ): Promise<VesselAssignmentEntity[]>;

  // Multi-role assignments (additive secondary roles, stored in user_role_assignments)
  listAssignedRoleIds(orgId: string, userId: string): Promise<string[]>;
  listAssignedRoleNames(orgId: string, userId: string): Promise<string[]>;
  replaceRoleAssignments(
    orgId: string,
    userId: string,
    roleIds: string[],
    assignedBy: string | undefined
  ): Promise<void>;

  // Credentials
  setRole(orgId: string, userId: string, role: string): Promise<void>;
  setSupervisor(orgId: string, userId: string, supervisorUserId: string | null): Promise<void>;
  setLoginEnabled(orgId: string, userId: string, enabled: boolean): Promise<void>;
  setCredentials(
    orgId: string,
    userId: string,
    patch: { username?: string; passwordHash?: string; loginEnabled?: boolean }
  ): Promise<void>;
  setMustChangePassword(orgId: string, userId: string, value: boolean): Promise<void>;
  /** Persist a user's hub-admin grant + allow-list (null hubAccess = all hubs). */
  setHubAccessGrant(
    orgId: string,
    userId: string,
    hubAdmin: boolean,
    hubAccess: string[] | null
  ): Promise<void>;
  invalidateUserSessions(userId: string): Promise<void>;

  /** Count active users that hold an admin-capable role and can still log in. */
  countActiveAdminLogins(orgId: string, excludeUserId?: string): Promise<number>;

  // Crew ↔ login linkage (optional 1:1)
  listCrewMembers(orgId: string): Promise<CrewAccessMemberRef[]>;
  findCrewMember(orgId: string, crewId: string): Promise<CrewMemberRef | undefined>;
  /** The crew member a given login is linked to, or undefined when unlinked. */
  findCrewByUserId(orgId: string, userId: string): Promise<CrewMemberRef | undefined>;
  /** Point a crew member at a login account, or pass null to detach. */
  setCrewUserLink(orgId: string, crewId: string, userId: string | null): Promise<void>;
  findUserByUsername(orgId: string, username: string): Promise<{ id: string } | undefined>;
  /** Insert a new login account, returning its id. */
  createUser(input: {
    orgId: string;
    name: string;
    email: string;
    username: string;
    passwordHash: string;
    role: string;
    loginEnabled: boolean;
    mustChangePassword: boolean;
  }): Promise<string>;
}

export type { RoleDashboardConfigView };
