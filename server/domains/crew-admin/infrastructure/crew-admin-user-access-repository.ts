import type {
  AssignmentInput,
  CrewAccessMemberRef,
  CrewMemberRef,
  CrewUserSummary,
  VesselAssignmentEntity,
} from "../domain/types";
import { db } from "../../../db";
import {
  adminSessions,
  crew,
  roles,
  userRoleAssignments,
  users,
  userVesselAssignments,
  vessels,
} from "@shared/schema-runtime";
import { ADMIN_CAPABLE_ROLE_KEYS } from "@shared/role-dashboard";
import { and, eq, inArray, sql } from "drizzle-orm";

export async function listUsers(orgId: string): Promise<CrewUserSummary[]> {
  const userRows = await db.select().from(users).where(eq(users.orgId, orgId));
  if (userRows.length === 0) {
    return [];
  }
  const ids = userRows.map((row) => row.id);
  const assignmentRows = await db
    .select()
    .from(userVesselAssignments)
    .where(and(eq(userVesselAssignments.orgId, orgId), inArray(userVesselAssignments.userId, ids)));
  const byUser = new Map<string, VesselAssignmentEntity[]>();
  for (const row of assignmentRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(mapAssignment(row));
    byUser.set(row.userId, list);
  }
  const roleRows = await db
    .select({ userId: userRoleAssignments.userId, roleName: roles.name })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(
      and(
        eq(userRoleAssignments.orgId, orgId),
        eq(userRoleAssignments.isActive, true),
        inArray(userRoleAssignments.userId, ids)
      )
    );
  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows) {
    const list = rolesByUser.get(row.userId) ?? [];
    list.push(row.roleName);
    rolesByUser.set(row.userId, list);
  }
  const crewRows = await db
    .select({ crewId: crew.id, crewName: crew.name, userId: crew.userId })
    .from(crew)
    .where(and(eq(crew.orgId, orgId), inArray(crew.userId, ids)));
  const crewByUser = new Map<string, { id: string; name: string }>();
  for (const row of crewRows) {
    if (row.userId) {
      crewByUser.set(row.userId, { id: row.crewId, name: row.crewName });
    }
  }
  return userRows.map((row) =>
    mapUser(
      row,
      byUser.get(row.id) ?? [],
      rolesByUser.get(row.id) ?? [],
      crewByUser.get(row.id) ?? null
    )
  );
}

export async function findUser(
  orgId: string,
  userId: string
): Promise<CrewUserSummary | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
    .limit(1);
  if (!row) {
    return undefined;
  }
  const assignments = await getAssignments(orgId, userId);
  const assignedRoleNames = await listAssignedRoleNames(orgId, userId);
  const linkedCrew = await findCrewByUserId(orgId, userId);
  return mapUser(
    row,
    assignments,
    assignedRoleNames,
    linkedCrew ? { id: linkedCrew.id, name: linkedCrew.name } : null
  );
}

export async function vesselExists(orgId: string, vesselId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: vessels.id })
    .from(vessels)
    .where(and(eq(vessels.orgId, orgId), eq(vessels.id, vesselId)))
    .limit(1);
  return !!row;
}

export async function getAssignments(
  orgId: string,
  userId: string
): Promise<VesselAssignmentEntity[]> {
  const rows = await db
    .select()
    .from(userVesselAssignments)
    .where(and(eq(userVesselAssignments.orgId, orgId), eq(userVesselAssignments.userId, userId)));
  return rows.map((row) => mapAssignment(row));
}

export async function replaceAssignments(
  orgId: string,
  userId: string,
  assignments: AssignmentInput[],
  assignedBy: string | undefined
): Promise<VesselAssignmentEntity[]> {
  return db.transaction(async (tx) => {
    await tx
      .delete(userVesselAssignments)
      .where(and(eq(userVesselAssignments.orgId, orgId), eq(userVesselAssignments.userId, userId)));
    if (assignments.length > 0) {
      await tx.insert(userVesselAssignments).values(
        assignments.map((a) => ({
          orgId,
          userId,
          vesselId: a.vesselId ?? null,
          department: a.department ?? null,
          isActive: true,
          assignedBy: assignedBy ?? null,
        }))
      );
    }
    const rows = await tx
      .select()
      .from(userVesselAssignments)
      .where(and(eq(userVesselAssignments.orgId, orgId), eq(userVesselAssignments.userId, userId)));
    return rows.map((row) => mapAssignment(row));
  });
}

export async function listAssignedRoleIds(orgId: string, userId: string): Promise<string[]> {
  const rows = await db
    .select({ roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .where(
      and(
        eq(userRoleAssignments.orgId, orgId),
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.isActive, true)
      )
    );
  return rows.map((row) => row.roleId);
}

export async function listAssignedRoleNames(orgId: string, userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(
      and(
        eq(userRoleAssignments.orgId, orgId),
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.isActive, true)
      )
    );
  return rows.map((row) => row.name);
}

export async function replaceRoleAssignments(
  orgId: string,
  userId: string,
  roleIds: string[],
  assignedBy: string | undefined
): Promise<void> {
  const unique = [...new Set(roleIds)];
  await db.transaction(async (tx) => {
    await tx
      .delete(userRoleAssignments)
      .where(and(eq(userRoleAssignments.orgId, orgId), eq(userRoleAssignments.userId, userId)));
    if (unique.length > 0) {
      await tx.insert(userRoleAssignments).values(
        unique.map((roleId) => ({
          orgId,
          userId,
          roleId,
          isActive: true,
          assignedBy: assignedBy ?? null,
        }))
      );
    }
  });
}

export async function setRole(orgId: string, userId: string, role: string): Promise<void> {
  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}

export async function setSupervisor(
  orgId: string,
  userId: string,
  supervisorUserId: string | null
): Promise<void> {
  await db
    .update(users)
    .set({ supervisorUserId, updatedAt: new Date() })
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}

export async function setLoginEnabled(
  orgId: string,
  userId: string,
  enabled: boolean
): Promise<void> {
  await db
    .update(users)
    .set({ loginEnabled: enabled, updatedAt: new Date() })
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}

export async function setCredentials(
  orgId: string,
  userId: string,
  patch: { username?: string; passwordHash?: string; loginEnabled?: boolean }
): Promise<void> {
  const updateValues: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (patch.username !== undefined) {
    updateValues.username = patch.username;
  }
  if (patch.passwordHash !== undefined) {
    updateValues.passwordHash = patch.passwordHash;
    updateValues.passwordUpdatedAt = new Date();
  }
  if (patch.loginEnabled !== undefined) {
    updateValues.loginEnabled = patch.loginEnabled;
  }
  await db
    .update(users)
    .set(updateValues)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}

export async function setMustChangePassword(
  orgId: string,
  userId: string,
  value: boolean
): Promise<void> {
  await db
    .update(users)
    .set({ mustChangePassword: value, updatedAt: new Date() })
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}

export async function setHubAccessGrant(
  orgId: string,
  userId: string,
  hubAdmin: boolean,
  hubAccess: string[] | null
): Promise<void> {
  await db
    .update(users)
    .set({ hubAdmin, hubAccess, updatedAt: new Date() })
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
}

export async function countActiveAdminLogins(
  orgId: string,
  excludeUserId?: string
): Promise<number> {
  const conditions = [
    eq(users.orgId, orgId),
    eq(users.isActive, true),
    eq(users.loginEnabled, true),
    inArray(users.role, [...ADMIN_CAPABLE_ROLE_KEYS]),
  ];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...conditions));
  return rows.filter((row) => row.id !== excludeUserId).length;
}

export async function listCrewMembers(orgId: string): Promise<CrewAccessMemberRef[]> {
  const rows = await db
    .select({
      id: crew.id,
      name: crew.name,
      email: crew.email,
      userId: crew.userId,
      vesselId: crew.vesselId,
      active: crew.active,
    })
    .from(crew)
    .where(eq(crew.orgId, orgId));
  return rows.map((row) => ({
    ...row,
    active: row.active ?? true,
  }));
}

export async function findCrewMember(
  orgId: string,
  crewId: string
): Promise<CrewMemberRef | undefined> {
  const [row] = await db
    .select({
      id: crew.id,
      name: crew.name,
      email: crew.email,
      userId: crew.userId,
      vesselId: crew.vesselId,
    })
    .from(crew)
    .where(and(eq(crew.orgId, orgId), eq(crew.id, crewId)))
    .limit(1);
  return row ?? undefined;
}

export async function findCrewByUserId(
  orgId: string,
  userId: string
): Promise<CrewMemberRef | undefined> {
  const [row] = await db
    .select({
      id: crew.id,
      name: crew.name,
      email: crew.email,
      userId: crew.userId,
      vesselId: crew.vesselId,
    })
    .from(crew)
    .where(and(eq(crew.orgId, orgId), eq(crew.userId, userId)))
    .limit(1);
  return row ?? undefined;
}

export async function setCrewUserLink(
  orgId: string,
  crewId: string,
  userId: string | null
): Promise<void> {
  await db
    .update(crew)
    .set({ userId, updatedAt: new Date() })
    .where(and(eq(crew.orgId, orgId), eq(crew.id, crewId)));
}

export async function findUserByUsername(
  orgId: string,
  username: string
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), sql`lower(${users.username}) = lower(${username})`))
    .limit(1);
  return row ?? undefined;
}

export async function createUser(input: {
  orgId: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: string;
  loginEnabled: boolean;
  mustChangePassword: boolean;
}): Promise<string> {
  const [created] = await db
    .insert(users)
    .values({
      orgId: input.orgId,
      name: input.name,
      email: input.email.toLowerCase(),
      username: input.username,
      passwordHash: input.passwordHash,
      passwordUpdatedAt: new Date(),
      role: input.role,
      isActive: true,
      loginEnabled: input.loginEnabled,
      mustChangePassword: input.mustChangePassword,
    })
    .returning({ id: users.id });
  if (!created) {
    throw new Error("CrewAdminRepository.createUser: insert returned no row");
  }
  return created.id;
}

function mapAssignment(row: typeof userVesselAssignments.$inferSelect): VesselAssignmentEntity {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    vesselId: row.vesselId,
    department: row.department,
    isActive: row.isActive,
    assignedBy: row.assignedBy,
  };
}

function mapUser(
  row: typeof users.$inferSelect,
  assignments: VesselAssignmentEntity[],
  assignedRoleNames: string[],
  linkedCrew: { id: string; name: string } | null
): CrewUserSummary {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    username: row.username ?? null,
    role: row.role,
    isActive: row.isActive ?? true,
    loginEnabled: row.loginEnabled,
    mustChangePassword: row.mustChangePassword,
    hasPassword: !!row.passwordHash,
    lastLoginAt: row.lastLoginAt,
    passwordUpdatedAt: row.passwordUpdatedAt ?? null,
    supervisorUserId: row.supervisorUserId ?? null,
    assignments,
    assignedRoleNames,
    linkedCrewId: linkedCrew?.id ?? null,
    linkedCrewName: linkedCrew?.name ?? null,
    hubAdmin: row.hubAdmin,
    hubAccess: row.hubAccess ?? null,
  };
}
