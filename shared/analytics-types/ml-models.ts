/**
 * ML Model DTOs
 *
 * Types for ML model configuration and performance tracking.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export const mlModelDtoSchema = z.object({
  id: z.string().uuid(),
  modelType: z.enum(["lstm", "random-forest", "xgboost", "ensemble", "isolation-forest"]),
  targetEquipmentType: z.string().nullable(),
  version: z.string(),
  status: z.enum(["active", "training", "testing", "deprecated", "failed"]),
  accuracy: z.number().min(0).max(1).nullable(),
  precision: z.number().min(0).max(1).nullable(),
  recall: z.number().min(0).max(1).nullable(),
  f1Score: z.number().min(0).max(1).nullable(),
  trainingSamples: z.number().int().min(0).nullable(),
  trainingDate: z.coerce.date().nullable(),
  lastUsedDate: z.coerce.date().nullable(),
  hyperparameters: z.record(z.unknown()).optional(),
  featureImportance: z.record(z.number()).optional(),
});

export type MlModelDTO = z.infer<typeof mlModelDtoSchema>;

export const mlModelListResponseSchema = z.object({
  results: z.array(mlModelDtoSchema),
  metadata: listMetadataSchema,
});

export const mlModelResponseSchema = z.object({
  result: mlModelDtoSchema,
  metadata: itemMetadataSchema,
});

export type MlModelListResponse = z.infer<typeof mlModelListResponseSchema>;
export type MlModelResponse = z.infer<typeof mlModelResponseSchema>;

export const modelPerformanceDtoSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  modelType: z.string(),
  recordedAt: z.coerce.date(),
  accuracy: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1Score: z.number().min(0).max(1),
  falsePositiveRate: z.number().min(0).max(1),
  falseNegativeRate: z.number().min(0).max(1),
  predictionCount: z.number().int().min(0),
  evaluationDataset: z.string().optional(),
});

export type ModelPerformanceDTO = z.infer<typeof modelPerformanceDtoSchema>;

export const modelPerformanceHistoryPointSchema = z.object({
  timestamp: z.coerce.date(),
  accuracy: z.number(),
});

export const modelPerformanceSummaryDtoSchema = z.object({
  modelId: z.string().uuid(),
  modelType: z.string(),
  currentAccuracy: z.number().min(0).max(1),
  averageAccuracy: z.number().min(0).max(1),
  accuracyTrend: z.enum(["improving", "stable", "degrading"]),
  predictionVolume: z.number().int(),
  lastEvaluated: z.coerce.date(),
  performanceHistory: z.array(modelPerformanceHistoryPointSchema).optional(),
});

export type ModelPerformanceSummaryDTO = z.infer<typeof modelPerformanceSummaryDtoSchema>;

export const modelPerformanceListResponseSchema = z.object({
  results: z.array(modelPerformanceDtoSchema),
  metadata: listMetadataSchema,
});

export const modelPerformanceSummaryResponseSchema = z.object({
  result: modelPerformanceSummaryDtoSchema,
  metadata: itemMetadataSchema,
});

export type ModelPerformanceListResponse = z.infer<typeof modelPerformanceListResponseSchema>;
export type ModelPerformanceSummaryResponse = z.infer<typeof modelPerformanceSummaryResponseSchema>;
