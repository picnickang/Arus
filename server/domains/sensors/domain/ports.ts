/**
 * Sensors Domain - Ports (sensor calibration)
 * The concrete adapter (raw SQL over sensor_calibrations / _events) lives in
 * infrastructure/; no port references the db handle.
 */

import type {
  SensorRow,
  CalibrationSummaryRow,
  SensorListFilters,
  SensorCalibrationInsert,
  CalibrationEventInput,
  SensorCalibrationUpdate,
} from "./types";

export interface ISensorCalibrationRepository {
  getSummaryRows(orgId: string, vesselId?: string): Promise<CalibrationSummaryRow[]>;
  listOverdue(orgId: string): Promise<SensorRow[]>;
  list(orgId: string, filters: SensorListFilters): Promise<SensorRow[]>;
  /** Detail row joined with vessel/equipment names. */
  findByIdWithNames(orgId: string, sensorId: string): Promise<SensorRow | undefined>;
  /** Bare row (no joins) for calibration processing. */
  findById(orgId: string, sensorId: string): Promise<SensorRow | undefined>;
  listCalibrationEvents(sensorId: string): Promise<Record<string, unknown>[]>;
  insert(orgId: string, values: SensorCalibrationInsert): Promise<SensorRow | undefined>;
  insertCalibrationEvent(
    orgId: string,
    sensorId: string,
    event: CalibrationEventInput
  ): Promise<void>;
  applyCalibrationUpdate(
    orgId: string,
    sensorId: string,
    update: SensorCalibrationUpdate
  ): Promise<void>;
  decommission(orgId: string, sensorId: string): Promise<void>;
}
