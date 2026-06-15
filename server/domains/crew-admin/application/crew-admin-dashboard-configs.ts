import {
  defaultConfigForRole,
  mergeDashboardConfigs,
  roleDashboardConfigSchema,
  sanitizeTaskSources,
  type RoleDashboardConfig,
} from "@shared/role-dashboard";
import type { ICrewAdminRepository } from "../domain/ports";
import type { RoleDashboardConfigView } from "../domain/types";
import { CrewAdminError } from "./crew-admin-errors.js";

export async function listDashboardConfigs(
  repo: ICrewAdminRepository,
  orgId: string
): Promise<RoleDashboardConfigView[]> {
  const roles = await repo.listRoles(orgId);
  const stored = await repo.listStoredConfigs(orgId);
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

export async function getDashboardConfig(
  repo: ICrewAdminRepository,
  orgId: string,
  roleId: string
): Promise<RoleDashboardConfigView> {
  const role = await repo.findRoleById(orgId, roleId);
  if (!role) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  const override = await repo.getStoredConfig(orgId, roleId);
  return {
    roleId: role.id,
    roleName: role.name,
    roleDisplayName: role.displayName,
    config: override ?? defaultConfigForRole(role.name),
    isCustomized: override !== undefined,
  };
}

export async function saveDashboardConfig(
  repo: ICrewAdminRepository,
  orgId: string,
  roleId: string,
  rawConfig: unknown,
  updatedBy: string | undefined
): Promise<RoleDashboardConfig> {
  const role = await repo.findRoleById(orgId, roleId);
  if (!role) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  const parsed = roleDashboardConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new CrewAdminError("Invalid dashboard configuration", "INVALID_CONFIG");
  }
  await repo.upsertConfig(orgId, roleId, parsed.data, updatedBy);
  return parsed.data;
}

export async function resolveConfigByRoleName(
  repo: ICrewAdminRepository,
  orgId: string,
  roleName: string
): Promise<RoleDashboardConfig> {
  const role = await repo.findRoleByName(orgId, roleName);
  if (role) {
    const override = await repo.getStoredConfig(orgId, role.id);
    if (override) {
      return { ...override, taskSources: sanitizeTaskSources(override.taskSources) };
    }
  }
  return defaultConfigForRole(roleName);
}

export async function resetDashboardConfig(
  repo: ICrewAdminRepository,
  orgId: string,
  roleId: string
): Promise<RoleDashboardConfig> {
  const role = await repo.findRoleById(orgId, roleId);
  if (!role) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  await repo.deleteConfig(orgId, roleId);
  return defaultConfigForRole(role.name);
}

export async function getEffectiveRoleNames(
  repo: ICrewAdminRepository,
  orgId: string,
  userId: string,
  baseRoleName: string
): Promise<string[]> {
  const assigned = await repo.listAssignedRoleNames(orgId, userId);
  return [...new Set([baseRoleName, ...assigned])];
}

export async function resolveEffectiveConfigList(
  repo: ICrewAdminRepository,
  orgId: string,
  userId: string,
  baseRoleName: string
): Promise<RoleDashboardConfig[]> {
  const names = await getEffectiveRoleNames(repo, orgId, userId, baseRoleName);
  return Promise.all(names.map((name) => resolveConfigByRoleName(repo, orgId, name)));
}

export async function resolveEffectiveConfig(
  repo: ICrewAdminRepository,
  orgId: string,
  userId: string,
  baseRoleName: string
): Promise<RoleDashboardConfig> {
  const configs = await resolveEffectiveConfigList(repo, orgId, userId, baseRoleName);
  return mergeDashboardConfigs(configs);
}
