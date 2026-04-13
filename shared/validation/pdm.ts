import { z } from "zod";

export const pdmOrgIdHeaderSchema = z.object({
  "x-org-id": z.string().min(1, "Organization ID is required"),
});

export const pdmBaselineUpdateSchema = z.object({
  vesselName: z.string().min(1, "Vessel name is required"),
  assetId: z.string().min(1, "Asset ID is required"),
  assetClass: z.enum(["bearing", "pump"], {
    errorMap: () => ({ message: "Asset class must be 'bearing' or 'pump'" }),
  }),
  features: z
    .record(z.string(), z.number().finite())
    .refine((features) => Object.keys(features).length > 0, {
      message: "At least one feature required",
    }),
});

export const pdmBearingAnalysisSchema = z.object({
  vesselName: z.string().min(1, "Vessel name is required"),
  assetId: z.string().min(1, "Asset ID is required"),
  fs: z.number().positive("Sampling frequency must be positive"),
  rpm: z.number().positive("RPM must be positive").optional(),
  series: z.array(z.number().finite()).min(10, "At least 10 data points required"),
  spectrum: z
    .object({
      freq: z.array(z.number()),
      mag: z.array(z.number()),
    })
    .optional(),
  autoBaseline: z.boolean().optional().default(false),
});

export const pdmPumpAnalysisSchema = z
  .object({
    vesselName: z.string().min(1, "Vessel name is required"),
    assetId: z.string().min(1, "Asset ID is required"),
    flow: z.array(z.number().finite()).optional(),
    pressure: z.array(z.number().finite()).optional(),
    current: z.array(z.number().finite()).optional(),
    fs: z.number().positive("Sampling frequency must be positive").optional(),
    vibSeries: z.array(z.number().finite()).optional(),
    autoBaseline: z.boolean().optional().default(false),
  })
  .refine((data) => data.flow || data.pressure || data.current || data.vibSeries, {
    message: "At least one data source required: flow, pressure, current, or vibSeries",
  });

export const pdmAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
});
