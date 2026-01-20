/**
 * Anomaly Detection DTOs
 *
 * Types for anomaly detection results.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export const anomalyDetectionDtoSchema = z.object({
  id: z.string().uuid(),
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  sensorType: z.string(),
  detectedAt: z.coerce.date(),
  anomalyType: z.enum(["statistical", "pattern", "trend", "seasonal", "threshold"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  anomalyScore: z.number().min(0).max(1),
  currentValue: z.number(),
  expectedValue: z.number(),
  deviation: z.number(),
  contributingFactors: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  acknowledged: z.boolean(),
  acknowledgedBy: z.string().nullable(),
  acknowledgedAt: z.coerce.date().nullable(),
  explanation: z.string().optional(),
});

export type AnomalyDetectionDTO = z.infer<typeof anomalyDetectionDtoSchema>;

export const anomalyDetectionListResponseSchema = z.object({
  results: z.array(anomalyDetectionDtoSchema),
  metadata: listMetadataSchema.extend({
    unacknowledgedCount: z.number().int(),
    criticalCount: z.number().int(),
  }),
});

export const anomalyDetectionResponseSchema = z.object({
  result: anomalyDetectionDtoSchema,
  metadata: itemMetadataSchema,
});

export type AnomalyDetectionListResponse = z.infer<typeof anomalyDetectionListResponseSchema>;
export type AnomalyDetectionResponse = z.infer<typeof anomalyDetectionResponseSchema>;
