/**
 * Crew Admin Infrastructure - Repository Adapter
 * Implements ICrewAdminRepository using Drizzle ORM (cloud/PostgreSQL).
 */

import type { ICrewAdminRepository } from "../domain/ports";
import type {
  RoleSummary,
  CreateRoleCommand,
  UpdateRoleCommand,
  VesselAssignmentEntity,
  AssignmentInput,
  CrewUserSummary,
  CrewMemberRef,
  CrewAccessMemberRef,
} from "../domain/types";
import { db } from "../../../db";
import {
  roles,
  users,
  crew,
  vessels,
  userVesselAssignments,
  userRoleAssignments,
  roleDashboardConfigs,
  adminSessions,
  type Role,
} from "@shared/schema-runtime";
import {
  PROTECTED_ROLE_KEYS,
  ADMIN_CAPABLE_ROLE_KEYS,
  roleDashboardConfigSchema,
  type RoleDashboardConfig,
} from "@shared/role-dashboard";
import { and, eq, inArray, sql } from "drizzle-orm";

function isProtectedRoleName(name: string): boolean {
  return (PROTECTED_ROLE_KEYS as readonly string[]).includes(name);
}

export class CrewAdminRepositoryAdapter implements ICrewAdminRepository {
  /* ----------------------------- Roles ----------------------------- */

  async listRoles(orgId: string): Promise<RoleSummary[]> {
    const roleRows = await db.select().from(roles).where(eq(roles.orgId, orgId));
    const counts = await db
      .select({ role: users.role, count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.orgId, orgId))
      .groupBy(users.role);
    const countByName = new Map(counts.map((row) => [row.role, Number(row.count)]));
    return roleRows.map((row) => this.mapRole(row, countByName.get(row.name) ?? 0));
  }

  async findRoleById(orgId: string, id: string): Promise<RoleSummary | undefined> {
    const [row] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.orgId, orgId), eq(roles.id, id)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const count = await this.countUsersForRole(orgId, row.name);
    return this.mapRole(row, count);
  }

  async findRoleByName(orgId: string, name: string): Promise<RoleSummary | undefined> {
    const [row] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.orgId, orgId), eq(roles.name, name)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const count = await this.countUsersForRole(orgId, row.name);
    return this.mapRole(row, count);
  }

  async createRole(command: CreateRoleCommand): Promise<RoleSummary> {
    const [created] = await db
      .insert(roles)
      .values({
        orgId: command.orgId,
        name: command.name,
        displayName: command.displayName,
        description: command.description ?? null,
        department: command.department ?? null,
        hierarchyLevel: command.hierarchyLevel ?? 50,
        isSystemRole: false,
        isActive: true,
      })
      .returning();
    if (!created) {
      throw new Error("CrewAdminRepository.createRole: insert returned no row");
    }
    return this.mapRole(created, 0);
  }

  async updateRole(
    orgId: string,
    id: string,
    patch: UpdateRoleCommand
  ): Promise<RoleSummary | undefined> {
    const updateValues: Partial<typeof roles.$inferInsert> = { updatedAt: new Date() };
    if (patch.displayName !== undefined) {
      updateValues.displayName = patch.displayName;
    }
    if (patch.description !== undefined) {
      updateValues.description = patch.description;
    }
    if (patch.department !== undefined) {
      updateValues.department = patch.department;
    }
    if (patch.hierarchyLevel !== undefined) {
      updateValues.hierarchyLevel = patch.hierarchyLevel;
    }
    if (patch.isActive !== undefined) {
      updateValues.isActive = patch.isActive;
    }

    const [updated] = await db
      .update(roles)
      .set(updateValues)
      .where(and(eq(roles.orgId, orgId), eq(roles.id, id)))
      .returning();
    if (!updated) {
      return undefined;
    }
    const count = await this.countUsersForRole(orgId, updated.name);
    return this.mapRole(updated, count);
  }

  async deleteRole(orgId: string, id: string): Promise<void> {
    await db.delete(roles).where(and(eq(roles.orgId, orgId), eq(roles.id, id)));
  }

  async setRoleHubAccess(
    orgId: string,
    id: string,
    hubAdmin: boolean,
    hubAccess: string[] | null
  ): Promise<RoleSummary | undefined> {
    const [updated] = await db
      .update(roles)
      .set({ hubAdmin, hubAccess, updatedAt: new Date() })
      .where(and(eq(roles.orgId, orgId), eq(roles.id, id)))
      .returning();
    if (!updated) {
      return undefined;
    }
    const count = await this.countUsersForRole(orgId, updated.name);
    return this.mapRole(updated, count);
  }

  /* ----------------------- Dashboard configs ----------------------- */

  async getStoredConfig(orgId: string, roleId: string): Promise<RoleDashboardConfig | undefined> {
    const [row] = await db
      .select()
      .from(roleDashboardConfigs)
      .where(and(eq(roleDashboardConfigs.orgId, orgId), eq(roleDashboardConfigs.roleId, roleId)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    return this.parseConfig(row.configJson);
  }

  async listStoredConfigs(orgId: string): Promise<Map<string, RoleDashboardConfig>> {
    const rows = await db
      .select()
      .from(roleDashboardConfigs)
      .where(eq(roleDashboardConfigs.orgId, orgId));
    const map = new Map<string, RoleDashboardConfig>();
    for (const row of rows) {
      const parsed = this.parseConfig(row.configJson);
      if (parsed) {
        map.set(row.roleId, parsed);
      }
    }
    return map;
  }

  async upsertConfig(
    orgId: string,
    roleId: string,
    config: RoleDashboardConfig,
    updatedBy: string | undefined
  ): Promise<void> {
    await db
      .insert(roleDashboardConfigs)
      .values({
        orgId,
        roleId,
        configJson: config,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [roleDashboardConfigs.orgId, roleDashboardConfigs.roleId],
        set: { configJson: config, updatedBy: updatedBy ?? null, updatedAt: new Date() },
      });
  }

  async deleteConfig(orgId: string, roleId: string): Promise<void> {
    await db
      .delete(roleDashboardConfigs)
      .where(and(eq(roleDashboardConfigs.orgId, orgId), eq(roleDashboardConfigs.roleId, roleId)));
  }

  /* ----------------------- Users + assignments --------------------- */

  async listUsers(orgId: string): Promise<CrewUserSummary[]> {
    const userRows = await db.select().from(users).where(eq(users.orgId, orgId));
    if (userRows.length === 0) {
      return [];
    }
    const ids = userRows.map((row) => row.id);
    const assignmentRows = await db
      .select()
      .from(userVesselAssignments)
      .where(
        and(eq(userVesselAssignments.orgId, orgId), inArray(userVesselAssignments.userId, ids))
      );
    const byUser = new Map<string, VesselAssignmentEntity[]>();
    for (const row of assignmentRows) {
      const list = byUser.get(row.userId) ?? [];
      list.push(this.mapAssignment(row));
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
      this.mapUser(
        row,
        byUser.get(row.id) ?? [],
        rolesByUser.get(row.id) ?? [],
        crewByUser.get(row.id) ?? null
      )
    );
  }

  async findUser(orgId: string, userId: string): Promise<CrewUserSummary | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const assignments = await this.getAssignments(orgId, userId);
    const assignedRoleNames = await this.listAssignedRoleNames(orgId, userId);
    const linkedCrew = await this.findCrewByUserId(orgId, userId);
    return this.mapUser(
      row,
      assignments,
      assignedRoleNames,
      linkedCrew ? { id: linkedCrew.id, name: linkedCrew.name } : null
    );
  }

  async vesselExists(orgId: string, vesselId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: vessels.id })
      .from(vessels)
      .where(and(eq(vessels.orgId, orgId), eq(vessels.id, vesselId)))
      .limit(1);
    return !!row;
  }

  async getAssignments(orgId: string, userId: string): Promise<VesselAssignmentEntity[]> {
    const rows = await db
      .select()
      .from(userVesselAssignments)
      .where(and(eq(userVesselAssignments.orgId, orgId), eq(userVesselAssignments.userId, userId)));
    return rows.map((row) => this.mapAssignment(row));
  }

  async replaceAssignments(
    orgId: string,
    userId: string,
    assignments: AssignmentInput[],
    assignedBy: string | undefined
  ): Promise<VesselAssignmentEntity[]> {
    return db.transaction(async (tx) => {
      await tx
        .delete(userVesselAssignments)
        .where(
          and(eq(userVesselAssignments.orgId, orgId), eq(userVesselAssignments.userId, userId))
        );
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
        .where(
          and(eq(userVesselAssignments.orgId, orgId), eq(userVesselAssignments.userId, userId))
        );
      return rows.map((row) => this.mapAssignment(row));
    });
  }

  async listAssignedRoleIds(orgId: string, userId: string): Promise<string[]> {
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

  async listAssignedRoleNames(orgId: string, userId: string): Promise<string[]> {
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

  async replaceRoleAssignments(
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

  /* ----------------------------- Credentials ----------------------- */

  async setRole(orgId: string, userId: string, role: string): Promise<void> {
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
  }

  async setSupervisor(
    orgId: string,
    userId: string,
    supervisorUserId: string | null
  ): Promise<void> {
    await db
      .update(users)
      .set({ supervisorUserId, updatedAt: new Date() })
      .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
  }

  async setLoginEnabled(orgId: string, userId: string, enabled: boolean): Promise<void> {
    await db
      .update(users)
      .set({ loginEnabled: enabled, updatedAt: new Date() })
      .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
  }

  async setCredentials(
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

  async setMustChangePassword(orgId: string, userId: string, value: boolean): Promise<void> {
    await db
      .update(users)
      .set({ mustChangePassword: value, updatedAt: new Date() })
      .where(and(eq(users.orgId, orgId), eq(users.id, userId)));
  }

  async setHubAccessGrant(
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

  async invalidateUserSessions(userId: string): Promise<void> {
    await db.delete(adminSessions).where(eq(adminSessions.userId, userId));
  }

  async countActiveAdminLogins(orgId: string, excludeUserId?: string): Promise<number> {
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

  /* ------------------------------ Mappers -------------------------- */

  private async countUsersForRole(orgId: string, roleName: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, roleName)));
    return Number(row?.count ?? 0);
  }

  private parseConfig(value: unknown): RoleDashboardConfig | undefined {
    const parsed = roleDashboardConfigSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }

  private mapRole(row: Role, assignedUserCount: number): RoleSummary {
    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      description: row.description,
      department: row.department,
      hierarchyLevel: row.hierarchyLevel,
      isSystemRole: row.isSystemRole ?? false,
      isProtected: (row.isSystemRole ?? false) || isProtectedRoleName(row.name),
      isActive: row.isActive ?? true,
      assignedUserCount,
      hubAdmin: row.hubAdmin ?? false,
      hubAccess: row.hubAccess ?? null,
    };
  }

  private mapAssignment(row: typeof userVesselAssignments.$inferSelect): VesselAssignmentEntity {
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

  private mapUser(
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

  /* -------------------------- Crew ↔ login link -------------------- */

  async listCrewMembers(orgId: string): Promise<CrewAccessMemberRef[]> {
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

  async findCrewMember(orgId: string, crewId: string): Promise<CrewMemberRef | undefined> {
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

  async findCrewByUserId(orgId: string, userId: string): Promise<CrewMemberRef | undefined> {
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

  async setCrewUserLink(orgId: string, crewId: string, userId: string | null): Promise<void> {
    await db
      .update(crew)
      .set({ userId, updatedAt: new Date() })
      .where(and(eq(crew.orgId, orgId), eq(crew.id, crewId)));
  }

  async findUserByUsername(orgId: string, username: string): Promise<{ id: string } | undefined> {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, orgId), sql`lower(${users.username}) = lower(${username})`))
      .limit(1);
    return row ?? undefined;
  }

  async createUser(input: {
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
        email: input.email,
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
}

export const crewAdminRepository = new CrewAdminRepositoryAdapter();
