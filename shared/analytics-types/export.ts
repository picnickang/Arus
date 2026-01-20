/**
 * Data Export DTOs
 *
 * Types for data export metadata and operations.
 */

import { z } from "zod";
import { itemMetadataSchema } from "./metadata";

export const dataExportMetadataDtoSchema = z.object({
  exportId: z.string().uuid(),
  exportType: z.enum(["ml-models", "telemetry", "predictions", "anomalies", "complete"]),
  requestedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  recordCount: z.number().int().min(0),
  fileSizeBytes: z.number().int().min(0).optional(),
  format: z.enum(["json", "csv", "parquet"]),
  filters: z.record(z.unknown()).optional(),
  downloadUrl: z.string().url().optional(),
  expiresAt: z.coerce.date().optional(),
});

export type DataExportMetadataDTO = z.infer<typeof dataExportMetadataDtoSchema>;

export const dataExportResponseSchema = z.object({
  result: dataExportMetadataDtoSchema,
  metadata: itemMetadataSchema,
});

export type DataExportResponse = z.infer<typeof dataExportResponseSchema>;
