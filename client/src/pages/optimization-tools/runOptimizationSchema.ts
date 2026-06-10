import { z } from "zod";

/**
 * Run Optimization dialog (RunDialog.tsx). Pure .ts so jest (tsx:false)
 * can compile it — the time-horizon coercion lives here, not in the
 * submit handler.
 */
export const runOptimizationFormSchema = z.object({
  timeHorizon: z.coerce
    .number({ invalid_type_error: "Must be a number" })
    .int("Must be a whole number of days")
    .min(1, "Must be at least 1 day")
    .max(365, "Must be at most 365 days")
    .default(90),
});

export type RunOptimizationFormData = z.infer<typeof runOptimizationFormSchema>;

export const RUN_OPTIMIZATION_DEFAULTS: RunOptimizationFormData = { timeHorizon: 90 };
