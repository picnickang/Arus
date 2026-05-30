/**
 * Crew Admin Domain - Domain Types
 *
 * Covers the admin "Crew Management" surface: roles + per-role dashboard
 * configs, user vessel/department assignments, and login credential admin.
 */

import type { RoleDashboardConfig } from "@shared/role-dashboard";

export interface RoleSummary {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  department: string | null;
  hierarchyLevel: number;
  isSystemRole: boolean;
  isProtected: boolean;
  isActive: boolean;
  assignedUserCount: number;
}

export interface CreateRoleCommand {
  orgId: string;
  name: string;
  displayName: string;
  description?: string | undefined;
  department?: string | undefined;
  hierarchyLevel?: number | undefined;
}

export interface UpdateRoleCommand {
  displayName?: string | undefined;
  description?: string | undefined;
  department?: string | undefined;
  hierarchyLevel?: number | undefined;
  isActive?: boolean | undefined;
}

export interface VesselAssignmentEntity {
  id: string;
  orgId: string;
  userId: string;
  vesselId: string | null;
  department: string | null;
  isActive: boolean;
  assignedBy: string | null;
}

export interface AssignmentInput {
  vesselId?: string | null | undefined;
  department?: string | null | undefined;
}

export interface CrewUserSummary {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  loginEnabled: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  lastLoginAt: Date | null;
  /** When the password was last set/changed (credential metadata). */
  passwordUpdatedAt: Date | null;
  /** App user id of this user's supervisor, or null when unassigned. */
  supervisorUserId: string | null;
  assignments: VesselAssignmentEntity[];
  /** Active secondary roles (additive) beyond the primary `role`. */
  assignedRoleNames: string[];
  /** Crew member this login is linked to, or null when it stands alone. */
  linkedCrewId: string | null;
  linkedCrewName: string | null;
}

/** Minimal crew member shape needed by the crew↔login linkage flows. */
export interface CrewMemberRef {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
}

export interface CreateCrewAccountCommand {
  orgId: string;
  crewId: string;
  username: string;
  password: string;
  role?: string | undefined;
  name?: string | undefined;
  email?: string | undefined;
  loginEnabled?: boolean | undefined;
}

export interface RoleDashboardConfigView {
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  config: RoleDashboardConfig;
  isCustomized: boolean;
}

export interface SetCredentialsCommand {
  orgId: string;
  userId: string;
  username?: string | undefined;
  password?: string | undefined;
  loginEnabled?: boolean | undefined;
}
