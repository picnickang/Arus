import { and, eq, isNull, or, inArray, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { crew, organizations, users, roles, userRoleAssignments } from "@shared/schema-runtime";
// permissionGrants is not part of the dual-mode runtime tables barrel; import the
// table value from the canonical schema (this file is allowlisted in
// scripts/check-schema-imports.mjs alongside the other permissions data files).
import { permissionGrants } from "@shared/schema/permissions";

/** Active role ids assigned to a user (authorization-service read). */
export async function getActiveUserRoleIds(userId: string, orgId: string): Promise<string[]> {
  const assignments = await db
    .select({ roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .where(
      and(
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.orgId, orgId),
        eq(userRoleAssignments.isActive, true)
      )
    );
  return assignments.map((a) => a.roleId);
}

/** Permission grants for a set of role ids (resource/action codes + condition). */
export async function getPermissionGrantsByRoleIds(roleIds: string[]) {
  return db
    .select({
      resourceCode: permissionGrants.resourceCode,
      actionCode: permissionGrants.actionCode,
      isGranted: permissionGrants.isGranted,
      condition: permissionGrants.condition,
    })
    .from(permissionGrants)
    .where(inArray(permissionGrants.roleId, roleIds));
}

/** A user's primary-role name + hub fields (for effective-hub resolution). */
export async function getUserHubFields(userId: string, orgId: string) {
  const [row] = await db
    .select({ role: users.role, hubAdmin: users.hubAdmin, hubAccess: users.hubAccess })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
    .limit(1);
  return row;
}

/** Hub fields for a user's assigned role ids and/or primary role name. */
export async function getRoleHubFieldsForUser(
  orgId: string,
  assignedRoleIds: string[],
  primaryRoleName: string | null
) {
  const orConditions: SQL[] = [];
  if (assignedRoleIds.length) {
    orConditions.push(inArray(roles.id, assignedRoleIds));
  }
  if (primaryRoleName) {
    orConditions.push(eq(roles.name, primaryRoleName));
  }
  if (!orConditions.length) {
    return [];
  }
  return db
    .select({ name: roles.name, hubAdmin: roles.hubAdmin, hubAccess: roles.hubAccess })
    .from(roles)
    .where(and(eq(roles.orgId, orgId), or(...orConditions)));
}

export async function listUsersWithRoles(orgId: string): Promise<
  Array<{
    id: string;
    name: string | null;
    email: string | null;
    roles: Array<{ roleId: string; roleName: string; assignedAt: string }>;
  }>
> {
  const assignments = await db
    .select({
      userId: userRoleAssignments.userId,
      roleId: userRoleAssignments.roleId,
      roleName: roles.displayName,
    })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(and(eq(userRoleAssignments.orgId, orgId), eq(userRoleAssignments.isActive, true)));

  const systemUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.orgId, orgId));

  const crewMembers = await db
    .select({
      id: crew.id,
      name: crew.name,
      email: crew.email,
    })
    .from(crew)
    .where(eq(crew.orgId, orgId));

  const userMap = new Map<
    string,
    {
      id: string;
      name: string | null;
      email: string | null;
      roles: Array<{ roleId: string; roleName: string; assignedAt: string }>;
    }
  >();

  for (const user of systemUsers) {
    userMap.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: [],
    });
  }

  for (const member of crewMembers) {
    if (!userMap.has(member.id)) {
      userMap.set(member.id, {
        id: member.id,
        name: member.name,
        email: member.email,
        roles: [],
      });
    }
  }

  const nowIso = new Date().toISOString();
  for (const assignment of assignments) {
    const user = userMap.get(assignment.userId);
    if (user) {
      user.roles.push({
        roleId: assignment.roleId,
        roleName: assignment.roleName,
        assignedAt: nowIso,
      });
    }
  }

  return Array.from(userMap.values());
}

// Access and dashboard seeding helpers keep the composition root off the db handle.
export interface SeedRoleRow {
  id: string;
  name: string;
  hubAdmin: boolean;
  hubAccess: string[] | null;
}

export async function listOrgRolesForSeeding(orgId: string): Promise<SeedRoleRow[]> {
  return db
    .select({
      id: roles.id,
      name: roles.name,
      hubAdmin: roles.hubAdmin,
      hubAccess: roles.hubAccess,
    })
    .from(roles)
    .where(eq(roles.orgId, orgId));
}

export async function setRoleHubDefaults(
  orgId: string,
  roleId: string,
  values: { hubAdmin: boolean; hubAccess: string[] | null }
): Promise<void> {
  await db
    .update(roles)
    .set({ hubAdmin: values.hubAdmin, hubAccess: values.hubAccess })
    .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId)));
}

export async function listUnlinkedCrewForSeeding(
  orgId: string
): Promise<{ id: string; rank: string | null }[]> {
  return db
    .select({ id: crew.id, rank: crew.rank })
    .from(crew)
    .where(and(eq(crew.orgId, orgId), isNull(crew.roleId)));
}

export async function setCrewRoleId(orgId: string, crewId: string, roleId: string): Promise<void> {
  await db
    .update(crew)
    .set({ roleId })
    .where(and(eq(crew.id, crewId), eq(crew.orgId, orgId)));
}

export async function listDistinctRoleOrgIds(): Promise<string[]> {
  const rows = await db.select({ orgId: roles.orgId }).from(roles).groupBy(roles.orgId);
  return rows.map((r) => r.orgId);
}

export async function listAllOrganizations(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: organizations.id, name: organizations.name }).from(organizations);
}

export async function getUserPrimaryRole(orgId: string, userId: string) {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
    .limit(1);
  return row;
}

export async function getUserDiagnosticRow(orgId: string, userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      loginEnabled: users.loginEnabled,
      mustChangePassword: users.mustChangePassword,
      hubAdmin: users.hubAdmin,
      hubAccess: users.hubAccess,
    })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
    .limit(1);
  return row;
}

export async function getCrewLinkForUser(orgId: string, userId: string) {
  const [row] = await db
    .select({
      id: crew.id,
      name: crew.name,
      vesselId: crew.vesselId,
      roleId: crew.roleId,
    })
    .from(crew)
    .where(and(eq(crew.orgId, orgId), eq(crew.userId, userId)))
    .limit(1);
  return row;
}
