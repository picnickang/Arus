import type { Express } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";

export type { Express, Request, Response };

export interface ThresholdCalibrator {
  calibrateForEquipment: (orgId: string, equipmentId: string) => Promise<Record<string, unknown>>;
}

export interface SystemAdminDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: (req: unknown, res: unknown, next: () => void) => void;
  auditAdminAction: (action: string) => (req: unknown, res: unknown, next: () => void) => void;
  thresholdCalibrator: ThresholdCalibrator;
  adminPasswordVerifySchema: z.ZodSchema;
  adminPasswordChangeSchema: z.ZodSchema;
  insertAdminAuditEventSchema: z.ZodSchema;
  insertAdminSystemSettingSchema: z.ZodSchema;
  insertIntegrationConfigSchema: z.ZodSchema;
  insertMaintenanceWindowSchema: z.ZodSchema;
  insertSystemPerformanceMetricSchema: z.ZodSchema;
  AdminSessionResponse: z.ZodSchema;
}

export { z };
