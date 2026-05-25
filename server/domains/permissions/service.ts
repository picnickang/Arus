/**
 * Permission Service - Authorization Logic with Caching
 *
 * Provides permission checking with in-memory caching for performance.
 * Compiles user permissions into a matrix for fast lookups.
 */

import { db } from "../../db";
import { eq, and, inArray } from "drizzle-orm";
import {
  permissionGrants,
  userRoleAssignments,
  type CompiledPermissions,
  type PermissionCheckResult,
} from "../../../shared/schema/permissions";
import { RESOURCES, ACTIONS, type ActionCode } from "../../config/permission-registry";

const CACHE_TTL_MS = 5 * 60 * 1000;
const permissionCache = new Map<string, { data: CompiledPermissions; expiresAt: number }>();

function getCacheKey(userId: string, orgId: string): string {
  return `${orgId}:${userId}`;
}

export async function getUserRoles(userId: string, orgId: string): Promise<string[]> {
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

export async function compileUserPermissions(
  userId: string,
  orgId: string
): Promise<CompiledPermissions> {
  const cacheKey = getCacheKey(userId, orgId);
  const cached = permissionCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const roleIds = await getUserRoles(userId, orgId);

  if (roleIds.length === 0) {
    const emptyPermissions: CompiledPermissions = {
      userId,
      orgId,
      roles: [],
      grants: {},
      compiledAt: new Date(),
    };
    permissionCache.set(cacheKey, { data: emptyPermissions, expiresAt: Date.now() + CACHE_TTL_MS });
    return emptyPermissions;
  }

  // permission_resources/permission_actions tables do not exist in PostgreSQL;
  // resource_code and action_code are stored as text directly on
  // permission_grants and validated against the static registry at use time.
  const grants = await db
    .select({
      resourceCode: permissionGrants.resourceCode,
      actionCode: permissionGrants.actionCode,
      isGranted: permissionGrants.isGranted,
      condition: permissionGrants.condition,
    })
    .from(permissionGrants)
    .where(inArray(permissionGrants.roleId, roleIds));

  const grantMatrix: CompiledPermissions["grants"] = {};

  for (const grant of grants) {
    if (!grantMatrix[grant.resourceCode]) {
      grantMatrix[grant.resourceCode] = {};
    }
    if (grant.isGranted) {
      grantMatrix[grant.resourceCode]![grant.actionCode] = {
        allowed: true,
        conditions: grant.condition || undefined,
      };
    }
  }

  const compiled: CompiledPermissions = {
    userId,
    orgId,
    roles: roleIds,
    grants: grantMatrix,
    compiledAt: new Date(),
  };

  permissionCache.set(cacheKey, { data: compiled, expiresAt: Date.now() + CACHE_TTL_MS });

  return compiled;
}

const DEV_MODE = process.env['NODE_ENV'] === "development";
const DEV_USER_ID = "dev-user-id";
const DEV_ADMIN_USER_ID = "dev-admin-user";

export async function authorize(
  userId: string,
  orgId: string,
  resource: string,
  action: ActionCode
): Promise<PermissionCheckResult> {
  if (DEV_MODE && (userId === DEV_USER_ID || userId === DEV_ADMIN_USER_ID)) {
    return {
      allowed: true,
      resource,
      action,
      reason: "Dev mode: all permissions granted",
    };
  }

  const permissions = await compileUserPermissions(userId, orgId);

  const resourceGrants = permissions.grants[resource];
  if (!resourceGrants) {
    return {
      allowed: false,
      resource,
      action,
      reason: `No permissions found for resource: ${resource}`,
    };
  }

  const actionGrant = resourceGrants[action];
  if (!actionGrant || !actionGrant.allowed) {
    return {
      allowed: false,
      resource,
      action,
      reason: `Action '${action}' not permitted on resource '${resource}'`,
    };
  }

  return {
    allowed: true,
    resource,
    action,
    conditions: actionGrant.conditions,
  };
}

export function invalidateUserPermissionCache(userId: string, orgId: string): void {
  const cacheKey = getCacheKey(userId, orgId);
  permissionCache.delete(cacheKey);
}

export function invalidateOrgPermissionCache(orgId: string): void {
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${orgId}:`)) {
      permissionCache.delete(key);
    }
  }
}

export function clearPermissionCache(): void {
  permissionCache.clear();
}

export async function hasPermission(
  userId: string,
  orgId: string,
  resource: string,
  action: ActionCode
): Promise<boolean> {
  const result = await authorize(userId, orgId, resource, action);
  return result.allowed;
}

export async function hasAnyPermission(
  userId: string,
  orgId: string,
  resource: string,
  actions: ActionCode[]
): Promise<boolean> {
  for (const action of actions) {
    if (await hasPermission(userId, orgId, resource, action)) {
      return true;
    }
  }
  return false;
}

export async function hasAllPermissions(
  userId: string,
  orgId: string,
  checks: Array<{ resource: string; action: ActionCode }>
): Promise<boolean> {
  for (const check of checks) {
    if (!(await hasPermission(userId, orgId, check.resource, check.action))) {
      return false;
    }
  }
  return true;
}

export async function getResourcePermissions(
  userId: string,
  orgId: string,
  resource: string
): Promise<Record<string, boolean>> {
  const permissions = await compileUserPermissions(userId, orgId);
  const resourceDef = RESOURCES.find((r) => r.code === resource);
  if (!resourceDef) {
    return {};
  }

  const result: Record<string, boolean> = {};
  for (const actionCode of resourceDef.actions) {
    const grant = permissions.grants[resource]?.[actionCode];
    result[actionCode] = grant?.allowed ?? false;
  }
  return result;
}

export async function getAllUserPermissions(
  userId: string,
  orgId: string
): Promise<Record<string, Record<string, boolean>>> {
  const permissions = await compileUserPermissions(userId, orgId);

  const result: Record<string, Record<string, boolean>> = {};

  for (const resource of RESOURCES) {
    result[resource.code] = {};
    for (const actionCode of resource.actions) {
      const grant = permissions.grants[resource.code]?.[actionCode];
      result[resource.code]![actionCode] = grant?.allowed ?? false;
    }
  }

  return result;
}

export function getActionDefinition(code: ActionCode) {
  return ACTIONS[code];
}

export function getResourceDefinitions() {
  return RESOURCES;
}

export const permissionService = {
  authorize,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserRoles,
  compileUserPermissions,
  getResourcePermissions,
  getAllUserPermissions,
  invalidateUserPermissionCache,
  invalidateOrgPermissionCache,
  clearPermissionCache,
  getActionDefinition,
  getResourceDefinitions,
};
