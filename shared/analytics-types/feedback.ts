/**
 * Prediction Feedback DTOs
 *
 * Types for prediction feedback and accuracy tracking.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export const predictionFeedbackDtoSchema = z.object({
  id: z.string().uuid(),
  predictionId: z.string().uuid(),
  equipmentId: z.string().uuid(),
  feedbackType: z.enum(["accurate", "inaccurate", "false_positive", "false_negative"]),
  actualOutcome: z.string().optional(),
  userComments: z.string().optional(),
  submittedBy: z.string(),
  submittedAt: z.coerce.date(),
  verifiedAt: z.coerce.date().nullable(),
});

export type PredictionFeedbackDTO = z.infer<typeof predictionFeedbackDtoSchema>;

export const predictionFeedbackListResponseSchema = z.object({
  results: z.array(predictionFeedbackDtoSchema),
  metadata: listMetadataSchema,
});

export const predictionFeedbackSummaryDtoSchema = z.object({
  totalFeedback: z.number().int(),
  accurateCount: z.number().int(),
  inaccurateCount: z.number().int(),
  accuracyRate: z.number().min(0).max(1),
  feedbackByType: z.record(z.number()),
});

export const predictionFeedbackSummaryResponseSchema = z.object({
  result: predictionFeedbackSummaryDtoSchema,
  metadata: itemMetadataSchema.extend({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
  }),
});

export type PredictionFeedbackListResponse = z.infer<typeof predictionFeedbackListResponseSchema>;
export type PredictionFeedbackSummaryDTO = z.infer<typeof predictionFeedbackSummaryDtoSchema>;
export type PredictionFeedbackSummaryResponse = z.infer<
  typeof predictionFeedbackSummaryResponseSchema
>;
