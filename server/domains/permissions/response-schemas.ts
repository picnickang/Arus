import { z } from "zod";

const isoOrDateSchema = z.union([z.date(), z.string().datetime({ offset: true })]);

const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
});

export const permissionsMeResponseSchema = z.object({
  userId: z.string(),
  orgId: z.string(),
  roles: z.array(roleSchema),
  permissions: z.record(z.string(), z.record(z.string(), z.boolean())),
  isDevMode: z.boolean(),
});

export type PermissionsMeResponse = z.infer<typeof permissionsMeResponseSchema>;

// ============================================================================
// Reference catalog responses
// ============================================================================
// These cover the "list/get" endpoints in routes.ts that previously returned
// raw repository rows without an outbound contract. Schemas are intentionally
// permissive (`.passthrough()`, `.optional()`) so they catch obvious shape
// drift without forcing every nullable column to be enumerated.

const permissionResourceSchema = z
  .object({
    id: z.string().or(z.number()).optional(),
    code: z.string(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

export const permissionResourcesResponseSchema = z.array(permissionResourceSchema);

const permissionActionSchema = z
  .object({
    id: z.string().or(z.number()).optional(),
    code: z.string(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

export const permissionActionsResponseSchema = z.array(permissionActionSchema);

export const permissionRegistryResponseSchema = z.object({
  resources: z.array(z.unknown()),
  actions: z.array(z.unknown()),
  categories: z.array(z.unknown()).or(z.record(z.unknown())),
});

const roleRowSchema = z
  .object({
    id: z.string(),
    orgId: z.string().nullable().optional(),
    name: z.string(),
    displayName: z.string(),
    description: z.string().nullable().optional(),
    isSystemRole: z.boolean().nullable().optional(),
    createdAt: isoOrDateSchema.nullable().optional(),
    updatedAt: isoOrDateSchema.nullable().optional(),
  })
  .passthrough();

export const roleListResponseSchema = z.array(roleRowSchema);
export const roleGetResponseSchema = roleRowSchema;

const permissionGrantSchema = z
  .object({
    id: z.string().or(z.number()).optional(),
    roleId: z.string(),
    resourceCode: z.string().optional(),
    actionCode: z.string().optional(),
    isGranted: z.boolean().optional(),
  })
  .passthrough();

export const roleGrantsResponseSchema = z.array(permissionGrantSchema);

const roleTemplateSchema = z
  .object({
    id: z.string().or(z.number()).optional(),
    code: z.string().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

export const roleTemplatesResponseSchema = z.array(roleTemplateSchema);

const userWithRolesSchema = z
  .object({
    id: z.string(),
    email: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    roles: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const usersWithRolesResponseSchema = z.array(userWithRolesSchema);

const auditEntrySchema = z
  .object({
    id: z.string().or(z.number()).optional(),
    orgId: z.string().nullable().optional(),
    actorUserId: z.string().nullable().optional(),
    action: z.string(),
    targetType: z.string().nullable().optional(),
    targetId: z.string().nullable().optional(),
    createdAt: isoOrDateSchema.nullable().optional(),
  })
  .passthrough();

export const permissionAuditResponseSchema = z.array(auditEntrySchema);

const userRoleAssignmentSchema = z
  .object({
    id: z.string().or(z.number()).optional(),
    userId: z.string(),
    roleId: z.string(),
    orgId: z.string().nullable().optional(),
    assignedBy: z.string().nullable().optional(),
    assignedAt: isoOrDateSchema.nullable().optional(),
  })
  .passthrough();

export const userRoleAssignmentsResponseSchema = z.array(userRoleAssignmentSchema);
