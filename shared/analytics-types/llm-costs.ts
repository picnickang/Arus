/**
 * LLM Cost Tracking DTOs
 *
 * Types for LLM usage and cost tracking.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export const llmCostDtoSchema = z.object({
  id: z.string().uuid(),
  model: z.string(),
  operation: z.string(),
  tokensUsed: z.number().int().min(0),
  costUsd: z.number().min(0),
  timestamp: z.coerce.date(),
  equipmentId: z.string().uuid().optional(),
  reportType: z.string().optional(),
});

export type LlmCostDTO = z.infer<typeof llmCostDtoSchema>;

export const llmCostSummaryDtoSchema = z.object({
  totalCost: z.number().min(0),
  totalTokens: z.number().int().min(0),
  totalRequests: z.number().int().min(0),
  averageCostPerRequest: z.number().min(0),
  costByModel: z.record(z.number()),
  costByOperation: z.record(z.number()),
});

export const llmCostListResponseSchema = z.object({
  results: z.array(llmCostDtoSchema),
  metadata: listMetadataSchema,
});

export const llmCostSummaryResponseSchema = z.object({
  result: llmCostSummaryDtoSchema,
  metadata: itemMetadataSchema.extend({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
  }),
});

export type LlmCostListResponse = z.infer<typeof llmCostListResponseSchema>;
export type LlmCostSummaryDTO = z.infer<typeof llmCostSummaryDtoSchema>;
export type LlmCostSummaryResponse = z.infer<typeof llmCostSummaryResponseSchema>;
