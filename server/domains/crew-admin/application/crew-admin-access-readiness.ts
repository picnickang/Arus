import {
  defaultConfigForRole,
  isAdminGrantEligibleRole,
  isSuperAdminRole,
  mergeDashboardConfigs,
  type RoleDashboardConfig,
} from "@shared/role-dashboard";
import type { ICrewAdminRepository } from "../domain/ports";
import type {
  CrewAccessReadiness,
  CrewAccessReadinessStatus,
  CrewUserSummary,
  FormerCrewAccessRisk,
  RoleSummary,
} from "../domain/types";
import { humanizeRoleName } from "./crew-admin-role-policy.js";

export async function listCrewAccessReadiness(
  repo: ICrewAdminRepository,
  orgId: string
): Promise<CrewAccessReadiness[]> {
  const [crewMembers, users, roles, storedConfigs] = await Promise.all([
    repo.listCrewMembers(orgId),
    repo.listUsers(orgId),
    repo.listRoles(orgId),
    repo.listStoredConfigs(orgId),
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
    configByRoleName.set(role.name, storedConfigs.get(role.id) ?? defaultConfigForRole(role.name));
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
          (roleName) => configByRoleName.get(roleName) ?? defaultConfigForRole(roleName)
        )
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
            : "Temporary password issued; user must change it on first login."
        );
      } else if (effectiveConfig.widgets.length === 0 && effectiveConfig.taskSources.length === 0) {
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

export async function listFormerCrewAccessRisks(
  repo: ICrewAdminRepository,
  orgId: string
): Promise<FormerCrewAccessRisk[]> {
  const [crewMembers, users] = await Promise.all([
    repo.listCrewMembers(orgId),
    repo.listUsers(orgId),
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
      if (user.isActive && user.loginEnabled) {
        reasons.push("Linked login is still enabled.");
      }
      if (activeAssignments.length > 0) {
        reasons.push("Vessel or fleet scope remains assigned.");
      }
      if (user.hubAdmin) {
        reasons.push("Admin-hub access remains granted.");
      }
      if (user.assignedRoleNames.length > 0) {
        reasons.push("Additional roles remain assigned.");
      }
      if (hasHighRiskRole) {
        reasons.push("High-risk role remains assigned.");
      }
      if (reasons.length === 0) {
        reasons.push("No active access risk detected.");
      }

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
