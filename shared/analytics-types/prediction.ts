/**
 * Failure & Real-Time Prediction DTOs
 *
 * Types for failure predictions and real-time prediction results.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export const maintenanceRecommendationSchema = z.object({
  action: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  estimatedCost: z.number().optional(),
  estimatedDuration: z.number().optional(),
});

export const costImpactSchema = z.object({
  estimatedRepairCost: z.number(),
  estimatedDowntime: z.number(),
  revenueImpact: z.number(),
});

export const failurePredictionDtoSchema = z.object({
  id: z.string().uuid(),
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  equipmentType: z.string(),
  predictionDate: z.coerce.date(),
  failureProbability: z.number().min(0).max(1),
  predictedFailureDate: z.coerce.date().nullable(),
  remainingUsefulLife: z.number().int().min(0),
  confidenceInterval: z.object({
    lower: z.number(),
    upper: z.number(),
  }),
  failureMode: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  maintenanceRecommendations: z.array(maintenanceRecommendationSchema),
  costImpact: costImpactSchema,
  modelUsed: z.string(),
  modelConfidence: z.number().min(0).max(1),
});

export type FailurePredictionDTO = z.infer<typeof failurePredictionDtoSchema>;

export const failurePredictionListResponseSchema = z.object({
  results: z.array(failurePredictionDtoSchema),
  metadata: listMetadataSchema.extend({
    highRiskCount: z.number().int(),
    criticalRiskCount: z.number().int(),
  }),
});

export const failurePredictionResponseSchema = z.object({
  result: failurePredictionDtoSchema,
  metadata: itemMetadataSchema,
});

export type FailurePredictionListResponse = z.infer<typeof failurePredictionListResponseSchema>;
export type FailurePredictionResponse = z.infer<typeof failurePredictionResponseSchema>;

export const realtimePredictionDetailSchema = z.object({
  metric: z.string(),
  currentValue: z.number(),
  threshold: z.number(),
  trend: z.enum(["improving", "stable", "degrading"]),
});

export const realtimePredictionDtoSchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentName: z.string(),
  predictionType: z.enum(["failure", "anomaly", "degradation", "performance"]),
  value: z.number(),
  confidence: z.number().min(0).max(1),
  status: z.enum(["normal", "warning", "critical", "urgent"]),
  updatedAt: z.coerce.date(),
  details: realtimePredictionDetailSchema,
});

export type RealtimePredictionDTO = z.infer<typeof realtimePredictionDtoSchema>;

export const realtimePredictionListResponseSchema = z.object({
  results: z.array(realtimePredictionDtoSchema),
  metadata: listMetadataSchema.extend({
    totalActive: z.number().int(),
    warningCount: z.number().int(),
    criticalCount: z.number().int(),
    urgentCount: z.number().int(),
  }),
});

export type RealtimePredictionListResponse = z.infer<typeof realtimePredictionListResponseSchema>;
