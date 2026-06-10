import type { WidenPartial } from "../../lib/widen-partial";
/**
 * Permission Repository - Database Operations
 *
 * CRUD operations for roles, permission grants, and user role assignments.
 *
 * NOTE: The deployed PostgreSQL schema contains only three permission-related
 * tables: roles, permission_grants, user_role_assignments. The earlier code
 * referenced five additional tables (permission_resources, permission_actions,
 * resource_actions, role_templates, permission_audit_log) that do not exist.
 * Resource/action definitions are sourced from the static permission registry
 * in server/config/permission-registry.ts, role templates from
 * server/config/default-role-templates.ts, and audit entries are emitted via
 * structured logging instead of being persisted.
 */

import { db } from "../../db";
import { eq, and, count, isNull } from "drizzle-orm";
import { crew } from "../../../shared/schema/crew";
import { users, organizations } from "../../../shared/schema/core";
import {
  roles,
  permissionGrants,
  userRoleAssignments,
  type Role,
  type InsertRole,
  type PermissionResource,
  type PermissionAction,
  type PermissionGrant,
  type RoleTemplate,
  type InsertRoleTemplate,
  type PermissionAuditEntry,
  type UserRoleAssignment,
  type InsertUserRoleAssignment,
} from "../../../shared/schema/permissions";
import { RESOURCES, ACTIONS } from "../../config/permission-registry";
import { DEFAULT_ROLE_TEMPLATES } from "../../config/default-role-templates";
import { structuredLog } from "../../logging";
import { auditService } from "../../compliance/immutable-audit.service";
import {
  planPdmBackfill,
  PDM_BACKFILL_ROLE_NAMES,
  type PdmBackfillRoleResult,
} from "./pdm-backfill-planner";

// Re-export so existing importers (e.g. server/scripts/backfill-pdm-permissions.ts)
// keep resolving these from the repository module.
export { PDM_BACKFILL_ROLE_NAMES };
export type { PdmBackfillRoleResult };

function staticResources(): PermissionResource[] {
  return RESOURCES.map((r) => ({
    id: r.code,
    code: r.code,
    name: r.name,
    description: r.description ?? null,
    category: r.category,
    icon: r.icon ?? null,
    sortOrder: r.sortOrder ?? null,
    isActive: true,
  }));
}

function staticActions(): PermissionAction[] {
  return Object.values(ACTIONS).map((a) => ({
    id: a.code,
    code: a.code,
    name: a.name,
    description: a.description ?? null,
    riskLevel: a.riskLevel ?? null,
    sortOrder: a.sortOrder ?? null,
  }));
}

function staticRoleTemplates(): RoleTemplate[] {
  return DEFAULT_ROLE_TEMPLATES.map((t) => ({
    id: t.name,
    name: t.name,
    displayName: t.displayName,
    description: t.description ?? null,
    department: t.department ?? null,
    hierarchyLevel: t.hierarchyLevel,
    permissions: JSON.stringify(t.permissions),
    fleetType: t.fleetType ?? null,
    isActive: true,
    createdAt: null,
  }));
}

export async function seedResourcesAndActions(): Promise<void> {
  // Resources and actions are static (no DB tables). No-op kept for API compat.
}

export async function listRoles(orgId: string): Promise<Role[]> {
  return db
    .select()
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.isActive, true)))
    .orderBy(roles.hierarchyLevel, roles.displayName);
}

export async function getRoleById(id: string, orgId: string): Promise<Role | undefined> {
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, id), eq(roles.orgId, orgId)))
    .limit(1);
  return role;
}

export async function getRoleByName(name: string, orgId: string): Promise<Role | undefined> {
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.name, name), eq(roles.orgId, orgId)))
    .limit(1);
  return role;
}

export async function createRole(data: InsertRole): Promise<Role> {
  const [role] = await db.insert(roles).values(data).returning();
  if (!role) {
    throw new Error("Failed to create role");
  }
  return role;
}

export async function updateRole(
  id: string,
  orgId: string,
  data: WidenPartial<InsertRole>
): Promise<Role | undefined> {
  const [updated] = await db
    .update(roles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(roles.id, id), eq(roles.orgId, orgId)))
    .returning();
  return updated;
}

export async function deleteRole(id: string, orgId: string): Promise<boolean> {
  const result = await db
    .update(roles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(roles.id, id), eq(roles.orgId, orgId)));
  return (result.rowCount ?? 0) > 0;
}

export async function listResources(): Promise<PermissionResource[]> {
  return staticResources();
}

export async function listActions(): Promise<PermissionAction[]> {
  return staticActions();
}

export async function getPermissionGrantsForRole(roleId: string): Promise<PermissionGrant[]> {
  return db.select().from(permissionGrants).where(eq(permissionGrants.roleId, roleId));
}

export async function setPermissionGrant(
  roleId: string,
  resourceCode: string,
  actionCode: string,
  isGranted: boolean
): Promise<void> {
  const existing = await db
    .select()
    .from(permissionGrants)
    .where(
      and(
        eq(permissionGrants.roleId, roleId),
        eq(permissionGrants.resourceCode, resourceCode),
        eq(permissionGrants.actionCode, actionCode)
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    await db
      .update(permissionGrants)
      .set({ isGranted })
      .where(eq(permissionGrants.id, existing[0].id));
  } else {
    await db.insert(permissionGrants).values({
      roleId,
      resourceCode,
      actionCode,
      isGranted,
    });
  }
}

export async function bulkSetPermissionGrants(
  roleId: string,
  grants: Array<{ resourceCode: string; actionCode: string; isGranted: boolean }>
): Promise<void> {
  for (const grant of grants) {
    await setPermissionGrant(roleId, grant.resourceCode, grant.actionCode, grant.isGranted);
  }
}

export async function listRoleTemplates(): Promise<RoleTemplate[]> {
  return staticRoleTemplates();
}

export async function getRoleTemplateById(id: string): Promise<RoleTemplate | undefined> {
  return staticRoleTemplates().find((t) => t.id === id || t.name === id);
}

export async function createRoleTemplate(_data: InsertRoleTemplate): Promise<RoleTemplate> {
  throw new Error(
    "createRoleTemplate is unsupported: role templates are defined in config/default-role-templates.ts"
  );
}

export async function createRoleFromTemplate(
  templateId: string,
  orgId: string,
  overrides?: WidenPartial<InsertRole>
): Promise<Role> {
  const template = await getRoleTemplateById(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const roleData: InsertRole = {
    orgId,
    name: overrides?.name || template.name,
    displayName: overrides?.displayName || template.displayName,
    description: overrides?.description || template.description,
    department: (overrides?.department || template.department) as InsertRole["department"],
    hierarchyLevel: overrides?.hierarchyLevel ?? template.hierarchyLevel,
    isSystemRole: false,
    templateId: template.id,
  };

  const role = await createRole(roleData);

  const permissions = JSON.parse(template.permissions) as Array<{
    resource: string;
    action: string;
  }>;

  for (const perm of permissions) {
    await setPermissionGrant(role.id, perm.resource, perm.action, true);
  }

  return role;
}

export async function provisionTemplatesForOrg(orgId: string): Promise<Role[]> {
  const templates = await listRoleTemplates();
  const existingRoles = await listRoles(orgId);
  const provisionedRoles: Role[] = [];

  for (const template of templates) {
    const existingRole = existingRoles.find(
      (r) => r.templateId === template.id || r.name === template.name
    );

    if (!existingRole) {
      const role = await createRoleFromTemplate(template.id, orgId);
      provisionedRoles.push(role);
    }
  }

  return provisionedRoles;
}

export async function getOrProvisionRolesForOrg(orgId: string): Promise<Role[]> {
  await provisionTemplatesForOrg(orgId);
  return listRoles(orgId);
}

/**
 * Idempotent, safe backfill of the default `predictive_maintenance` grants onto
 * the admin-capable template roles that should carry them.
 *
 * All decision logic lives in the db-free `planPdmBackfill()` (see
 * `pdm-backfill-planner.ts`); this function only gathers rows and performs the
 * writes the plan calls for. Safety properties (idempotent, no duplicate rows,
 * never re-enables a deliberate revocation, only `predictive_maintenance` on the
 * four admin roles) are enforced — and unit-tested — in the planner.
 *
 * Pass `{ apply: false }` (the default) for a dry-run plan.
 */
export async function backfillPdmTemplateGrantsForOrg(
  orgId: string,
  options: { apply?: boolean } = {}
): Promise<PdmBackfillRoleResult[]> {
  const apply = options.apply ?? false;
  const templates = await listRoleTemplates();
  const existingRoles = await listRoles(orgId);

  // Gather the grants for every existing role up front so the planner stays
  // pure (no I/O). The role set per org is small (template roles + a few custom).
  const grantsByRoleId = new Map<string, PermissionGrant[]>();
  for (const role of existingRoles) {
    grantsByRoleId.set(role.id, await getPermissionGrantsForRole(role.id));
  }

  const results = planPdmBackfill(templates, existingRoles, grantsByRoleId, apply);

  if (apply) {
    for (const result of results) {
      if (!result.roleId) {
        continue;
      }
      for (const perm of result.added) {
        await setPermissionGrant(result.roleId, perm.resource, perm.action, true);
      }
    }
  }

  return results;
}

export async function listUserRoleAssignments(
  userId: string,
  orgId: string
): Promise<UserRoleAssignment[]> {
  return db
    .select()
    .from(userRoleAssignments)
    .where(
      and(
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.orgId, orgId),
        eq(userRoleAssignments.isActive, true)
      )
    );
}

export async function assignRoleToUser(
  data: InsertUserRoleAssignment
): Promise<UserRoleAssignment> {
  const [assignment] = await db.insert(userRoleAssignments).values(data).returning();
  if (!assignment) {
    throw new Error("Failed to assign role to user");
  }
  return assignment;
}

export async function removeRoleFromUser(
  userId: string,
  roleId: string,
  orgId: string
): Promise<boolean> {
  const result = await db
    .update(userRoleAssignments)
    .set({ isActive: false })
    .where(
      and(
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.roleId, roleId),
        eq(userRoleAssignments.orgId, orgId)
      )
    );
  return (result.rowCount ?? 0) > 0;
}

export async function logPermissionChange(
  orgId: string,
  userId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  previousValue: string | null,
  newValue: string | null,
  ipAddress?: string
): Promise<void> {
  // permission_audit_log table does not exist; emit a structured log entry.
  structuredLog("info", "permission.audit", {
    orgId,
    userId,
    operation: action,
    metadata: {
      targetType,
      targetId: targetId ?? undefined,
      previousValue: previousValue ?? undefined,
      newValue: newValue ?? undefined,
      ipAddress,
    },
  });
}

export async function getPermissionAuditLog(
  orgId: string,
  limit = 100
): Promise<PermissionAuditEntry[]> {
  // Permission and hub-access changes are recorded in the tamper-evident
  // immutable audit trail (eventType "permission_changed") by the grants and
  // hub-access write paths. Read them back so admins can review the history in
  // the unified Roles & Dashboards surface. (There is no separate
  // permission_audit_log table — the immutable trail is the single source.)
  const records = await auditService.queryEvents({
    orgId,
    eventType: "permission_changed",
    limit,
  });
  return records.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    userId: r.performedBy,
    action: r.eventType,
    targetType: r.entityType,
    targetId: r.entityId ?? null,
    previousValue: r.previousState != null ? JSON.stringify(r.previousState) : null,
    newValue: r.newState != null ? JSON.stringify(r.newState) : null,
    ipAddress: r.ipAddress ?? null,
    createdAt: r.eventTimestamp ?? null,
  }));
}

export async function seedDefaultRoleTemplates(): Promise<{ created: number; skipped: number }> {
  // Templates are static config; nothing to seed.
  return { created: 0, skipped: DEFAULT_ROLE_TEMPLATES.length };
}

export async function getCrewCountByRoleId(roleId: string, orgId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(crew)
    .where(and(eq(crew.roleId, roleId), eq(crew.orgId, orgId)));

  return result[0]?.count ?? 0;
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

export const permissionRepository = {
  seedResourcesAndActions,
  seedDefaultRoleTemplates,
  listRoles,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  deleteRole,
  listResources,
  listActions,
  getPermissionGrantsForRole,
  setPermissionGrant,
  bulkSetPermissionGrants,
  listRoleTemplates,
  getRoleTemplateById,
  createRoleTemplate,
  createRoleFromTemplate,
  provisionTemplatesForOrg,
  getOrProvisionRolesForOrg,
  backfillPdmTemplateGrantsForOrg,
  listUserRoleAssignments,
  assignRoleToUser,
  removeRoleFromUser,
  logPermissionChange,
  getPermissionAuditLog,
  getCrewCountByRoleId,
  listUsersWithRoles,
};

// --- Access & dashboards seeding (used by the composition-root seeder) -------
// These hold the raw role/crew queries the boot-time access seeder needs, so
// the composition root depends on this repository rather than the db handle.

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

/** All organizations (id + name) — used by the PdM-permissions backfill script. */
export async function listAllOrganizations(): Promise<{ id: string; name: string }[]> {
  return db.select({ id: organizations.id, name: organizations.name }).from(organizations);
}

// --- Reads for the permissions routes (me / admin diagnostics) ---------------

/** The user's PRIMARY role column (what server-side route guards authorize). */
export async function getUserPrimaryRole(orgId: string, userId: string) {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, userId)))
    .limit(1);
  return row;
}

/** Canonical DB user row used by the permissions self-diagnostic route. */
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

/** Optional 1:1 crew login-account link for a user, if any. */
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
