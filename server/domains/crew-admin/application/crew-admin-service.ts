/**
 * Crew Admin Application Service
 *
 * Roles + per-role dashboard configs, user vessel/department assignments,
 * and login credential admin. Enforces admin-lockout protection and
 * protected-role rules.
 */

import bcrypt from "bcryptjs";
import type { ICrewAdminRepository } from "../domain/ports";
import type {
  RoleSummary,
  CreateRoleCommand,
  UpdateRoleCommand,
  VesselAssignmentEntity,
  AssignmentInput,
  CrewUserSummary,
  RoleDashboardConfigView,
  SetCredentialsCommand,
} from "../domain/types";
import {
  ADMIN_CAPABLE_ROLE_KEYS,
  PROTECTED_ROLE_KEYS,
  defaultConfigForRole,
  roleDashboardConfigSchema,
  type RoleDashboardConfig,
} from "@shared/role-dashboard";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export class CrewAdminError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CrewAdminError";
  }
}

function isProtectedRoleName(name: string): boolean {
  return (PROTECTED_ROLE_KEYS as readonly string[]).includes(name);
}

function isAdminCapableRole(name: string): boolean {
  return (ADMIN_CAPABLE_ROLE_KEYS as readonly string[]).includes(name);
}

export class CrewAdminApplicationService {
  constructor(private readonly repo: ICrewAdminRepository) {}

  /* ----------------------------- Roles ----------------------------- */

  async listRoles(orgId: string): Promise<RoleSummary[]> {
    return this.repo.listRoles(orgId);
  }

  async createRole(command: CreateRoleCommand): Promise<RoleSummary> {
    const name = command.name.trim().toLowerCase();
    if (isProtectedRoleName(name)) {
      throw new CrewAdminError("That role name is reserved", "RESERVED_ROLE");
    }
    const existing = await this.repo.findRoleByName(command.orgId, name);
    if (existing) {
      throw new CrewAdminError("A role with that name already exists", "DUPLICATE_ROLE");
    }
    return this.repo.createRole({ ...command, name });
  }

  async updateRole(orgId: string, id: string, patch: UpdateRoleCommand): Promise<RoleSummary> {
    const role = await this.repo.findRoleById(orgId, id);
    if (!role) {
      throw new CrewAdminError("Role not found", "NOT_FOUND");
    }
    const updated = await this.repo.updateRole(orgId, id, patch);
    if (!updated) {
      throw new CrewAdminError("Role not found", "NOT_FOUND");
    }
    return updated;
  }

  async deleteRole(orgId: string, id: string): Promise<void> {
    const role = await this.repo.findRoleById(orgId, id);
    if (!role) {
      throw new CrewAdminError("Role not found", "NOT_FOUND");
    }
    if (role.isProtected || isProtectedRoleName(role.name)) {
      throw new CrewAdminError("Protected roles cannot be deleted", "PROTECTED_ROLE");
    }
    if (role.assignedUserCount > 0) {
      throw new CrewAdminError(
        "Reassign the users on this role before deleting it",
        "ROLE_IN_USE",
      );
    }
    await this.repo.deleteConfig(orgId, id);
    await this.repo.deleteRole(orgId, id);
  }

  /* ----------------------- Dashboard configs ----------------------- */

  async listDashboardConfigs(orgId: string): Promise<RoleDashboardConfigView[]> {
    const roles = await this.repo.listRoles(orgId);
    const stored = await this.repo.listStoredConfigs(orgId);
    return roles.map((role) => {
      const override = stored.get(role.id);
      return {
        roleId: role.id,
        roleName: role.name,
        roleDisplayName: role.displayName,
        config: override ?? defaultConfigForRole(role.name),
        isCustomized: override !== undefined,
      };
    });
  }

  async getDashboardConfig(orgId: string, roleId: string): Promise<RoleDashboardConfigView> {
    const role = await this.repo.findRoleById(orgId, roleId);
    if (!role) {
      throw new CrewAdminError("Role not found", "NOT_FOUND");
    }
    const override = await this.repo.getStoredConfig(orgId, roleId);
    return {
      roleId: role.id,
      roleName: role.name,
      roleDisplayName: role.displayName,
      config: override ?? defaultConfigForRole(role.name),
      isCustomized: override !== undefined,
    };
  }

  async saveDashboardConfig(
    orgId: string,
    roleId: string,
    rawConfig: unknown,
    updatedBy: string | undefined,
  ): Promise<RoleDashboardConfig> {
    const role = await this.repo.findRoleById(orgId, roleId);
    if (!role) {
      throw new CrewAdminError("Role not found", "NOT_FOUND");
    }
    const parsed = roleDashboardConfigSchema.safeParse(rawConfig);
    if (!parsed.success) {
      throw new CrewAdminError("Invalid dashboard configuration", "INVALID_CONFIG");
    }
    await this.repo.upsertConfig(orgId, roleId, parsed.data, updatedBy);
    return parsed.data;
  }

  /** Resolve the effective dashboard config for a user's role NAME. */
  async resolveConfigByRoleName(orgId: string, roleName: string): Promise<RoleDashboardConfig> {
    const role = await this.repo.findRoleByName(orgId, roleName);
    if (role) {
      const override = await this.repo.getStoredConfig(orgId, role.id);
      if (override) {
        return override;
      }
    }
    return defaultConfigForRole(roleName);
  }

  async resetDashboardConfig(orgId: string, roleId: string): Promise<RoleDashboardConfig> {
    const role = await this.repo.findRoleById(orgId, roleId);
    if (!role) {
      throw new CrewAdminError("Role not found", "NOT_FOUND");
    }
    await this.repo.deleteConfig(orgId, roleId);
    return defaultConfigForRole(role.name);
  }

  /* ----------------------- Users + assignments --------------------- */

  async listUsers(orgId: string): Promise<CrewUserSummary[]> {
    return this.repo.listUsers(orgId);
  }

  async getAssignments(orgId: string, userId: string): Promise<VesselAssignmentEntity[]> {
    return this.repo.getAssignments(orgId, userId);
  }

  async setAssignments(
    orgId: string,
    userId: string,
    assignments: AssignmentInput[],
    assignedBy: string | undefined,
  ): Promise<VesselAssignmentEntity[]> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    return this.repo.replaceAssignments(orgId, userId, assignments, assignedBy);
  }

  async changeRole(orgId: string, userId: string, newRole: string): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    // Lockout guard: moving the last admin-capable login off an admin role.
    if (isAdminCapableRole(user.role) && !isAdminCapableRole(newRole)) {
      await this.assertNotLastAdmin(orgId, userId);
    }
    await this.repo.setRole(orgId, userId, newRole);
  }

  /* ----------------------------- Credentials ----------------------- */

  async setLoginEnabled(orgId: string, userId: string, enabled: boolean): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    if (!enabled && isAdminCapableRole(user.role)) {
      await this.assertNotLastAdmin(orgId, userId);
    }
    await this.repo.setLoginEnabled(orgId, userId, enabled);
    if (!enabled) {
      await this.repo.invalidateUserSessions(userId);
    }
  }

  async setCredentials(command: SetCredentialsCommand): Promise<void> {
    const user = await this.repo.findUser(command.orgId, command.userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    const patch: { username?: string; passwordHash?: string; loginEnabled?: boolean } = {};
    if (command.username !== undefined) {
      const username = command.username.trim();
      if (username.length < 3) {
        throw new CrewAdminError("Username must be at least 3 characters", "INVALID_USERNAME");
      }
      patch.username = username;
    }
    if (command.password !== undefined) {
      this.assertPasswordPolicy(command.password);
      patch.passwordHash = await bcrypt.hash(command.password, BCRYPT_COST);
    }
    if (command.loginEnabled !== undefined) {
      if (command.loginEnabled === false && isAdminCapableRole(user.role)) {
        await this.assertNotLastAdmin(command.orgId, command.userId);
      }
      patch.loginEnabled = command.loginEnabled;
    }
    await this.repo.setCredentials(command.orgId, command.userId, patch);
    if (command.loginEnabled === false) {
      await this.repo.invalidateUserSessions(command.userId);
    }
    if (command.password !== undefined) {
      // Admin-set password forces a change on next login and drops sessions.
      await this.repo.setMustChangePassword(command.orgId, command.userId, true);
      await this.repo.invalidateUserSessions(command.userId);
    }
  }

  async resetPassword(orgId: string, userId: string, newPassword: string): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    this.assertPasswordPolicy(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.repo.setCredentials(orgId, userId, { passwordHash });
    await this.repo.setMustChangePassword(orgId, userId, true);
    await this.repo.invalidateUserSessions(userId);
  }

  /* ------------------------------ Helpers -------------------------- */

  private async assertNotLastAdmin(orgId: string, excludeUserId: string): Promise<void> {
    const remaining = await this.repo.countActiveAdminLogins(orgId, excludeUserId);
    if (remaining <= 0) {
      throw new CrewAdminError(
        "This is the last administrator that can sign in — keep at least one active admin login",
        "ADMIN_LOCKOUT",
      );
    }
  }

  private assertPasswordPolicy(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new CrewAdminError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        "PASSWORD_TOO_SHORT",
      );
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw new CrewAdminError(
        `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
        "PASSWORD_TOO_LONG",
      );
    }
    if (/[\r\n\0]/.test(password)) {
      throw new CrewAdminError("Password contains invalid characters", "INVALID_CHARACTERS");
    }
  }
}
