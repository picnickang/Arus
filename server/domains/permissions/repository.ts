/**
 * Permission Repository - Database Operations
 * 
 * CRUD operations for roles, permissions, and user role assignments.
 */

import { db } from "../../db";
import { eq, and, sql, count } from "drizzle-orm";
import { crew } from "../../../shared/schema/crew";
import { users } from "../../../shared/schema/core";
import {
  roles,
  permissionResources,
  permissionActions,
  resourceActions,
  permissionGrants,
  roleTemplates,
  userRoleAssignments,
  permissionAuditLog,
  type Role,
  type InsertRole,
  type PermissionResource,
  type PermissionAction,
  type PermissionGrant,
  type InsertPermissionGrant,
  type RoleTemplate,
  type InsertRoleTemplate,
  type UserRoleAssignment,
  type InsertUserRoleAssignment,
} from "../../../shared/schema/permissions";
import { RESOURCES, ACTIONS } from "../../config/permission-registry";
import { DEFAULT_ROLE_TEMPLATES } from "../../config/default-role-templates";

export async function seedResourcesAndActions(): Promise<void> {
  for (const resource of RESOURCES) {
    const existing = await db
      .select()
      .from(permissionResources)
      .where(eq(permissionResources.code, resource.code))
      .limit(1);

    let resourceId: string;

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(permissionResources)
        .values({
          code: resource.code,
          name: resource.name,
          description: resource.description,
          category: resource.category,
          icon: resource.icon,
          sortOrder: resource.sortOrder,
          isActive: true,
        })
        .returning({ id: permissionResources.id });
      resourceId = inserted.id;
    } else {
      resourceId = existing[0].id;
      await db
        .update(permissionResources)
        .set({
          name: resource.name,
          description: resource.description,
          category: resource.category,
          icon: resource.icon,
          sortOrder: resource.sortOrder,
        })
        .where(eq(permissionResources.id, resourceId));
    }

    for (const actionCode of resource.actions) {
      const actionDef = ACTIONS[actionCode];

      let actionId: string;
      const existingAction = await db
        .select()
        .from(permissionActions)
        .where(eq(permissionActions.code, actionDef.code))
        .limit(1);

      if (existingAction.length === 0) {
        const [insertedAction] = await db
          .insert(permissionActions)
          .values({
            code: actionDef.code,
            name: actionDef.name,
            description: actionDef.description,
            riskLevel: actionDef.riskLevel,
            sortOrder: actionDef.sortOrder,
          })
          .returning({ id: permissionActions.id });
        actionId = insertedAction.id;
      } else {
        actionId = existingAction[0].id;
      }

      const existingLink = await db
        .select()
        .from(resourceActions)
        .where(
          and(eq(resourceActions.resourceId, resourceId), eq(resourceActions.actionId, actionId))
        )
        .limit(1);

      if (existingLink.length === 0) {
        await db.insert(resourceActions).values({
          resourceId,
          actionId,
          isDefault: actionCode === "view",
        });
      }
    }
  }
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
  return role;
}

export async function updateRole(
  id: string,
  orgId: string,
  data: Partial<InsertRole>
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
  return db
    .select()
    .from(permissionResources)
    .where(eq(permissionResources.isActive, true))
    .orderBy(permissionResources.sortOrder);
}

export async function listActions(): Promise<PermissionAction[]> {
  return db.select().from(permissionActions).orderBy(permissionActions.sortOrder);
}

export async function getPermissionGrantsForRole(
  roleId: string
): Promise<PermissionGrant[]> {
  return db
    .select()
    .from(permissionGrants)
    .where(eq(permissionGrants.roleId, roleId));
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

  if (existing.length > 0) {
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
  return db
    .select()
    .from(roleTemplates)
    .where(eq(roleTemplates.isActive, true))
    .orderBy(roleTemplates.hierarchyLevel);
}

export async function getRoleTemplateById(id: string): Promise<RoleTemplate | undefined> {
  const [template] = await db
    .select()
    .from(roleTemplates)
    .where(eq(roleTemplates.id, id))
    .limit(1);
  return template;
}

export async function createRoleTemplate(data: InsertRoleTemplate): Promise<RoleTemplate> {
  const [template] = await db.insert(roleTemplates).values(data).returning();
  return template;
}

export async function createRoleFromTemplate(
  templateId: string,
  orgId: string,
  overrides?: Partial<InsertRole>
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

export async function assignRoleToUser(data: InsertUserRoleAssignment): Promise<UserRoleAssignment> {
  const [assignment] = await db.insert(userRoleAssignments).values(data).returning();
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
  await db.insert(permissionAuditLog).values({
    orgId,
    userId,
    action,
    targetType,
    targetId,
    previousValue,
    newValue,
    ipAddress,
  });
}

export async function getPermissionAuditLog(
  orgId: string,
  limit = 100
): Promise<Array<typeof permissionAuditLog.$inferSelect>> {
  return db
    .select()
    .from(permissionAuditLog)
    .where(eq(permissionAuditLog.orgId, orgId))
    .orderBy(sql`${permissionAuditLog.createdAt} DESC`)
    .limit(limit);
}

export async function seedDefaultRoleTemplates(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const template of DEFAULT_ROLE_TEMPLATES) {
    const existing = await db
      .select()
      .from(roleTemplates)
      .where(eq(roleTemplates.name, template.name))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(roleTemplates).values({
      name: template.name,
      displayName: template.displayName,
      description: template.description,
      department: template.department,
      hierarchyLevel: template.hierarchyLevel,
      permissions: JSON.stringify(template.permissions),
      isActive: true,
    });
    created++;
  }

  return { created, skipped };
}

export async function getCrewCountByRoleId(roleId: string, orgId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(crew)
    .where(and(eq(crew.roleId, roleId), eq(crew.orgId, orgId)));
  
  return result[0]?.count ?? 0;
}

export async function listUsersWithRoles(orgId: string): Promise<Array<{
  id: string;
  name: string | null;
  email: string | null;
  roles: Array<{ roleId: string; roleName: string; assignedAt: string }>;
}>> {
  const assignments = await db
    .select({
      userId: userRoleAssignments.userId,
      roleId: userRoleAssignments.roleId,
      roleName: roles.displayName,
      assignedAt: userRoleAssignments.assignedAt,
    })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(
      and(
        eq(userRoleAssignments.orgId, orgId),
        eq(userRoleAssignments.isActive, true)
      )
    );

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

  const userMap = new Map<string, {
    id: string;
    name: string | null;
    email: string | null;
    roles: Array<{ roleId: string; roleName: string; assignedAt: string }>;
  }>();

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

  for (const assignment of assignments) {
    const user = userMap.get(assignment.userId);
    if (user) {
      user.roles.push({
        roleId: assignment.roleId,
        roleName: assignment.roleName,
        assignedAt: assignment.assignedAt?.toISOString() ?? new Date().toISOString(),
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
  listUserRoleAssignments,
  assignRoleToUser,
  removeRoleFromUser,
  logPermissionChange,
  getPermissionAuditLog,
  getCrewCountByRoleId,
  listUsersWithRoles,
};
