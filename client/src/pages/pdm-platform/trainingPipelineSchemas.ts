import { z } from "zod";

/**
 * Training-pipeline dialog schemas (CreateDatasetDialog, StartRunDialog,
 * PromoteDialog). Pure .ts so jest (tsx:false) can compile them — numeric
 * coercion lives here, not in the submit handlers.
 */

export const createDatasetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sourceType: z.string().min(1, "Source type is required"),
  description: z.string().optional(),
  labelColumn: z.string().optional(),
  rowCount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z
      .number({ invalid_type_error: "Must be a number" })
      .int("Must be a whole number")
      .positive("Must be a positive number")
      .optional()
  ),
});
type CreateDatasetFormData = z.infer<typeof createDatasetSchema>;

export const startRunSchema = z.object({
  datasetId: z.string().min(1, "Dataset is required"),
  learningRate: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .positive("Must be between 0 and 1")
    .max(1, "Must be between 0 and 1"),
  epochs: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .int("Must be a whole number")
    .positive("Must be a positive number"),
  batchSize: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .int("Must be a whole number")
    .positive("Must be a positive number"),
});
type StartRunFormData = z.infer<typeof startRunSchema>;

export const promoteSchema = z.object({
  modelId: z.string().min(1, "Target model is required"),
  version: z.string().min(1, "Version is required"),
  changelog: z.string().optional(),
});
type PromoteFormData = z.infer<typeof promoteSchema>;
