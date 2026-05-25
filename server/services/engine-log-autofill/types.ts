/**
 * Engine Log Auto-Fill - Types & Interfaces
 * Shared types for auto-fill service modules
 */

import type {
  EngineLogHourly,
  InsertEngineLogHourly,
  EngineLogGenerator,
  InsertEngineLogGenerator,
  EquipmentTelemetry,
  EngineLogDaily,
} from "@shared/schema";

export type {
  EngineLogHourly,
  InsertEngineLogHourly,
  EngineLogGenerator,
  InsertEngineLogGenerator,
  EquipmentTelemetry,
  EngineLogDaily,
};

export class AutoFillServiceError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly context: Record<string, unknown>,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = "AutoFillServiceError";
  }
}

export interface LogContext {
  orgId: string;
  vesselId: string;
  logDate: string;
  operation: string;
}

export interface TelemetryAggregate {
  field: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  stdDev: number;
}

export interface AutoFillResult {
  hour: number;
  fieldsPopulated: string[];
  fieldsSkipped: string[];
  anomalies: Array<{
    field: string;
    value: number;
    threshold: { min?: number; max?: number };
    severity: "warning" | "critical";
  }>;
  source: "telemetry" | "fmcc" | "mixed";
  confidence: number;
}

export interface FMCCFuelResult {
  success: boolean;
  source: "fmcc" | "telemetry" | "none";
  fuelMeConsumption?: number;
  fuelDgConsumption?: number;
  fuelTotalConsumption?: number;
  foDensity?: number;
  doTemperature?: number;
  dataPoints?: number;
  dataCompleteness?: number;
  error?: string;
}

export interface AutoFillSummary {
  vesselId: string;
  logDate: string;
  hoursProcessed: number;
  totalFieldsPopulated: number;
  totalAnomalies: number;
  results: AutoFillResult[];
  fmccFuelData?: FMCCFuelResult | undefined;
  dataSource: "telemetry" | "fmcc" | "mixed";
}

export interface AnomalyThreshold {
  min?: number;
  max?: number;
  unit: string;
  severity: "warning" | "critical";
}

export interface AutoFillOptions {
  hours?: number[] | undefined;
  overwriteManual?: boolean | undefined;
  dryRun?: boolean | undefined;
}

export interface GeneratorAutoFillOptions extends AutoFillOptions {
  generatorNumbers?: number[] | undefined;
}

export interface AnomalySummary {
  totalAnomalies: number;
  criticalCount: number;
  warningCount: number;
  byField: Record<string, { count: number; severity: "warning" | "critical"; values: number[] }>;
}

export interface UnsignedLogInfo {
  dailyLogId: string;
  vesselId: string;
  vesselName?: string | undefined;
  logDate: string;
  status: string;
  hoursWithData: number;
  anomalyCount: number;
}
