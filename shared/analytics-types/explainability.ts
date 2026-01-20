/**
 * Explainability DTOs
 *
 * Types for ML prediction explainability and feature importance.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export const featureContributionSchema = z.object({
  featureName: z.string(),
  value: z.number(),
  shapValue: z.number(),
  contribution: z.enum(["positive", "negative", "neutral"]),
  importance: z.number().min(0).max(1),
});

export const topFactorSchema = z.object({
  feature: z.string(),
  impact: z.number(),
  explanation: z.string(),
});

export const predictionExplainabilityDtoSchema = z.object({
  predictionId: z.string().uuid(),
  equipmentId: z.string().uuid(),
  modelId: z.string().uuid(),
  predictionValue: z.number(),
  baseValue: z.number(),
  featureContributions: z.array(featureContributionSchema),
  topPositiveFactors: z.array(topFactorSchema),
  topNegativeFactors: z.array(topFactorSchema),
  humanReadableExplanation: z.string(),
  confidence: z.number().min(0).max(1),
});

export type PredictionExplainabilityDTO = z.infer<typeof predictionExplainabilityDtoSchema>;

export const predictionExplainabilityResponseSchema = z.object({
  result: predictionExplainabilityDtoSchema,
  metadata: itemMetadataSchema.extend({
    computationTime: z.number(),
  }),
});

export type PredictionExplainabilityResponse = z.infer<
  typeof predictionExplainabilityResponseSchema
>;

export const featureImportanceDtoSchema = z.object({
  featureName: z.string(),
  importance: z.number().min(0).max(1),
  modelType: z.string(),
  equipmentType: z.string().optional(),
});

export const featureImportanceListResponseSchema = z.object({
  results: z.array(featureImportanceDtoSchema),
  metadata: listMetadataSchema.extend({
    modelId: z.string().uuid().optional(),
  }),
});

export type FeatureImportanceDTO = z.infer<typeof featureImportanceDtoSchema>;
export type FeatureImportanceListResponse = z.infer<typeof featureImportanceListResponseSchema>;
