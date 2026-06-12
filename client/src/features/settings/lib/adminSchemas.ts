import { z } from "zod";

export const publishPatchSchema = z.object({
  fromVersion: z.string().min(1, "From version is required (e.g., 1.0)"),
  version: z.string().min(1, "Version is required (e.g., 1.1)"),
  severity: z.enum(["critical", "high", "medium", "low"]),
  releaseNotes: z.string().min(10, "Release notes must be at least 10 characters"),
  channel: z.enum(["stable", "beta", "alpha"]).default("stable"),
  requiresRestart: z.boolean().default(true),
  patchType: z.enum(["incremental", "full"]).default("incremental"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export interface IntegrationConfigForm {
  orgId: string;
  integrationType: string;
  name: string;
  config: string;
  isActive: boolean;
}
export interface MaintenanceWindowForm {
  orgId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}
export interface HealthCheckForm {
  orgId: string;
  name: string;
  description?: string;
  endpoint: string;
  expectedStatus: number;
  timeoutMs: number;
  isActive: boolean;
}
export type PublishPatchForm = z.infer<typeof publishPatchSchema>;
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const CHANNEL_OPTIONS = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta" },
  { value: "alpha", label: "Alpha" },
] as const;

export const PATCH_TYPE_OPTIONS = [
  { value: "incremental", label: "Incremental" },
  { value: "full", label: "Full" },
] as const;

export function createDefaultIntegrationConfig(): IntegrationConfigForm {
  return {
    orgId: "",
    integrationType: "",
    name: "",
    config: "",
    isActive: true,
  };
}

export function createDefaultMaintenanceWindow(): MaintenanceWindowForm {
  return {
    orgId: "",
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    isActive: true,
  };
}

export function createDefaultHealthCheck(): HealthCheckForm {
  return {
    orgId: "",
    name: "",
    description: "",
    endpoint: "",
    expectedStatus: 200,
    timeoutMs: 5000,
    isActive: true,
  };
}

export function createDefaultPublishPatch(): PublishPatchForm {
  return {
    fromVersion: "",
    version: "",
    severity: "medium",
    releaseNotes: "",
    channel: "stable",
    requiresRestart: true,
    patchType: "incremental",
  };
}
