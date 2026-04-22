import { z } from "zod";

export const bulkSensorConfigItemSchema = z.object({
  sensorType: z.string().min(1, "Sensor type is required"),
  enabled: z.boolean().optional().default(true),
  gain: z.number().optional(),
  offset: z.number().optional(),
  minValid: z.number().optional(),
  maxValid: z.number().optional(),
  warnLo: z.number().optional(),
  warnHi: z.number().optional(),
  critLo: z.number().optional(),
  critHi: z.number().optional(),
});

export const bulkSensorConfigSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  bundleId: z.string().optional(),
  configs: z
    .array(bulkSensorConfigItemSchema)
    .min(1, "At least one sensor configuration is required"),
  overwriteExisting: z.boolean().default(false),
});

export const selectSensorTemplateSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  templateId: z.string(),
  name: z.string(),
  kind: z.string(),
  unit: z.string(),
  equipmentTypes: z.array(z.string()).nullable(),
  fields: z.record(z.any()),
  notes: z.string().nullable(),
  isSystemDefault: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const selectSensorBundleSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  bundleId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  equipmentType: z.string(),
  templateIds: z.array(z.string()),
  isSystemDefault: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type BulkSensorConfigItem = z.infer<typeof bulkSensorConfigItemSchema>;
export type BulkSensorConfigPayload = z.infer<typeof bulkSensorConfigSchema>;
