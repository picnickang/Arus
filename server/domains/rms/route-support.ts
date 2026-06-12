import type { Request } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { authenticatedRequest } from "../../middleware/auth";

export const hoursQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});
export const daysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
});
export const vesselIdParamSchema = z.object({ vesselId: z.string().min(1) });
export const idParamSchema = z.object({ id: z.string().min(1) });
export const bunkeringQuerySchema = z.object({
  vesselId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export const vesselIdOptQuerySchema = z.object({ vesselId: z.string().optional() });
export const alertsQuerySchema = z.object({
  vesselId: z.string().optional(),
  acknowledged: z.enum(["true", "false"]).optional(),
  days: z.coerce.number().int().min(1).max(90).default(7),
});
export const acknowledgeBodySchema = z.object({ acknowledgedBy: z.string().optional() });
export const createAlertConfigSchema = z.object({
  vesselId: z.string().min(1),
  alertType: z.enum(["fuel_threshold", "daily_consumption", "geofence", "bunkering"]),
  name: z.string().min(1),
  config: z.record(z.any()),
  notifyEmail: z.boolean().default(true),
  notifyInApp: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(1).default(60),
});
export const alertConfigPatchBodySchema = z.object({
  name: z.string().optional(),
  config: jsonRecordSchema.optional(),
  enabled: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
  cooldownMinutes: z.number().int().optional(),
});

export type Row = Record<string, unknown>;

export function getOrgId(req: Request): string {
  return authenticatedRequest(req).orgId as string;
}

export function getRows(result: unknown): Row[] {
  if (Array.isArray(result)) {
    return result as Row[];
  }
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Row[] }).rows;
  }
  return [];
}

export function getFirstRow(result: unknown): Row | undefined {
  return getRows(result)[0];
}
