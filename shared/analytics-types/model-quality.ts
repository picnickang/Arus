/**
 * Model Drift & Quality DTOs
 *
 * Types for model drift detection and retraining queue.
 */

import { z } from "zod";
import { listMetadataSchema } from "./metadata";

export const modelDriftDtoSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  modelType: z.string(),
  detectedAt: z.coerce.date(),
  driftScore: z.number().min(0).max(1),
  driftType: z.enum(["data", "concept", "performance"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  affectedFeatures: z.array(z.string()),
  performanceDegradation: z.number(),
  recommendedAction: z.enum(["monitor", "retrain", "replace", "urgent_retrain"]),
  explanation: z.string(),
});

export type ModelDriftDTO = z.infer<typeof modelDriftDtoSchema>;

export const modelDriftListResponseSchema = z.object({
  results: z.array(modelDriftDtoSchema),
  metadata: listMetadataSchema.extend({
    criticalCount: z.number().int(),
  }),
});

export type ModelDriftListResponse = z.infer<typeof modelDriftListResponseSchema>;

export const retrainingQueueItemDtoSchema = z.object({
  modelId: z.string().uuid(),
  modelType: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  reason: z.enum(["drift", "performance", "scheduled", "new_data"]),
  queuedAt: z.coerce.date(),
  estimatedTrainingTime: z.number(),
  status: z.enum(["queued", "in_progress", "completed", "failed"]),
});

export type RetrainingQueueItemDTO = z.infer<typeof retrainingQueueItemDtoSchema>;

export const retrainingQueueResponseSchema = z.object({
  results: z.array(retrainingQueueItemDtoSchema),
  metadata: listMetadataSchema.extend({
    queueLength: z.number().int(),
    inProgressCount: z.number().int(),
  }),
});

export type RetrainingQueueResponse = z.infer<typeof retrainingQueueResponseSchema>;
