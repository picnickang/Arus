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
  FormerCrewAccessRisk,
  OffboardingAccessRevocationResult,
} from "../domain/types";
import {
  isSuperAdminRole,
  isAdminGrantEligibleRole,
  normalizeHubAccess,
  type RoleDashboardConfig,
} from "@shared/role-dashboard";
import {
  createAndLinkAccount as createAndLinkAccountWorkflow,
  getCrewAccount as getCrewAccountForRepo,
  linkExistingAccount as linkExistingAccountForRepo,
  revokeCrewAccessForOffboarding as revokeCrewAccessForOffboardingWorkflow,
  unlinkAccount as unlinkAccountForRepo,
  type CrewAccountWorkflowDeps,
} from "./crew-admin-account-access.js";
import {
  listCrewAccessReadiness as listCrewAccessReadinessForRepo,
  listFormerCrewAccessRisks as listFormerCrewAccessRisksForRepo,
} from "./crew-admin-access-readiness.js";
import {
  getDashboardConfig as getDashboardConfigForRepo,
  getEffectiveRoleNames as getEffectiveRoleNamesForRepo,
  listDashboardConfigs as listDashboardConfigsForRepo,
  resetDashboardConfig as resetDashboardConfigForRepo,
  resolveConfigByRoleName as resolveConfigByRoleNameForRepo,
  resolveEffectiveConfig as resolveEffectiveConfigForRepo,
  resolveEffectiveConfigList as resolveEffectiveConfigListForRepo,
  saveDashboardConfig as saveDashboardConfigForRepo,
} from "./crew-admin-dashboard-configs.js";
import {
  resetPassword as resetPasswordWorkflow,
  setCredentials as setCredentialsWorkflow,
  setLoginEnabled as setLoginEnabledWorkflow,
  type CrewCredentialWorkflowDeps,
} from "./crew-admin-credentials.js";
import { CrewAdminError } from "./crew-admin-errors.js";
import {
  assertPasswordPolicy as assertCrewPasswordPolicy,
  isAdminCapableRole,
  isBuiltinRoleName,
} from "./crew-admin-role-policy.js";
import {
  createRole as createRoleForRepo,
  deleteRole as deleteRoleForRepo,
  listRoles as listRolesForRepo,
  setRoleHubAccess as setRoleHubAccessForRepo,
  updateRole as updateRoleForRepo,
} from "./crew-admin-roles.js";

export { CrewAdminError } from "./crew-admin-errors.js";

const BCRYPT_COST = 12;

/**
 * Optional hook so a composition root can clear the permissions domain's
 * in-memory permission/hub cache after this domain mutates role hub-access or
 * user↔role assignments. Kept as an injected port (not a direct import) so the
 * crew-admin domain never reaches into the permissions domain — preserving the
 * hexagonal boundary enforced by `check:domain-leaks`.
 */
export interface PermissionCacheInvalidatorPort {
  invalidateOrg(orgId: string): void;
  invalidateUser(userId: string, orgId: string): void;
}

export class CrewAdminApplicationService {
  private permissionCacheInvalidator: PermissionCacheInvalidatorPort | null = null;

  constructor(private readonly repo: ICrewAdminRepository) {}

  /** Wired from `server/composition/` at boot. No-op until set. */
  setPermissionCacheInvalidator(invalidator: PermissionCacheInvalidatorPort): void {
    this.permissionCacheInvalidator = invalidator;
  }

  /* ----------------------------- Roles ----------------------------- */

  async listRoles(orgId: string): Promise<RoleSummary[]> {
    return listRolesForRepo(this.repo, orgId);
  }

  async createRole(command: CreateRoleCommand): Promise<RoleSummary> {
    return createRoleForRepo(this.repo, command);
  }

  async updateRole(orgId: string, id: string, patch: UpdateRoleCommand): Promise<RoleSummary> {
    return updateRoleForRepo(this.repo, orgId, id, patch);
  }

  /**
   * Grant / revoke a ROLE's hub-admin access and set its hub allow-list. Mirrors
   * the per-user `setHubAccess` rules at the role level:
   *
   *   - Super-admin roles always have full hub access and cannot be edited here
   *     (the grant is implicit and non-revocable).
   *   - Only "manager or above" roles may be granted hub-admin access.
   *   - The pair is normalised via `normalizeRoleHubAccess`: a non-admin role
   *     carries no hubs, and an admin role with an empty/full set collapses to
   *     `null` (= all hubs).
   */
  async setRoleHubAccess(
    orgId: string,
    id: string,
    hubAdmin: boolean,
    hubAccess: string[] | null
  ): Promise<{
    role: RoleSummary;
    previousHubState: { hubAdmin: boolean; hubAccess: string[] | null };
  }> {
    return setRoleHubAccessForRepo(
      this.repo,
      orgId,
      id,
      hubAdmin,
      hubAccess,
      (targetOrgId) => this.permissionCacheInvalidator?.invalidateOrg(targetOrgId)
    );
  }

  async deleteRole(orgId: string, id: string): Promise<void> {
    await deleteRoleForRepo(this.repo, orgId, id);
  }

  /* ----------------------- Dashboard configs ----------------------- */

  async listDashboardConfigs(orgId: string): Promise<RoleDashboardConfigView[]> {
    return listDashboardConfigsForRepo(this.repo, orgId);
  }

  async getDashboardConfig(orgId: string, roleId: string): Promise<RoleDashboardConfigView> {
    return getDashboardConfigForRepo(this.repo, orgId, roleId);
  }

  async saveDashboardConfig(
    orgId: string,
    roleId: string,
    rawConfig: unknown,
    updatedBy: string | undefined
  ): Promise<RoleDashboardConfig> {
    return saveDashboardConfigForRepo(this.repo, orgId, roleId, rawConfig, updatedBy);
  }

  /** Resolve the effective dashboard config for a user's role NAME. */
  async resolveConfigByRoleName(orgId: string, roleName: string): Promise<RoleDashboardConfig> {
    return resolveConfigByRoleNameForRepo(this.repo, orgId, roleName);
  }

  async resetDashboardConfig(orgId: string, roleId: string): Promise<RoleDashboardConfig> {
    return resetDashboardConfigForRepo(this.repo, orgId, roleId);
  }

  /* ----------------------- Users + assignments --------------------- */

  async listUsers(orgId: string): Promise<CrewUserSummary[]> {
    return this.repo.listUsers(orgId);
  }

  async listCrewAccessReadiness(orgId: string): Promise<CrewAccessReadiness[]> {
    return listCrewAccessReadinessForRepo(this.repo, orgId);
  }

  async listFormerCrewAccessRisks(orgId: string): Promise<FormerCrewAccessRisk[]> {
    return listFormerCrewAccessRisksForRepo(this.repo, orgId);
  }

  async getAssignments(orgId: string, userId: string): Promise<VesselAssignmentEntity[]> {
    return this.repo.getAssignments(orgId, userId);
  }

  async setAssignments(
    orgId: string,
    userId: string,
    assignments: AssignmentInput[],
    assignedBy: string | undefined
  ): Promise<VesselAssignmentEntity[]> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    await this.assertAssignableVessels(
      orgId,
      assignments
        .map((assignment) => assignment.vesselId)
        .filter((vesselId): vesselId is string => typeof vesselId === "string")
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
    assignedBy: string | undefined
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
    // Role membership changes this user's effective permissions immediately.
    this.permissionCacheInvalidator?.invalidateUser(userId, orgId);
  }

  /**
   * Effective role names for a user = primary `users.role` plus any active
   * secondary assignments (deduped). Drives the merged dashboard config.
   */
  async getEffectiveRoleNames(
    orgId: string,
    userId: string,
    baseRoleName: string
  ): Promise<string[]> {
    return getEffectiveRoleNamesForRepo(this.repo, orgId, userId, baseRoleName);
  }

  /**
   * Per-role dashboard configs for all of a user's effective roles (NOT merged).
   * Used for capability-scoped data access so a broad role's scope never bleeds
   * into a capability granted only by a narrower role.
   */
  async resolveEffectiveConfigList(
    orgId: string,
    userId: string,
    baseRoleName: string
  ): Promise<RoleDashboardConfig[]> {
    return resolveEffectiveConfigListForRepo(this.repo, orgId, userId, baseRoleName);
  }

  /** Merged (additive) dashboard config across all of a user's effective roles. */
  async resolveEffectiveConfig(
    orgId: string,
    userId: string,
    baseRoleName: string
  ): Promise<RoleDashboardConfig> {
    return resolveEffectiveConfigForRepo(this.repo, orgId, userId, baseRoleName);
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
    this.permissionCacheInvalidator?.invalidateUser(userId, orgId);
  }

  /** Assign (or clear, with null) the user's supervisor. */
  async setSupervisor(
    orgId: string,
    userId: string,
    supervisorUserId: string | null
  ): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    if (supervisorUserId !== null) {
      if (supervisorUserId === userId) {
        throw new CrewAdminError("A user cannot be their own supervisor", "INVALID_SUPERVISOR");
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
    hubAccess: string[] | null
  ): Promise<void> {
    const user = await this.repo.findUser(orgId, userId);
    if (!user) {
      throw new CrewAdminError("User not found", "NOT_FOUND");
    }
    if (isSuperAdminRole(user.role)) {
      throw new CrewAdminError(
        "System administrators always have full hub access",
        "ADMIN_ROLE_PROTECTED"
      );
    }
    if (hubAdmin && !isAdminGrantEligibleRole(user.role)) {
      throw new CrewAdminError(
        "Only manager-or-above roles can be granted hub access",
        "ROLE_NOT_ELIGIBLE"
      );
    }
    const normalizedAccess = hubAdmin ? normalizeHubAccess(hubAccess) : null;
    await this.repo.setHubAccessGrant(orgId, userId, hubAdmin, normalizedAccess);
    this.permissionCacheInvalidator?.invalidateUser(userId, orgId);
  }

  /* ----------------------------- Credentials ----------------------- */

  async setLoginEnabled(orgId: string, userId: string, enabled: boolean): Promise<void> {
    await setLoginEnabledWorkflow(this.credentialWorkflowDeps(), orgId, userId, enabled);
  }

  async setCredentials(command: SetCredentialsCommand): Promise<void> {
    await setCredentialsWorkflow(this.credentialWorkflowDeps(), command);
  }

  async resetPassword(orgId: string, userId: string, newPassword: string): Promise<void> {
    await resetPasswordWorkflow(this.credentialWorkflowDeps(), orgId, userId, newPassword);
  }

  /* ----------------------- Crew ↔ login link ----------------------- */

  /** The login account linked to a crew member, or null when none. */
  async getCrewAccount(orgId: string, crewId: string): Promise<CrewUserSummary | null> {
    return getCrewAccountForRepo(this.repo, orgId, crewId);
  }

  /** Create a brand-new login and link it to a crew member in one step. */
  async createAndLinkAccount(command: CreateCrewAccountCommand): Promise<CrewUserSummary> {
    return createAndLinkAccountWorkflow(this.accountWorkflowDeps(), command);
  }

  /** Link an existing standalone login to a crew member. */
  async linkExistingAccount(orgId: string, crewId: string, userId: string): Promise<void> {
    await linkExistingAccountForRepo(this.repo, orgId, crewId, userId);
  }

  /** Detach a login from a crew member (the login itself is preserved). */
  async unlinkAccount(orgId: string, crewId: string): Promise<void> {
    await unlinkAccountForRepo(this.repo, orgId, crewId);
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
    performedBy: string | undefined
  ): Promise<OffboardingAccessRevocationResult> {
    return revokeCrewAccessForOffboardingWorkflow(
      this.accountWorkflowDeps(),
      orgId,
      crewId,
      options,
      performedBy
    );
  }

  /* ------------------------------ Helpers -------------------------- */

  private accountWorkflowDeps(): CrewAccountWorkflowDeps {
    return {
      repo: this.repo,
      assertAssignableRole: this.assertAssignableRole.bind(this),
      assertAssignableVessel: this.assertAssignableVessel.bind(this),
      assertPasswordPolicy: this.assertPasswordPolicy.bind(this),
      hashPassword: this.hashPassword.bind(this),
      setLoginEnabled: this.setLoginEnabled.bind(this),
      setAssignments: this.setAssignments.bind(this),
      changeRole: this.changeRole.bind(this),
    };
  }

  private credentialWorkflowDeps(): CrewCredentialWorkflowDeps {
    return {
      repo: this.repo,
      assertNotLastAdmin: this.assertNotLastAdmin.bind(this),
      assertPasswordPolicy: this.assertPasswordPolicy.bind(this),
      hashPassword: this.hashPassword.bind(this),
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

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
    if (isBuiltinRoleName(name)) {
      return;
    }
    const custom = await this.repo.findRoleByName(orgId, name);
    if (custom && custom.isActive) {
      return;
    }
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
        "ADMIN_LOCKOUT"
      );
    }
  }

  private assertPasswordPolicy(password: string): void {
    assertCrewPasswordPolicy(password);
  }
}
