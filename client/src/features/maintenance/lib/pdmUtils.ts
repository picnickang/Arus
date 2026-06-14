import { z } from "zod";

export interface PdmAlert {
  id: string;
  vesselName: string;
  assetId: string;
  assetClass: "bearing" | "pump";
  feature: string;
  value: number;
  scoreZ: number;
  severity: "info" | "warn" | "high";
  at: string;
  explain: Record<string, unknown>;
}

export interface PdmBaseline {
  id: string;
  vesselName: string;
  assetId: string;
  assetClass: "bearing" | "pump";
  feature: string;
  mu: number;
  sigma: number;
  n: number;
  updatedAt: string;
}

export interface AnalysisResult {
  features: Record<string, number>;
  scores: Record<string, number>;
  severity: "info" | "warn" | "high";
  worstZ: number;
  explanation: Record<string, unknown>;
}

export const bearingFormSchema = z.object({
  vesselName: z.string().min(1, "Vessel name is required"),
  assetId: z.string().min(1, "Asset ID is required"),
  // coerce: the form binds these to <input type="number">, which yields a
  // string on edit; coercion keeps validation correct without per-field onChange.
  fs: z.coerce.number().min(1, "Sampling frequency must be positive"),
  rpm: z.coerce.number().min(0).optional(),
  series: z.string().min(1, "Vibration data is required"),
  autoBaseline: z.boolean(),
});

export type BearingFormData = z.infer<typeof bearingFormSchema>;

export const pumpFormSchema = z
  .object({
    vesselName: z.string().min(1, "Vessel name is required"),
    assetId: z.string().min(1, "Asset ID is required"),
    flow: z.string().optional(),
    pressure: z.string().optional(),
    current: z.string().optional(),
    autoBaseline: z.boolean(),
  })
  .refine((data) => data.flow || data.pressure || data.current, {
    message: "At least one data source is required",
  });

export type PumpFormData = z.infer<typeof pumpFormSchema>;

export function createDefaultBearingFormValues(): BearingFormData {
  return {
    vesselName: "MV Green Belt",
    assetId: "ME-BEARING-01",
    fs: 10000,
    rpm: 1800,
    series: "",
    autoBaseline: true,
  };
}

export function createDefaultPumpFormValues() {
  return {
    vesselName: "MV Green Belt",
    assetId: "PUMP001",
    flow: "",
    pressure: "",
    current: "",
    autoBaseline: true,
  };
}

export function getSeverityColor(severity: "info" | "warn" | "high"): string {
  switch (severity) {
    case "high":
      return "bg-red-500";
    case "warn":
      return "bg-yellow-500";
    default:
      return "bg-green-500";
  }
}

export function getSeverityBadgeVariant(
  severity: "info" | "warn" | "high"
): "destructive" | "default" | "secondary" {
  switch (severity) {
    case "high":
      return "destructive";
    case "warn":
      return "default";
    default:
      return "secondary";
  }
}

export function formatZScore(z: number): string {
  return z.toFixed(2);
}

export function getZScoreInterpretation(z: number): string {
  const absZ = Math.abs(z);
  if (absZ < 2) {
    return "Normal";
  }

  if (absZ < 3) {
    return "Warning";
  }
  return "Critical";
}

export function parseDataSeries(input: string): number[] {
  return input
    .split(/[,\s]+/)
    .map((v) => Number.parseFloat(v.trim()))
    .filter((v) => !Number.isNaN(v));
}
