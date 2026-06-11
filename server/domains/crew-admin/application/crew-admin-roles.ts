import {
  isAdminGrantEligibleRole,
  isSuperAdminRole,
  normalizeRoleHubAccess,
} from "@shared/role-dashboard";
import type { ICrewAdminRepository } from "../domain/ports";
import type { CreateRoleCommand, RoleSummary, UpdateRoleCommand } from "../domain/types";
import { CrewAdminError } from "./crew-admin-errors.js";
import { isAdminCapableRole, isProtectedRoleName } from "./crew-admin-role-policy.js";

export async function listRoles(
  repo: ICrewAdminRepository,
  orgId: string
): Promise<RoleSummary[]> {
  return repo.listRoles(orgId);
}

export async function createRole(
  repo: ICrewAdminRepository,
  command: CreateRoleCommand
): Promise<RoleSummary> {
  const name = command.name.trim().toLowerCase();
  if (isProtectedRoleName(name)) {
    throw new CrewAdminError("That role name is reserved", "RESERVED_ROLE");
  }
  const existing = await repo.findRoleByName(command.orgId, name);
  if (existing) {
    throw new CrewAdminError("A role with that name already exists", "DUPLICATE_ROLE");
  }
  return repo.createRole({ ...command, name });
}

export async function updateRole(
  repo: ICrewAdminRepository,
  orgId: string,
  id: string,
  patch: UpdateRoleCommand
): Promise<RoleSummary> {
  const role = await repo.findRoleById(orgId, id);
  if (!role) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  if (patch.isActive === false && isAdminCapableRole(role.name)) {
    throw new CrewAdminError("Admin-capable roles cannot be deactivated", "ADMIN_ROLE_PROTECTED");
  }
  const updated = await repo.updateRole(orgId, id, patch);
  if (!updated) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  return updated;
}

export async function setRoleHubAccess(
  repo: ICrewAdminRepository,
  orgId: string,
  id: string,
  hubAdmin: boolean,
  hubAccess: string[] | null,
  invalidateOrg: (orgId: string) => void
): Promise<{
  role: RoleSummary;
  previousHubState: { hubAdmin: boolean; hubAccess: string[] | null };
}> {
  const role = await repo.findRoleById(orgId, id);
  if (!role) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  if (isSuperAdminRole(role.name)) {
    throw new CrewAdminError(
      "System administrator roles always have full hub access",
      "ADMIN_ROLE_PROTECTED"
    );
  }
  if (hubAdmin && !isAdminGrantEligibleRole(role.name)) {
    throw new CrewAdminError(
      "Only manager-or-above roles can be granted hub access",
      "ROLE_NOT_ELIGIBLE"
    );
  }
  const previousHubState = {
    hubAdmin: role.hubAdmin,
    hubAccess: role.hubAccess,
  };
  const normalized = normalizeRoleHubAccess(hubAdmin, hubAccess);
  const updated = await repo.setRoleHubAccess(
    orgId,
    id,
    normalized.hubAdmin,
    normalized.hubAccess
  );
  if (!updated) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  invalidateOrg(orgId);
  return { role: updated, previousHubState };
}

export async function deleteRole(
  repo: ICrewAdminRepository,
  orgId: string,
  id: string
): Promise<void> {
  const role = await repo.findRoleById(orgId, id);
  if (!role) {
    throw new CrewAdminError("Role not found", "NOT_FOUND");
  }
  if (role.isProtected || isProtectedRoleName(role.name) || isAdminCapableRole(role.name)) {
    throw new CrewAdminError("Protected roles cannot be deleted", "PROTECTED_ROLE");
  }
  if (role.assignedUserCount > 0) {
    throw new CrewAdminError("Reassign the users on this role before deleting it", "ROLE_IN_USE");
  }
  await repo.deleteConfig(orgId, id);
  await repo.deleteRole(orgId, id);
}
