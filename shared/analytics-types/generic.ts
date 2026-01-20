/**
 * Generic Response Wrappers
 *
 * Utility functions and schemas for standard API responses.
 */

import { z } from "zod";
import { listMetadataSchema, itemMetadataSchema } from "./metadata";

export function createListResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    results: z.array(itemSchema),
    metadata: listMetadataSchema,
  });
}

export function createItemResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    result: itemSchema,
    metadata: itemMetadataSchema,
  });
}

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  metadata: z.object({
    timestamp: z.coerce.date(),
    requestId: z.string().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
