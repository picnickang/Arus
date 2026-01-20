/**
 * Equipment Analytics DTOs
 *
 * Types for equipment health, RUL predictions, and sensor coverage.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export const equipmentHealthDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  vesselId: z.string().uuid().nullable(),
  vesselName: z.string().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor", "critical"]),
  healthScore: z.number().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  lastMaintenanceDate: z.coerce.date().nullable(),
  nextMaintenanceDate: z.coerce.date().nullable(),
  alertCount: z.number().int().min(0),
  operatingHours: z.number().min(0),
  telemetryStatus: z.enum(["active", "stale", "offline"]).optional(),
});

export type EquipmentHealthDTO = z.infer<typeof equipmentHealthDtoSchema>;

export const equipmentHealthResponseSchema = z.object({
  results: z.array(equipmentHealthDtoSchema),
  metadata: listMetadataSchema,
});

export type EquipmentHealthResponse = z.infer<typeof equipmentHealthResponseSchema>;

export const contributingFactorSchema = z.object({
  factor: z.string(),
  weight: z.number().min(0).max(1),
  impact: z.enum(["positive", "negative", "neutral"]),
});

export const rulPredictionDtoSchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  remainingDays: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  dataQuality: z.number().min(0).max(1),
  predictionDate: z.coerce.date(),
  methodology: z.enum(["physics-based", "ml-hybrid", "statistical", "degradation-model"]),
  contributingFactors: z.array(contributingFactorSchema).optional(),
  maintenanceRecommendations: z.array(z.string()).optional(),
});

export type RulPredictionDTO = z.infer<typeof rulPredictionDtoSchema>;

export const rulPredictionResponseSchema = z.object({
  result: rulPredictionDtoSchema,
  metadata: itemMetadataSchema.extend({
    calculationTime: z.number().optional(),
  }),
});

export const rulBatchResponseSchema = z.object({
  results: z.array(rulPredictionDtoSchema),
  metadata: listMetadataSchema.extend({
    requestedCount: z.number().int(),
    successCount: z.number().int(),
    failedCount: z.number().int(),
  }),
});

export type RulPredictionResponse = z.infer<typeof rulPredictionResponseSchema>;
export type RulBatchResponse = z.infer<typeof rulBatchResponseSchema>;

export const missingSensorSchema = z.object({
  sensorType: z.string(),
  importance: z.enum(["critical", "recommended", "optional"]),
  reason: z.string(),
});

export const inactiveSensorSchema = z.object({
  sensorId: z.string().uuid(),
  sensorType: z.string(),
  lastDataReceived: z.coerce.date().nullable(),
});

export const sensorCoverageDtoSchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentType: z.string(),
  totalSensorsExpected: z.number().int(),
  sensorsConfigured: z.number().int(),
  sensorsActive: z.number().int(),
  coveragePercentage: z.number().min(0).max(100),
  missingSensors: z.array(missingSensorSchema),
  inactiveSensors: z.array(inactiveSensorSchema),
  recommendations: z.array(z.string()),
});

export type SensorCoverageDTO = z.infer<typeof sensorCoverageDtoSchema>;

export const sensorCoverageResponseSchema = z.object({
  result: sensorCoverageDtoSchema,
  metadata: itemMetadataSchema,
});

export type SensorCoverageResponse = z.infer<typeof sensorCoverageResponseSchema>;
