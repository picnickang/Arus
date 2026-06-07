/**
 * Telemetry Schema Validation & Data Quality Framework
 * Phase 2 - Task B.1: Schema-Driven Data Quality Validation
 *
 * Provides comprehensive Zod schemas for telemetry data validation,
 * sensor-specific range checking, and data quality scoring.
 */

import { z } from "zod";

// ===== SENSOR TYPE DEFINITIONS =====

/**
 * Supported sensor types across marine equipment
 */
export const SENSOR_TYPES = {
  // Temperature sensors
  TEMPERATURE: "temperature",
  COOLANT_TEMP: "coolant_temp",
  EXHAUST_TEMP: "exhaust_temp",

  // Pressure sensors
  PRESSURE: "pressure",
  OIL_PRESSURE: "oil_pressure",
  FUEL_PRESSURE: "fuel_pressure",
  HYDRAULIC_PRESSURE: "hydraulic_pressure",

  // Vibration sensors
  VIBRATION: "vibration",
  VIBRATION_X: "vibration_x",
  VIBRATION_Y: "vibration_y",
  VIBRATION_Z: "vibration_z",

  // Flow sensors
  FLOW_RATE: "flow_rate",
  FUEL_FLOW: "fuel_flow",
  COOLANT_FLOW: "coolant_flow",

  // Electrical sensors
  VOLTAGE: "voltage",
  CURRENT: "current",
  POWER: "power",
  FREQUENCY: "frequency",

  // Mechanical sensors
  RPM: "rpm",
  TORQUE: "torque",
  LOAD: "load",

  // Environmental sensors
  HUMIDITY: "humidity",
  AMBIENT_TEMP: "ambient_temp",

  // Position/Motion sensors
  POSITION: "position",
  SPEED: "speed",
  ACCELERATION: "acceleration",
} as const;

export type SensorType = (typeof SENSOR_TYPES)[keyof typeof SENSOR_TYPES];

// ===== SENSOR VALIDATION RANGES =====

/**
 * Physical validation ranges for each sensor type
 * Defines min/max bounds beyond which data is physically impossible
 */
export const SENSOR_VALIDATION_RANGES: Record<
  SensorType,
  { min: number; max: number; unit: string }
> = {
  // Temperature ranges (Celsius)
  temperature: { min: -50, max: 200, unit: "°C" },
  coolant_temp: { min: -10, max: 150, unit: "°C" },
  exhaust_temp: { min: 0, max: 800, unit: "°C" },
  ambient_temp: { min: -40, max: 60, unit: "°C" },

  // Pressure ranges (bar)
  pressure: { min: 0, max: 30, unit: "bar" },
  oil_pressure: { min: 0, max: 15, unit: "bar" },
  fuel_pressure: { min: 0, max: 10, unit: "bar" },
  hydraulic_pressure: { min: 0, max: 400, unit: "bar" },

  // Vibration ranges (mm/s RMS)
  vibration: { min: 0, max: 100, unit: "mm/s" },
  vibration_x: { min: -100, max: 100, unit: "mm/s" },
  vibration_y: { min: -100, max: 100, unit: "mm/s" },
  vibration_z: { min: -100, max: 100, unit: "mm/s" },

  // Flow ranges (L/min)
  flow_rate: { min: 0, max: 10000, unit: "L/min" },
  fuel_flow: { min: 0, max: 500, unit: "L/min" },
  coolant_flow: { min: 0, max: 1000, unit: "L/min" },

  // Electrical ranges
  voltage: { min: 0, max: 690, unit: "V" },
  current: { min: 0, max: 5000, unit: "A" },
  power: { min: 0, max: 10000, unit: "kW" },
  frequency: { min: 45, max: 65, unit: "Hz" },

  // Mechanical ranges
  rpm: { min: 0, max: 5000, unit: "rpm" },
  torque: { min: 0, max: 50000, unit: "Nm" },
  load: { min: 0, max: 100, unit: "%" },

  // Environmental ranges
  humidity: { min: 0, max: 100, unit: "%" },

  // Motion ranges
  position: { min: -1000, max: 1000, unit: "mm" },
  speed: { min: 0, max: 100, unit: "km/h" },
  acceleration: { min: -50, max: 50, unit: "m/s²" },
};

// ===== OPERATIONAL RANGES =====

/**
 * Typical operational ranges for quality scoring
 * Values outside these ranges are suspicious but not invalid
 */
export const SENSOR_OPERATIONAL_RANGES: Record<SensorType, { min: number; max: number }> = {
  temperature: { min: 10, max: 120 },
  coolant_temp: { min: 40, max: 100 },
  exhaust_temp: { min: 100, max: 600 },
  ambient_temp: { min: -20, max: 50 },

  pressure: { min: 0.5, max: 20 },
  oil_pressure: { min: 1.5, max: 8 },
  fuel_pressure: { min: 2, max: 7 },
  hydraulic_pressure: { min: 50, max: 350 },

  vibration: { min: 0, max: 25 },
  vibration_x: { min: -25, max: 25 },
  vibration_y: { min: -25, max: 25 },
  vibration_z: { min: -25, max: 25 },

  flow_rate: { min: 10, max: 5000 },
  fuel_flow: { min: 5, max: 300 },
  coolant_flow: { min: 50, max: 800 },

  voltage: { min: 200, max: 500 },
  current: { min: 0, max: 1000 },
  power: { min: 0, max: 5000 },
  frequency: { min: 49, max: 61 },

  rpm: { min: 500, max: 3000 },
  torque: { min: 0, max: 20000 },
  load: { min: 0, max: 95 },

  humidity: { min: 20, max: 80 },

  position: { min: -500, max: 500 },
  speed: { min: 0, max: 50 },
  acceleration: { min: -10, max: 10 },
};

// ===== ZOD SCHEMAS =====

/**
 * Base telemetry point schema
 */
export const telemetryPointSchema = z
  .object({
    orgId: z.string().uuid("Invalid organization ID"),
    equipmentId: z.string().uuid("Invalid equipment ID"),
    sensorType: z.enum(Object.values(SENSOR_TYPES) as [SensorType, ...SensorType[]]),
    value: z.number().finite("Value must be a finite number"),
    unit: z.string().optional(),
    timestamp: z.coerce.date(),
  })
  .strict();

export type TelemetryPoint = z.infer<typeof telemetryPointSchema>;

/**
 * Batch telemetry ingestion schema
 * SECURITY: Enforces that all points in batch belong to the same organization
 */
export const telemetryBatchSchema = z
  .object({
    orgId: z.string().uuid("Invalid organization ID"),
    data: z
      .array(telemetryPointSchema)
      .min(1, "Batch must contain at least one data point")
      .max(1000, "Batch size exceeds maximum of 1000 points"),
  })
  .strict()
  .refine(
    (batch) => {
      // CRITICAL SECURITY CHECK: Verify all points have same orgId as batch
      return batch.data.every((point) => point.orgId === batch.orgId);
    },
    {
      message: "All telemetry points must belong to the same organization as the batch",
      path: ["data"],
    }
  );

export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;

/**
 * Telemetry query parameters schema
 */
export const telemetryQuerySchema = z
  .object({
    equipmentId: z.string().uuid().optional(),
    sensorType: z.enum(Object.values(SENSOR_TYPES) as [SensorType, ...SensorType[]]).optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(10000).default(1000),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime < data.endTime;
      }
      return true;
    },
    { message: "startTime must be before endTime" }
  );

export type TelemetryQuery = z.infer<typeof telemetryQuerySchema>;

// ===== DATA QUALITY VALIDATION =====

/**
 * Data quality issue types
 */
export enum DataQualityIssue {
  OUT_OF_VALIDATION_RANGE = "out_of_validation_range",
  OUT_OF_OPERATIONAL_RANGE = "out_of_operational_range",
  MISSING_UNIT = "missing_unit",
  FUTURE_TIMESTAMP = "future_timestamp",
  STALE_TIMESTAMP = "stale_timestamp",
  RAPID_CHANGE = "rapid_change",
  DUPLICATE_TIMESTAMP = "duplicate_timestamp",
  SENSOR_TYPE_MISMATCH = "sensor_type_mismatch",
}

/**
 * Data quality validation result
 */
export interface DataQualityResult {
  isValid: boolean;
  qualityScore: number; // 0 to 1
  issues: Array<{
    type: DataQualityIssue;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    field?: string;
  }>;
  metadata: {
    validatedAt: Date;
    sensorType: SensorType;
    value: number;
  };
}

/**
 * Validate telemetry data point and calculate quality score
 */
export function validateTelemetryQuality(
  point: TelemetryPoint,
  previousPoint?: TelemetryPoint
): DataQualityResult {
  const issues: DataQualityResult["issues"] = [];
  let qualityScore = 1;

  // 1. Validation Range Check (Critical)
  const validationRange = SENSOR_VALIDATION_RANGES[point.sensorType];
  if (point.value < validationRange.min || point.value > validationRange.max) {
    issues.push({
      type: DataQualityIssue.OUT_OF_VALIDATION_RANGE,
      severity: "critical",
      message: `Value ${point.value} is outside physical range [${validationRange.min}, ${validationRange.max}] ${validationRange.unit}`,
      field: "value",
    });
    qualityScore -= 0.5; // Major penalty for physically impossible values
  }

  // 2. Operational Range Check (Medium)
  const operationalRange = SENSOR_OPERATIONAL_RANGES[point.sensorType];
  if (point.value < operationalRange.min || point.value > operationalRange.max) {
    issues.push({
      type: DataQualityIssue.OUT_OF_OPERATIONAL_RANGE,
      severity: "medium",
      message: `Value ${point.value} is outside typical operational range [${operationalRange.min}, ${operationalRange.max}]`,
      field: "value",
    });
    qualityScore -= 0.2; // Moderate penalty for unusual values
  }

  // 3. Unit Validation (Low)
  if (!point.unit) {
    issues.push({
      type: DataQualityIssue.MISSING_UNIT,
      severity: "low",
      message: "Unit is missing",
      field: "unit",
    });
    qualityScore -= 0.05; // Small penalty
  } else if (point.unit !== validationRange.unit) {
    issues.push({
      type: DataQualityIssue.SENSOR_TYPE_MISMATCH,
      severity: "medium",
      message: `Unit '${point.unit}' does not match expected '${validationRange.unit}'`,
      field: "unit",
    });
    qualityScore -= 0.1;
  }

  // 4. Timestamp Validation (High)
  const now = new Date();
  const timestampDiff = point.timestamp.getTime() - now.getTime();

  // Future timestamp check (allow 5 minutes tolerance for clock skew)
  if (timestampDiff > 5 * 60 * 1000) {
    issues.push({
      type: DataQualityIssue.FUTURE_TIMESTAMP,
      severity: "high",
      message: `Timestamp is ${Math.round(timestampDiff / 60000)} minutes in the future`,
      field: "timestamp",
    });
    qualityScore -= 0.3;
  }

  // Stale timestamp check (older than 7 days)
  if (timestampDiff < -7 * 24 * 60 * 60 * 1000) {
    issues.push({
      type: DataQualityIssue.STALE_TIMESTAMP,
      severity: "medium",
      message: `Timestamp is more than 7 days old`,
      field: "timestamp",
    });
    qualityScore -= 0.15;
  }

  // 5. Rapid Change Detection (if previous point available)
  if (previousPoint?.sensorType === point.sensorType) {
    const timeDelta = (point.timestamp.getTime() - previousPoint.timestamp.getTime()) / 1000; // seconds

    if (timeDelta > 0) {
      const valueDelta = Math.abs(point.value - previousPoint.value);
      const rateOfChange = valueDelta / timeDelta;

      // Define max rate of change per sensor type (units/second)
      const maxRateOfChange: Record<SensorType, number> = {
        temperature: 5, // 5°C per second is extremely rapid
        coolant_temp: 2,
        exhaust_temp: 10,
        ambient_temp: 1,
        pressure: 10,
        oil_pressure: 5,
        fuel_pressure: 5,
        hydraulic_pressure: 50,
        vibration: 50,
        vibration_x: 50,
        vibration_y: 50,
        vibration_z: 50,
        flow_rate: 100,
        fuel_flow: 50,
        coolant_flow: 100,
        voltage: 50,
        current: 100,
        power: 1000,
        frequency: 1,
        rpm: 500,
        torque: 1000,
        load: 50,
        humidity: 10,
        position: 100,
        speed: 20,
        acceleration: 100,
      };

      if (rateOfChange > maxRateOfChange[point.sensorType]) {
        issues.push({
          type: DataQualityIssue.RAPID_CHANGE,
          severity: "medium",
          message: `Rapid change detected: ${rateOfChange.toFixed(2)} ${validationRange.unit}/s (max: ${maxRateOfChange[point.sensorType]})`,
          field: "value",
        });
        qualityScore -= 0.1;
      }
    }

    // Duplicate timestamp check
    if (timeDelta === 0) {
      issues.push({
        type: DataQualityIssue.DUPLICATE_TIMESTAMP,
        severity: "low",
        message: "Duplicate timestamp detected",
        field: "timestamp",
      });
      qualityScore -= 0.05;
    }
  }

  // Ensure quality score stays within [0, 1]
  qualityScore = Math.max(0, Math.min(1, qualityScore));

  return {
    isValid: qualityScore >= 0.5, // Consider valid if quality >= 50%
    qualityScore,
    issues,
    metadata: {
      validatedAt: new Date(),
      sensorType: point.sensorType,
      value: point.value,
    },
  };
}

/**
 * Batch validation for multiple telemetry points
 */
export function validateTelemetryBatch(points: TelemetryPoint[]): {
  overallQualityScore: number;
  validCount: number;
  invalidCount: number;
  results: DataQualityResult[];
} {
  const results: DataQualityResult[] = [];
  let totalQualityScore = 0;
  let validCount = 0;
  let invalidCount = 0;

  // Sort by timestamp for sequential validation
  const sortedPoints = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (let i = 0; i < sortedPoints.length; i++) {
    const current = sortedPoints[i];
    if (current === undefined) {continue;}
    const previousPoint = i > 0 ? sortedPoints[i - 1] : undefined;
    const result = validateTelemetryQuality(current, previousPoint);

    results.push(result);
    totalQualityScore += result.qualityScore;

    if (result.isValid) {
      validCount++;
    } else {
      invalidCount++;
    }
  }

  return {
    overallQualityScore: points.length > 0 ? totalQualityScore / points.length : 0,
    validCount,
    invalidCount,
    results,
  };
}

// ===== EXPORT ALL =====

export default {
  SENSOR_TYPES,
  SENSOR_VALIDATION_RANGES,
  SENSOR_OPERATIONAL_RANGES,
  telemetryPointSchema,
  telemetryBatchSchema,
  telemetryQuerySchema,
  DataQualityIssue,
  validateTelemetryQuality,
  validateTelemetryBatch,
};
