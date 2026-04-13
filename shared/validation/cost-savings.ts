import { z } from "zod";

export const costSavingsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  category: z.string().optional(),
  equipmentId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const costSavingsSummaryQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const costSavingsTrendQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).optional().default("monthly"),
  months: z.coerce.number().int().min(1).max(24).optional().default(12),
});

export const costSavingsCalculateOptionsSchema = z.object({
  laborRatePerHour: z.number().positive().optional(),
  downtimeCostPerHour: z.number().positive().optional(),
  currency: z.string().optional(),
});

export const downtimeCostValidationSchema = z.object({
  hourlyRate: z.number().positive("Hourly rate must be positive"),
  estimatedDuration: z.number().positive("Duration must be positive"),
  actualDuration: z.number().positive().optional(),
});
