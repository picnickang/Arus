/**
 * Permissions Contract Mapper
 *
 * Pure mapping from compileUserPermissions() output (internal shape) to the
 * client contract used by PermissionsContext and validated by
 * permissionsMeResponseSchema.
 *
 * Internal shape:
 *   { userId, orgId, roles: string[] (role IDs),
 *     grants: { resource: { action: { allowed, conditions } } } }
 *
 * Contract shape:
 *   { userId, orgId, roles: { id, name, displayName }[],
 *     permissions: { resource: { action: boolean } } }
 */

export interface CompiledPermissionsInput {
  userId: string;
  orgId: string;
  roles: string[];
  grants: Record<string, Record<string, { allowed: boolean; conditions?: unknown } | undefined>>;
}

export interface RoleMetadata {
  id: string;
  name: string;
  displayName: string;
}

export interface MappedPermissionsOutput {
  userId: string;
  orgId: string;
  roles: RoleMetadata[];
  permissions: Record<string, Record<string, boolean>>;
}

export interface MapperLogger {
  warn: (message: string, context?: Record<string, unknown>) => void;
}

export function mapCompiledToContract(
  compiled: CompiledPermissionsInput,
  orgRoles: ReadonlyArray<RoleMetadata>,
  logger?: MapperLogger
): MappedPermissionsOutput {
  const roleById = new Map(
    orgRoles.map((r) => [r.id, { id: r.id, name: r.name, displayName: r.displayName }])
  );

  const roles: RoleMetadata[] = [];
  const missingRoleIds: string[] = [];
  for (const roleId of compiled.roles) {
    const role = roleById.get(roleId);
    if (role) {
      roles.push(role);
    } else {
      missingRoleIds.push(roleId);
    }
  }

  if (missingRoleIds.length > 0 && logger) {
    logger.warn(
      "compileUserPermissions returned role IDs not found in org roles — possible data drift",
      {
        operation: "permissions_mapper",
        metadata: {
          userId: compiled.userId,
          orgId: compiled.orgId,
          missingRoleIds,
        },
      }
    );
  }

  const permissions: Record<string, Record<string, boolean>> = {};
  for (const [resource, actions] of Object.entries(compiled.grants)) {
    permissions[resource] = {};
    for (const [action, grant] of Object.entries(actions)) {
      permissions[resource][action] = grant?.allowed === true;
    }
  }

  return {
    userId: compiled.userId,
    orgId: compiled.orgId,
    roles,
    permissions,
  };
}
