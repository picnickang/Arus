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
import { roles, users, roleDashboardConfigs, type Role } from "@shared/schema-runtime";
import {
  PROTECTED_ROLE_KEYS,
  roleDashboardConfigSchema,
  type RoleDashboardConfig,
} from "@shared/role-dashboard";
import { and, eq, sql } from "drizzle-orm";
import * as userAccessRepository from "./crew-admin-user-access-repository";

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
    return userAccessRepository.listUsers(orgId);
  }

  async findUser(orgId: string, userId: string): Promise<CrewUserSummary | undefined> {
    return userAccessRepository.findUser(orgId, userId);
  }

  async vesselExists(orgId: string, vesselId: string): Promise<boolean> {
    return userAccessRepository.vesselExists(orgId, vesselId);
  }

  async getAssignments(orgId: string, userId: string): Promise<VesselAssignmentEntity[]> {
    return userAccessRepository.getAssignments(orgId, userId);
  }

  async replaceAssignments(
    orgId: string,
    userId: string,
    assignments: AssignmentInput[],
    assignedBy: string | undefined
  ): Promise<VesselAssignmentEntity[]> {
    return userAccessRepository.replaceAssignments(orgId, userId, assignments, assignedBy);
  }

  async listAssignedRoleIds(orgId: string, userId: string): Promise<string[]> {
    return userAccessRepository.listAssignedRoleIds(orgId, userId);
  }

  async listAssignedRoleNames(orgId: string, userId: string): Promise<string[]> {
    return userAccessRepository.listAssignedRoleNames(orgId, userId);
  }

  async replaceRoleAssignments(
    orgId: string,
    userId: string,
    roleIds: string[],
    assignedBy: string | undefined
  ): Promise<void> {
    await userAccessRepository.replaceRoleAssignments(orgId, userId, roleIds, assignedBy);
  }

  /* ----------------------------- Credentials ----------------------- */

  async setRole(orgId: string, userId: string, role: string): Promise<void> {
    await userAccessRepository.setRole(orgId, userId, role);
  }

  async setSupervisor(
    orgId: string,
    userId: string,
    supervisorUserId: string | null
  ): Promise<void> {
    await userAccessRepository.setSupervisor(orgId, userId, supervisorUserId);
  }

  async setLoginEnabled(orgId: string, userId: string, enabled: boolean): Promise<void> {
    await userAccessRepository.setLoginEnabled(orgId, userId, enabled);
  }

  async setCredentials(
    orgId: string,
    userId: string,
    patch: { username?: string; passwordHash?: string; loginEnabled?: boolean }
  ): Promise<void> {
    await userAccessRepository.setCredentials(orgId, userId, patch);
  }

  async setMustChangePassword(orgId: string, userId: string, value: boolean): Promise<void> {
    await userAccessRepository.setMustChangePassword(orgId, userId, value);
  }

  async setHubAccessGrant(
    orgId: string,
    userId: string,
    hubAdmin: boolean,
    hubAccess: string[] | null
  ): Promise<void> {
    await userAccessRepository.setHubAccessGrant(orgId, userId, hubAdmin, hubAccess);
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    await userAccessRepository.invalidateUserSessions(userId);
  }

  async countActiveAdminLogins(orgId: string, excludeUserId?: string): Promise<number> {
    return userAccessRepository.countActiveAdminLogins(orgId, excludeUserId);
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

  /* -------------------------- Crew ↔ login link -------------------- */

  async listCrewMembers(orgId: string): Promise<CrewAccessMemberRef[]> {
    return userAccessRepository.listCrewMembers(orgId);
  }

  async findCrewMember(orgId: string, crewId: string): Promise<CrewMemberRef | undefined> {
    return userAccessRepository.findCrewMember(orgId, crewId);
  }

  async findCrewByUserId(orgId: string, userId: string): Promise<CrewMemberRef | undefined> {
    return userAccessRepository.findCrewByUserId(orgId, userId);
  }

  async setCrewUserLink(orgId: string, crewId: string, userId: string | null): Promise<void> {
    await userAccessRepository.setCrewUserLink(orgId, crewId, userId);
  }

  async findUserByUsername(orgId: string, username: string): Promise<{ id: string } | undefined> {
    return userAccessRepository.findUserByUsername(orgId, username);
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
    return userAccessRepository.createUser(input);
  }
}

export const crewAdminRepository = new CrewAdminRepositoryAdapter();
