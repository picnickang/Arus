/**
 * Standard Metadata Schemas
 *
 * Base metadata types for all analytics API responses.
 */

import { z } from "zod";

// orgId can be a UUID or a friendly string like "default-org-id" for single-tenant mode
const baseMetadataSchema = z.object({
  orgId: z.string().min(1),
  timestamp: z.coerce.date(),
  version: z.string().default("1.0"),
});

export const listMetadataSchema = baseMetadataSchema.extend({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(1000),
  hasMore: z.boolean(),
});

export const itemMetadataSchema = baseMetadataSchema;

export type BaseMetadata = z.infer<typeof baseMetadataSchema>;
export type ListMetadata = z.infer<typeof listMetadataSchema>;
export type ItemMetadata = z.infer<typeof itemMetadataSchema>;
