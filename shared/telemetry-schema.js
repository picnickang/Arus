import { z } from "zod";
const SENSOR_TYPES = {
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
  ACCELERATION: "acceleration"
};
const SENSOR_VALIDATION_RANGES = {
  // Temperature ranges (Celsius)
  temperature: { min: -50, max: 200, unit: "\xB0C" },
  coolant_temp: { min: -10, max: 150, unit: "\xB0C" },
  exhaust_temp: { min: 0, max: 800, unit: "\xB0C" },
  ambient_temp: { min: -40, max: 60, unit: "\xB0C" },
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
  flow_rate: { min: 0, max: 1e4, unit: "L/min" },
  fuel_flow: { min: 0, max: 500, unit: "L/min" },
  coolant_flow: { min: 0, max: 1e3, unit: "L/min" },
  // Electrical ranges
  voltage: { min: 0, max: 690, unit: "V" },
  current: { min: 0, max: 5e3, unit: "A" },
  power: { min: 0, max: 1e4, unit: "kW" },
  frequency: { min: 45, max: 65, unit: "Hz" },
  // Mechanical ranges
  rpm: { min: 0, max: 5e3, unit: "rpm" },
  torque: { min: 0, max: 5e4, unit: "Nm" },
  load: { min: 0, max: 100, unit: "%" },
  // Environmental ranges
  humidity: { min: 0, max: 100, unit: "%" },
  // Motion ranges
  position: { min: -1e3, max: 1e3, unit: "mm" },
  speed: { min: 0, max: 100, unit: "km/h" },
  acceleration: { min: -50, max: 50, unit: "m/s\xB2" }
};
const SENSOR_OPERATIONAL_RANGES = {
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
  flow_rate: { min: 10, max: 5e3 },
  fuel_flow: { min: 5, max: 300 },
  coolant_flow: { min: 50, max: 800 },
  voltage: { min: 200, max: 500 },
  current: { min: 0, max: 1e3 },
  power: { min: 0, max: 5e3 },
  frequency: { min: 49, max: 61 },
  rpm: { min: 500, max: 3e3 },
  torque: { min: 0, max: 2e4 },
  load: { min: 0, max: 95 },
  humidity: { min: 20, max: 80 },
  position: { min: -500, max: 500 },
  speed: { min: 0, max: 50 },
  acceleration: { min: -10, max: 10 }
};
const telemetryPointSchema = z.object({
  orgId: z.string().uuid("Invalid organization ID"),
  equipmentId: z.string().uuid("Invalid equipment ID"),
  sensorType: z.enum(Object.values(SENSOR_TYPES)),
  value: z.number().finite("Value must be a finite number"),
  unit: z.string().optional(),
  timestamp: z.coerce.date()
}).strict();
const telemetryBatchSchema = z.object({
  orgId: z.string().uuid("Invalid organization ID"),
  data: z.array(telemetryPointSchema).min(1, "Batch must contain at least one data point").max(1e3, "Batch size exceeds maximum of 1000 points")
}).strict().refine(
  (batch) => {
    return batch.data.every((point) => point.orgId === batch.orgId);
  },
  {
    message: "All telemetry points must belong to the same organization as the batch",
    path: ["data"]
  }
);
const telemetryQuerySchema = z.object({
  equipmentId: z.string().uuid().optional(),
  sensorType: z.enum(Object.values(SENSOR_TYPES)).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1e4).default(1e3),
  offset: z.coerce.number().int().min(0).default(0)
}).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return data.startTime < data.endTime;
    }
    return true;
  },
  { message: "startTime must be before endTime" }
);
var DataQualityIssue = /* @__PURE__ */ ((DataQualityIssue2) => {
  DataQualityIssue2["OUT_OF_VALIDATION_RANGE"] = "out_of_validation_range";
  DataQualityIssue2["OUT_OF_OPERATIONAL_RANGE"] = "out_of_operational_range";
  DataQualityIssue2["MISSING_UNIT"] = "missing_unit";
  DataQualityIssue2["FUTURE_TIMESTAMP"] = "future_timestamp";
  DataQualityIssue2["STALE_TIMESTAMP"] = "stale_timestamp";
  DataQualityIssue2["RAPID_CHANGE"] = "rapid_change";
  DataQualityIssue2["DUPLICATE_TIMESTAMP"] = "duplicate_timestamp";
  DataQualityIssue2["SENSOR_TYPE_MISMATCH"] = "sensor_type_mismatch";
  return DataQualityIssue2;
})(DataQualityIssue || {});
function validateTelemetryQuality(point, previousPoint) {
  const issues = [];
  let qualityScore = 1;
  const validationRange = SENSOR_VALIDATION_RANGES[point.sensorType];
  if (point.value < validationRange.min || point.value > validationRange.max) {
    issues.push({
      type: "out_of_validation_range" /* OUT_OF_VALIDATION_RANGE */,
      severity: "critical",
      message: `Value ${point.value} is outside physical range [${validationRange.min}, ${validationRange.max}] ${validationRange.unit}`,
      field: "value"
    });
    qualityScore -= 0.5;
  }
  const operationalRange = SENSOR_OPERATIONAL_RANGES[point.sensorType];
  if (point.value < operationalRange.min || point.value > operationalRange.max) {
    issues.push({
      type: "out_of_operational_range" /* OUT_OF_OPERATIONAL_RANGE */,
      severity: "medium",
      message: `Value ${point.value} is outside typical operational range [${operationalRange.min}, ${operationalRange.max}]`,
      field: "value"
    });
    qualityScore -= 0.2;
  }
  if (!point.unit) {
    issues.push({
      type: "missing_unit" /* MISSING_UNIT */,
      severity: "low",
      message: "Unit is missing",
      field: "unit"
    });
    qualityScore -= 0.05;
  } else if (point.unit !== validationRange.unit) {
    issues.push({
      type: "sensor_type_mismatch" /* SENSOR_TYPE_MISMATCH */,
      severity: "medium",
      message: `Unit '${point.unit}' does not match expected '${validationRange.unit}'`,
      field: "unit"
    });
    qualityScore -= 0.1;
  }
  const now = /* @__PURE__ */ new Date();
  const timestampDiff = point.timestamp.getTime() - now.getTime();
  if (timestampDiff > 5 * 60 * 1e3) {
    issues.push({
      type: "future_timestamp" /* FUTURE_TIMESTAMP */,
      severity: "high",
      message: `Timestamp is ${Math.round(timestampDiff / 6e4)} minutes in the future`,
      field: "timestamp"
    });
    qualityScore -= 0.3;
  }
  if (timestampDiff < -7 * 24 * 60 * 60 * 1e3) {
    issues.push({
      type: "stale_timestamp" /* STALE_TIMESTAMP */,
      severity: "medium",
      message: `Timestamp is more than 7 days old`,
      field: "timestamp"
    });
    qualityScore -= 0.15;
  }
  if (previousPoint && previousPoint.sensorType === point.sensorType) {
    const timeDelta = (point.timestamp.getTime() - previousPoint.timestamp.getTime()) / 1e3;
    if (timeDelta > 0) {
      const valueDelta = Math.abs(point.value - previousPoint.value);
      const rateOfChange = valueDelta / timeDelta;
      const maxRateOfChange = {
        temperature: 5,
        // 5°C per second is extremely rapid
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
        power: 1e3,
        frequency: 1,
        rpm: 500,
        torque: 1e3,
        load: 50,
        humidity: 10,
        position: 100,
        speed: 20,
        acceleration: 100
      };
      if (rateOfChange > maxRateOfChange[point.sensorType]) {
        issues.push({
          type: "rapid_change" /* RAPID_CHANGE */,
          severity: "medium",
          message: `Rapid change detected: ${rateOfChange.toFixed(2)} ${validationRange.unit}/s (max: ${maxRateOfChange[point.sensorType]})`,
          field: "value"
        });
        qualityScore -= 0.1;
      }
    }
    if (timeDelta === 0) {
      issues.push({
        type: "duplicate_timestamp" /* DUPLICATE_TIMESTAMP */,
        severity: "low",
        message: "Duplicate timestamp detected",
        field: "timestamp"
      });
      qualityScore -= 0.05;
    }
  }
  qualityScore = Math.max(0, Math.min(1, qualityScore));
  return {
    isValid: qualityScore >= 0.5,
    // Consider valid if quality >= 50%
    qualityScore,
    issues,
    metadata: {
      validatedAt: /* @__PURE__ */ new Date(),
      sensorType: point.sensorType,
      value: point.value
    }
  };
}
function validateTelemetryBatch(points) {
  const results = [];
  let totalQualityScore = 0;
  let validCount = 0;
  let invalidCount = 0;
  const sortedPoints = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (let i = 0; i < sortedPoints.length; i++) {
    const previousPoint = i > 0 ? sortedPoints[i - 1] : void 0;
    const result = validateTelemetryQuality(sortedPoints[i], previousPoint);
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
    results
  };
}
var telemetry_schema_default = {
  SENSOR_TYPES,
  SENSOR_VALIDATION_RANGES,
  SENSOR_OPERATIONAL_RANGES,
  telemetryPointSchema,
  telemetryBatchSchema,
  telemetryQuerySchema,
  DataQualityIssue,
  validateTelemetryQuality,
  validateTelemetryBatch
};
export {
  DataQualityIssue,
  SENSOR_OPERATIONAL_RANGES,
  SENSOR_TYPES,
  SENSOR_VALIDATION_RANGES,
  telemetry_schema_default as default,
  telemetryBatchSchema,
  telemetryPointSchema,
  telemetryQuerySchema,
  validateTelemetryBatch,
  validateTelemetryQuality
};
