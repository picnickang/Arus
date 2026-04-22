/**
 * Equipment Service - Type Definitions
 */

export interface PaginationOptions {
  page: number;
  pageSize: number;
  search?: string;
  type?: string;
  status?: "active" | "inactive";
  vesselId?: string;
  manufacturer?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SensorCoverageResult {
  equipmentId: string;
  totalSensors: number;
  enabledSensors: number;
  criticalSensors: number;
  criticalEnabled: number;
  coveragePercentage: number;
  criticalCoveragePercentage: number;
  sensors: Array<{
    sensorType: string;
    enabled: boolean;
    isCritical: boolean | null;
    minValue?: number | null;
    maxValue?: number | null;
  }>;
}

export interface SensorSetupResult {
  equipmentId: string;
  equipmentType: string;
  sensorsCreated: number;
  sensorsSkipped: number;
  totalSensors: number;
  sensors: Array<{
    sensorType: string;
    enabled: boolean;
    isCritical: boolean | null;
  }>;
}

export const DEFAULT_SENSORS: Record<
  string,
  Array<{ type: string; critical: boolean; min?: number; max?: number }>
> = {
  engine: [
    { type: "temperature", critical: true, min: 0, max: 120 },
    { type: "pressure", critical: true, min: 0, max: 100 },
    { type: "vibration", critical: true, min: 0, max: 50 },
    { type: "rpm", critical: true, min: 0, max: 5000 },
  ],
  pump: [
    { type: "temperature", critical: true, min: 0, max: 100 },
    { type: "pressure", critical: true, min: 0, max: 150 },
    { type: "vibration", critical: true, min: 0, max: 30 },
    { type: "flow_rate", critical: false, min: 0, max: 1000 },
  ],
  compressor: [
    { type: "temperature", critical: true, min: 0, max: 120 },
    { type: "pressure", critical: true, min: 0, max: 200 },
    { type: "vibration", critical: true, min: 0, max: 40 },
  ],
  generator: [
    { type: "temperature", critical: true, min: 0, max: 100 },
    { type: "voltage", critical: true, min: 0, max: 500 },
    { type: "current", critical: true, min: 0, max: 1000 },
    { type: "frequency", critical: true, min: 50, max: 60 },
  ],
  default: [
    { type: "temperature", critical: true, min: 0, max: 100 },
    { type: "vibration", critical: false, min: 0, max: 50 },
  ],
};
