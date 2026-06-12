import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../../db";
import { crew, organizations, roles, userRoleAssignments, users } from "@shared/schema-runtime";

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
