/**
 * Sensors Domain - Types (sensor calibration)
 *
 * The calibration endpoints operate over the raw `sensor_calibrations` and
 * `sensor_calibration_events` tables and return row shapes verbatim, so rows are
 * modelled structurally (behaviour-preserving).
 */

export interface SensorRow {
  id: string;
  sensor_tag: string;
  calibration_interval_days: number;
  certificate_url: string | null;
  [key: string]: unknown;
}

export interface CalibrationSummaryRow {
  calibration_status: string;
  sensor_type: string;
  sensorType?: string;
  count: number | string;
}

export interface CalibrationSummary {
  total: number;
  calibrated: number;
  due: number;
  overdue: number;
  failed: number;
  unknown: number;
  byType: Record<string, number>;
  dataQualityScore: number;
}

export interface SensorListFilters {
  vesselId?: string | undefined;
  equipmentId?: string | undefined;
  sensorType?: string | undefined;
  status?: string | undefined;
}

export interface CreateSensorInput {
  vesselId: string;
  equipmentId?: string | undefined;
  sensorTag: string;
  sensorType: string;
  sensorLocation?: string | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  serialNumber?: string | undefined;
  calibrationIntervalDays: number;
  lastCalibrationDate?: string | undefined;
  calibrationStandard?: string | undefined;
  measurementRangeMin?: number | undefined;
  measurementRangeMax?: number | undefined;
  measurementUnit?: string | undefined;
  alarmLow?: number | null | undefined;
  alarmHigh?: number | null | undefined;
  tripLow?: number | null | undefined;
  tripHigh?: number | null | undefined;
  installedDate?: string | undefined;
  notes?: string | undefined;
}

export interface CalibrationEventInput {
  calibrationDate: string;
  performedBy: string;
  performedByRank?: string | undefined;
  status: "pass" | "fail" | "adjusted" | "replaced";
  driftBefore?: number | undefined;
  driftAfter?: number | undefined;
  referenceValue?: number | undefined;
  measuredValue?: number | undefined;
  adjustedTo?: number | undefined;
  certificateNumber?: string | undefined;
  certificateUrl?: string | undefined;
  notes?: string | undefined;
  method?: "field_check" | "workshop" | "manufacturer_service" | "external_lab" | undefined;
}

/** Resolved column values for a sensor_calibrations insert (computed by the service). */
export interface SensorCalibrationInsert extends CreateSensorInput {
  lastCalDate: Date | null;
  nextDue: Date | null;
  status: string;
}

/** Resolved updates applied after a calibration event. */
export interface SensorCalibrationUpdate {
  calDate: Date;
  nextDue: Date;
  newStatus: string;
  driftPercentage: number | null;
  certificateUrl: string | null;
}
