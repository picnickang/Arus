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
  CreateCrewAccountCommand,
  CrewAccessReadiness,
  CrewAccessReadinessStatus,
  FormerCrewAccessRisk,
  OffboardingAccessRevocationResult,
} from "../domain/types";
import {
  ADMIN_CAPABLE_ROLE_KEYS,
  PROTECTED_ROLE_KEYS,
  defaultConfigForRole,
  mergeDashboardConfigs,
  roleDashboardConfigSchema,
  sanitizeTaskSources,
  isSuperAdminRole,
  isAdminGrantEligibleRole,
  normalizeHubAccess,
  type RoleDashboardConfig,
} from "@shared/role-dashboard";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const OFFBOARDING_SAFE_ROLE = "viewer";
type OffboardingRevocationStepState = OffboardingAccessRevocationResult["loginDisabled"];

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

/** Built-in primary-role names from the users.role enum (shared/schema/core.ts). */
const BASE_ROLE_NAMES = ["admin", "manager", "technician", "viewer"] as const;

function isBuiltinRoleName(name: string): boolean {
  return (
    isProtectedRoleName(name) ||
    isAdminCapableRole(name) ||
    (BASE_ROLE_NAMES as readonly string[]).includes(name)
  );
}

function humanizeRoleName(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    // Deactivating an admin-capable role could strip the last admin pathway —
    // never let that happen via the role-lifecycle surface.
    if (patch.isActive === false && isAdminCapableRole(role.name)) {
      throw new CrewAdminError(
        "Admin-capable roles cannot be deactivated",
        "ADMIN_ROLE_PROTECTED",
      );
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
    if (role.isProtected || isProtectedRoleName(role.name) || isAdminCapableRole(role.name)) {
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
        // Stored configs may predate the implemented-source set; strip any
        // source whose adapter no longer exists so the feed never no-ops.
        return { ...override, taskSources: sanitizeTaskSources(override.taskSources) };
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

  async listCrewAccessReadiness(orgId: string): Promise<CrewAccessReadiness[]> {
    const [crewMembers, users, roles, storedConfigs] = await Promise.all([
      this.repo.listCrewMembers(orgId),
      this.repo.listUsers(orgId),
      this.repo.listRoles(orgId),
      this.repo.listStoredConfigs(orgId),
    ]);

    const usersById = new Map<string, CrewUserSummary>();
    for (const user of users) {
      usersById.set(user.id, user);
    }

    const rolesByName = new Map<string, RoleSummary>();
    for (const role of roles) {
      rolesByName.set(role.name, role);
    }

    const configByRoleName = new Map<string, RoleDashboardConfig>();
    for (const role of roles) {
      configByRoleName.set(
        role.name,
        storedConfigs.get(role.id) ?? defaultConfigForRole(role.name),
      );
    }

    return crewMembers
      .filter((member) => member.active)
      .map((member): CrewAccessReadiness => {
        if (!member.userId) {
          return {
            crewId: member.id,
            crewName: member.name,
            userId: null,
            status: "no_login",
            reasons: ["No login account is linked to this crew member."],
            role: null,
            roleDisplayName: null,
            additionalRoles: [],
            loginEnabled: false,
            mustChangePassword: false,
            hasPassword: false,
            vesselScope: "none",
            dashboardWidgetCount: 0,
            dashboardTaskSourceCount: 0,
            lastLoginAt: null,
          };
        }

        const user = usersById.get(member.userId);
        if (!user) {
          return {
            crewId: member.id,
            crewName: member.name,
            userId: member.userId,
            status: "no_login",
            reasons: ["The linked login account could not be loaded for this organization."],
            role: null,
            roleDisplayName: null,
            additionalRoles: [],
            loginEnabled: false,
            mustChangePassword: false,
            hasPassword: false,
            vesselScope: "none",
            dashboardWidgetCount: 0,
            dashboardTaskSourceCount: 0,
            lastLoginAt: null,
          };
        }

        const effectiveRoleNames = [...new Set([user.role, ...user.assignedRoleNames])];
        const effectiveConfig = mergeDashboardConfigs(
          effectiveRoleNames.map(
            (roleName) => configByRoleName.get(roleName) ?? defaultConfigForRole(roleName),
          ),
        );
        const activeAssignments = user.assignments.filter((assignment) => assignment.isActive);
        const hasFleetScope =
          effectiveConfig.visibilityScope === "fleet" ||
          activeAssignments.some((assignment) => assignment.vesselId === null);
        const vesselScope: CrewAccessReadiness["vesselScope"] = hasFleetScope
          ? "fleet"
          : activeAssignments.length > 0
            ? "assigned"
            : "none";

        const reasons: string[] = [];
        let status: CrewAccessReadinessStatus = "ready";

        if (!user.isActive || !user.loginEnabled) {
          status = "login_disabled";
          reasons.push(user.isActive ? "Login is disabled." : "User account is inactive.");
        } else if (!user.hasPassword) {
          status = "no_password_set";
          reasons.push("No password has been set for this login.");
        } else if (user.mustChangePassword) {
          status = user.lastLoginAt ? "password_change_required" : "temporary_password_issued";
          reasons.push(
            user.lastLoginAt
              ? "User must change their password before continuing."
              : "Temporary password issued; user must change it on first login.",
          );
        } else if (
          effectiveConfig.widgets.length === 0 &&
          effectiveConfig.taskSources.length === 0
        ) {
          status = "no_dashboard";
          reasons.push("The effective dashboard has no widgets or task sources.");
        } else if (vesselScope === "none") {
          status = "no_vessel_scope";
          reasons.push("No active vessel or fleet assignment is configured.");
        } else if (
          vesselScope === "fleet" &&
          effectiveConfig.visibilityScope !== "fleet" &&
          activeAssignments.some((assignment) => assignment.vesselId === null)
        ) {
          status = "fleet_scope_review";
          reasons.push("Fleet-wide vessel access is configured; review that this scope is intended.");
        }

        if (reasons.length === 0) {
          reasons.push("Login, role, dashboard, and vessel scope are ready.");
        }

        return {
          crewId: member.id,
          crewName: member.name,
          userId: user.id,
          status,
          reasons,
          role: user.role,
          roleDisplayName: rolesByName.get(user.role)?.displayName ?? humanizeRoleName(user.role),
          additionalRoles: user.assignedRoleNames,
          loginEnabled: user.loginEnabled,
          mustChangePassword: user.mustChangePassword,
          hasPassword: user.hasPassword,
          vesselScope,
          dashboardWidgetCount: effectiveConfig.widgets.length,
          dashboardTaskSourceCount: effectiveConfig.taskSources.length,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        };
      });
  }

  async listFormerCrewAccessRisks(orgId: string): Promise<FormerCrewAccessRisk[]> {
    const [crewMembers, users] = await Promise.all([
      this.repo.listCrewMembers(orgId),
      this.repo.listUsers(orgId),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return crewMembers
      .filter((member) => !member.active)
      .map((member): FormerCrewAccessRisk => {
        const user = member.userId ? usersById.get(member.userId) : undefined;
        if (!member.userId || !user) {
          return {
            crewId: member.id,
            crewName: member.name,
            userId: member.userId ?? null,
            hasLinkedLogin: !!member.userId,
            accountActive: false,
            loginEnabled: false,
            vesselAccessCount: 0,
            hasFleetAccess: false,
            hubAdmin: false,
            hubAccess: null,
            role: null,
            additionalRoles: [],
            hasHighRiskRole: false,
            hasAccessRisk: false,
            reasons: member.userId
              ? ["Linked login could not be loaded for this organization."]
              : ["No linked login."],
          };
        }

        const activeAssignments = user.assignments.filter((assignment) => assignment.isActive);
        const hasFleetAccess = activeAssignments.some((assignment) => assignment.vesselId === null);
        const hasHighRiskRole =
          isAdminGrantEligibleRole(user.role) ||
          user.assignedRoleNames.some((roleName) => isAdminGrantEligibleRole(roleName));
        const reasons: string[] = [];
        if (user.isActive && user.loginEnabled) reasons.push("Linked login is still enabled.");
        if (activeAssignments.length > 0) reasons.push("Vessel or fleet scope remains assigned.");
        if (user.hubAdmin) reasons.push("Admin-hub access remains granted.");
        if (user.assignedRoleNames.length > 0) reasons.push("Additional roles remain assigned.");
        if (hasHighRiskRole) reasons.push("High-risk role remains assigned.");
        if (reasons.length === 0) reasons.push("No active access risk detected.");

        return {
          crewId: member.id,
          crewName: member.name,
          userId: user.id,
          hasLinkedLogin: true,
          accountActive: user.isActive,
          loginEnabled: user.isActive && user.loginEnabled,
          vesselAccessCount: activeAssignments.length,
          hasFleetAccess,
          hubAdmin: user.hubAdmin || isSuperAdminRole(user.role),
          hubAccess: user.hubAccess,
          role: user.role,
          additionalRoles: user.assignedRoleNames,
          hasHighRiskRole,
          hasAccessRisk:
            (user.isActive && user.loginEnabled) ||
            activeAssignments.length > 0 ||
            user.hubAdmin ||
            user.assignedRoleNames.length > 0 ||
            hasHighRiskRole,
          reasons,
        };
      });
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
    await this.assertAssignableVessels(
      orgId,
      assignments
        .map((assignment) => assignment.vesselId)
        .filter((vesselId): vesselId is string => typeof vesselId === "string"),
    );
    return this.repo.replaceAssignments(orgId, userId, assignments, assignedBy);
  }

  /** Active secondary role IDs assigned to a user (additive, beyond primary role). */
  async getRoleAssignments(orgId: string, userId: string): Promise<string[]> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    return this.repo.listAssignedRoleIds(orgId, userId);
  }

  /** Replace a user's secondary role assignments (additive roles beyond the primary). */
  async setRoleAssignments(
    orgId: string,
    userId: string,
    roleIds: string[],
    assignedBy: string | undefined,
  ): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    const unique = [...new Set(roleIds)];
    for (const roleId of unique) {
      const role = await this.repo.findRoleById(orgId, roleId);
      if (!role) {
        throw new CrewAdminError("Role not found", "NOT_FOUND");
      }
    }
    await this.repo.replaceRoleAssignments(orgId, userId, unique, assignedBy);
  }

  /**
   * Effective role names for a user = primary `users.role` plus any active
   * secondary assignments (deduped). Drives the merged dashboard config.
   */
  async getEffectiveRoleNames(
    orgId: string,
    userId: string,
    baseRoleName: string,
  ): Promise<string[]> {
    const assigned = await this.repo.listAssignedRoleNames(orgId, userId);
    return [...new Set([baseRoleName, ...assigned])];
  }

  /**
   * Per-role dashboard configs for all of a user's effective roles (NOT merged).
   * Used for capability-scoped data access so a broad role's scope never bleeds
   * into a capability granted only by a narrower role.
   */
  async resolveEffectiveConfigList(
    orgId: string,
    userId: string,
    baseRoleName: string,
  ): Promise<RoleDashboardConfig[]> {
    const names = await this.getEffectiveRoleNames(orgId, userId, baseRoleName);
    return Promise.all(names.map((name) => this.resolveConfigByRoleName(orgId, name)));
  }

  /** Merged (additive) dashboard config across all of a user's effective roles. */
  async resolveEffectiveConfig(
    orgId: string,
    userId: string,
    baseRoleName: string,
  ): Promise<RoleDashboardConfig> {
    const configs = await this.resolveEffectiveConfigList(orgId, userId, baseRoleName);
    return mergeDashboardConfigs(configs);
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

  /** Assign (or clear, with null) the user's supervisor. */
  async setSupervisor(
    orgId: string,
    userId: string,
    supervisorUserId: string | null,
  ): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    if (supervisorUserId !== null) {
      if (supervisorUserId === userId) {
        throw new CrewAdminError(
          "A user cannot be their own supervisor",
          "INVALID_SUPERVISOR",
        );
      }
      const supervisor = await this.repo.findUser(orgId, supervisorUserId);
      if (!supervisor) {
        throw new CrewAdminError("Supervisor not found", "NOT_FOUND");
      }
    }
    await this.repo.setSupervisor(orgId, userId, supervisorUserId);
  }

  /**
   * Grant / revoke a user's hub-admin access and set their hub allow-list.
   *
   *   - Super-admin roles always have full hub access and cannot be edited
   *     here (the grant is implicit and non-revocable).
   *   - Only "manager or above" roles may be granted hub-admin access.
   *   - `hubAccess` is normalised: unknown ids dropped, a full/empty set
   *     collapses to `null` (= all hubs). When revoking, access is cleared.
   */
  async setHubAccess(
    orgId: string,
    userId: string,
    hubAdmin: boolean,
    hubAccess: string[] | null,
  ): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    if (isSuperAdminRole(user.role)) {
      throw new CrewAdminError(
        "System administrators always have full hub access",
        "ADMIN_ROLE_PROTECTED",
      );
    }
    if (hubAdmin && !isAdminGrantEligibleRole(user.role)) {
      throw new CrewAdminError(
        "Only manager-or-above roles can be granted hub access",
        "ROLE_NOT_ELIGIBLE",
      );
    }
    const normalizedAccess = hubAdmin ? normalizeHubAccess(hubAccess) : null;
    await this.repo.setHubAccessGrant(orgId, userId, hubAdmin, normalizedAccess);
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

  /* ----------------------- Crew ↔ login link ----------------------- */

  /** The login account linked to a crew member, or null when none. */
  async getCrewAccount(orgId: string, crewId: string): Promise<CrewUserSummary | null> {
    const member = await this.repo.findCrewMember(orgId, crewId);
    if (!member) {
      throw new CrewAdminError("Crew member not found", "NOT_FOUND");
    }
    if (!member.userId) return null;
    const account = await this.repo.findUser(orgId, member.userId);
    return account ?? null;
  }

  /** Create a brand-new login and link it to a crew member in one step. */
  async createAndLinkAccount(command: CreateCrewAccountCommand): Promise<CrewUserSummary> {
    const member = await this.repo.findCrewMember(command.orgId, command.crewId);
    if (!member) {
      throw new CrewAdminError("Crew member not found", "NOT_FOUND");
    }
    if (member.userId) {
      throw new CrewAdminError(
        "This crew member already has a login account",
        "CREW_ALREADY_LINKED",
      );
    }

    const username = command.username.trim();
    if (username.length < 3) {
      throw new CrewAdminError("Username must be at least 3 characters", "INVALID_USERNAME");
    }
    const existingUsername = await this.repo.findUserByUsername(command.orgId, username);
    if (existingUsername) {
      throw new CrewAdminError("That username is already taken", "DUPLICATE_USERNAME");
    }

    const name = (command.name ?? member.name).trim();
    const email = (command.email ?? member.email ?? "").trim();
    if (!email) {
      throw new CrewAdminError(
        "An email address is required to create a login account",
        "EMAIL_REQUIRED",
      );
    }

    const role = (command.role ?? "viewer").trim();
    await this.assertAssignableRole(command.orgId, role);

    const assignmentVesselId =
      !command.skipVesselAssignment
        ? command.vesselId !== undefined
          ? command.vesselId
          : member.vesselId ?? undefined
        : undefined;
    if (typeof assignmentVesselId === "string") {
      await this.assertAssignableVessel(command.orgId, assignmentVesselId);
    }

    this.assertPasswordPolicy(command.password);
    const passwordHash = await bcrypt.hash(command.password, BCRYPT_COST);

    const userId = await this.repo.createUser({
      orgId: command.orgId,
      name,
      email,
      username,
      passwordHash,
      role,
      loginEnabled: command.loginEnabled ?? true,
      // New accounts always begin with a forced password rotation.
      mustChangePassword: true,
    });
    await this.repo.setCrewUserLink(command.orgId, command.crewId, userId);

    if (assignmentVesselId !== undefined) {
      await this.repo.replaceAssignments(
        command.orgId,
        userId,
        [{ vesselId: assignmentVesselId }],
        command.assignedBy,
      );
    }

    const created = await this.repo.findUser(command.orgId, userId);
    if (!created) {
      throw new CrewAdminError("Account created but could not be loaded", "NOT_FOUND");
    }
    return created;
  }

  /** Link an existing standalone login to a crew member. */
  async linkExistingAccount(orgId: string, crewId: string, userId: string): Promise<void> {
    const member = await this.repo.findCrewMember(orgId, crewId);
    if (!member) {
      throw new CrewAdminError("Crew member not found", "NOT_FOUND");
    }
    if (member.userId) {
      throw new CrewAdminError(
        "This crew member already has a login account",
        "CREW_ALREADY_LINKED",
      );
    }
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    const otherCrew = await this.repo.findCrewByUserId(orgId, userId);
    if (otherCrew) {
      throw new CrewAdminError(
        "That login is already linked to another crew member",
        "USER_ALREADY_LINKED",
      );
    }
    await this.repo.setCrewUserLink(orgId, crewId, userId);
  }

  /** Detach a login from a crew member (the login itself is preserved). */
  async unlinkAccount(orgId: string, crewId: string): Promise<void> {
    const member = await this.repo.findCrewMember(orgId, crewId);
    if (!member) {
      throw new CrewAdminError("Crew member not found", "NOT_FOUND");
    }
    await this.repo.setCrewUserLink(orgId, crewId, null);
  }

  async revokeCrewAccessForOffboarding(
    orgId: string,
    crewId: string,
    options: {
      disableLogin?: boolean | undefined;
      removeVesselAccess?: boolean | undefined;
      removeDashboardAccess?: boolean | undefined;
      removeAdditionalRoles?: boolean | undefined;
      downgradePrimaryRole?: boolean | undefined;
      endDutyStatus?: boolean | undefined;
      preserveRecords?: boolean | undefined;
    },
    performedBy: string | undefined,
  ): Promise<OffboardingAccessRevocationResult> {
    const account = await this.getCrewAccount(orgId, crewId);
    if (!account) {
      return {
        userId: null,
        loginDisabled: "not_applicable",
        vesselAccessRemoved: "not_applicable",
        dashboardAccessRemoved: "not_applicable",
        additionalRolesRemoved: "not_applicable",
        primaryRoleDowngraded: "not_applicable",
        dutyEnded: options.endDutyStatus ?? true ? "yes" : "no",
        recordsPreserved: "yes",
        previousRole: null,
        previousAdditionalRoles: [],
        previousVesselAccessCount: 0,
        previousHubAdmin: false,
        failures: [],
      };
    }

    const result: OffboardingAccessRevocationResult = {
      userId: account.id,
      loginDisabled: options.disableLogin ?? true ? "no" : "skipped",
      vesselAccessRemoved: options.removeVesselAccess ?? true ? "no" : "skipped",
      dashboardAccessRemoved: options.removeDashboardAccess ?? true ? "no" : "skipped",
      additionalRolesRemoved: options.removeAdditionalRoles ?? true ? "no" : "skipped",
      primaryRoleDowngraded: options.downgradePrimaryRole ?? true ? "no" : "skipped",
      dutyEnded: options.endDutyStatus ?? true ? "yes" : "no",
      recordsPreserved: "yes",
      previousRole: account.role,
      previousAdditionalRoles: account.assignedRoleNames,
      previousVesselAccessCount: account.assignments.filter((assignment) => assignment.isActive).length,
      previousHubAdmin: account.hubAdmin || isSuperAdminRole(account.role),
      failures: [],
    };

    const runStep = async (
      label: string,
      assign: (value: OffboardingRevocationStepState) => void,
      action: () => Promise<void>,
    ) => {
      try {
        await action();
        assign("yes");
      } catch (error) {
        assign("failed");
        result.failures.push(
          `${label}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    };

    if (options.disableLogin ?? true) {
      await runStep("Disable login", (value) => (result.loginDisabled = value), () =>
        this.setLoginEnabled(orgId, account.id, false),
      );
    }
    if (options.removeVesselAccess ?? true) {
      if (result.previousVesselAccessCount === 0) {
        result.vesselAccessRemoved = "not_applicable";
      } else {
        await runStep("Remove vessel access", (value) => (result.vesselAccessRemoved = value), () =>
          this.setAssignments(orgId, account.id, [], performedBy).then(() => undefined),
        );
      }
    }
    if (options.removeDashboardAccess ?? true) {
      if (!result.previousHubAdmin) {
        result.dashboardAccessRemoved = "not_applicable";
      } else {
        await runStep(
          "Remove dashboard/admin access",
          (value) => (result.dashboardAccessRemoved = value),
          () => this.repo.setHubAccessGrant(orgId, account.id, false, null),
        );
      }
    }
    if (options.removeAdditionalRoles ?? true) {
      if (account.assignedRoleNames.length === 0) {
        result.additionalRolesRemoved = "not_applicable";
      } else {
        await runStep(
          "Remove additional roles",
          (value) => (result.additionalRolesRemoved = value),
          () => this.repo.replaceRoleAssignments(orgId, account.id, [], performedBy),
        );
      }
    }
    if (options.downgradePrimaryRole ?? true) {
      if (account.role === OFFBOARDING_SAFE_ROLE) {
        result.primaryRoleDowngraded = "not_applicable";
      } else {
        await runStep(
          "Downgrade primary role",
          (value) => (result.primaryRoleDowngraded = value),
          () => this.changeRole(orgId, account.id, OFFBOARDING_SAFE_ROLE),
        );
      }
    }

    return result;
  }

  /* ------------------------------ Helpers -------------------------- */

  /**
   * A role is assignable when it is a built-in role name or an active custom
   * role in this org. Prevents accounts being created with bogus or deactivated
   * role keys, which would produce authorization drift.
   */
  private async assertAssignableRole(orgId: string, role: string): Promise<void> {
    const name = role.trim();
    if (!name) {
      throw new CrewAdminError("A role is required", "INVALID_ROLE");
    }
    if (isBuiltinRoleName(name)) return;
    const custom = await this.repo.findRoleByName(orgId, name);
    if (custom && custom.isActive) return;
    throw new CrewAdminError("That role is not assignable", "INVALID_ROLE");
  }

  private async assertAssignableVessels(orgId: string, vesselIds: string[]): Promise<void> {
    const unique = [...new Set(vesselIds)];
    await Promise.all(unique.map((vesselId) => this.assertAssignableVessel(orgId, vesselId)));
  }

  private async assertAssignableVessel(orgId: string, vesselId: string): Promise<void> {
    const exists = await this.repo.vesselExists(orgId, vesselId);
    if (!exists) {
      throw new CrewAdminError("Vessel not found for this organization", "INVALID_VESSEL");
    }
  }

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
