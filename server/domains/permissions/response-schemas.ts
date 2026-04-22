import { z } from "zod";

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
