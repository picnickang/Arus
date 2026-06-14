/**
 * Sensors Infrastructure - Calibration Repository Adapter
 *
 * Implements ISensorCalibrationRepository with raw SQL over the
 * `sensor_calibrations` and `sensor_calibration_events` tables. This is the only
 * sensors layer permitted to hold the db handle (SQL moved verbatim from the
 * former flat routes.ts).
 */

import { sql } from "drizzle-orm";
import { db } from "../../../db";
import type { ISensorCalibrationRepository } from "../domain/ports";
import type {
  SensorRow,
  CalibrationSummaryRow,
  SensorListFilters,
  SensorCalibrationInsert,
  CalibrationEventInput,
  SensorCalibrationUpdate,
} from "../domain/types";

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  const maybe = result as { rows?: T[] } | null | undefined;
  const rows = maybe?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export class SensorCalibrationRepositoryAdapter implements ISensorCalibrationRepository {
  async getSummaryRows(orgId: string, vesselId?: string): Promise<CalibrationSummaryRow[]> {
    const whereClause = vesselId
      ? sql`org_id = ${orgId} AND vessel_id = ${vesselId}`
      : sql`org_id = ${orgId}`;
    const result = await db.execute(sql`
      SELECT
        calibration_status,
        sensor_type,
        COUNT(*) as count
      FROM sensor_calibrations
      WHERE ${whereClause}
        AND decommissioned_date IS NULL
      GROUP BY calibration_status, sensor_type
    `);
    return rowsOf<CalibrationSummaryRow>(result);
  }

  async listOverdue(orgId: string): Promise<SensorRow[]> {
    const result = await db.execute(sql`
      SELECT sc.*, v.name as vessel_name, e.name as equipment_name
      FROM sensor_calibrations sc
      LEFT JOIN vessels v ON sc.vessel_id = v.id
      LEFT JOIN equipment e ON sc.equipment_id = e.id
      WHERE sc.org_id = ${orgId}
        AND sc.next_calibration_due <= CURRENT_DATE
        AND sc.calibration_status != 'decommissioned'
        AND sc.decommissioned_date IS NULL
      ORDER BY sc.next_calibration_due ASC
    `);
    return rowsOf<SensorRow>(result);
  }

  async list(orgId: string, filters: SensorListFilters): Promise<SensorRow[]> {
    let query = sql`
      SELECT sc.*, v.name as vessel_name, e.name as equipment_name
      FROM sensor_calibrations sc
      LEFT JOIN vessels v ON sc.vessel_id = v.id
      LEFT JOIN equipment e ON sc.equipment_id = e.id
      WHERE sc.org_id = ${orgId}
    `;
    if (filters.vesselId) {
      query = sql`${query} AND sc.vessel_id = ${filters.vesselId}`;
    }
    if (filters.equipmentId) {
      query = sql`${query} AND sc.equipment_id = ${filters.equipmentId}`;
    }
    if (filters.sensorType) {
      query = sql`${query} AND sc.sensor_type = ${filters.sensorType}`;
    }
    if (filters.status) {
      query = sql`${query} AND sc.calibration_status = ${filters.status}`;
    }
    query = sql`${query} ORDER BY sc.next_calibration_due ASC NULLS LAST`;
    const result = await db.execute(query);
    return rowsOf<SensorRow>(result);
  }

  async findByIdWithNames(orgId: string, sensorId: string): Promise<SensorRow | undefined> {
    const result = await db.execute(sql`
      SELECT sc.*, v.name as vessel_name, e.name as equipment_name
      FROM sensor_calibrations sc
      LEFT JOIN vessels v ON sc.vessel_id = v.id
      LEFT JOIN equipment e ON sc.equipment_id = e.id
      WHERE sc.id = ${sensorId} AND sc.org_id = ${orgId}
    `);
    return rowsOf<SensorRow>(result)[0];
  }

  async findById(orgId: string, sensorId: string): Promise<SensorRow | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM sensor_calibrations
      WHERE id = ${sensorId} AND org_id = ${orgId}
    `);
    return rowsOf<SensorRow>(result)[0];
  }

  async listCalibrationEvents(sensorId: string): Promise<Record<string, unknown>[]> {
    const result = await db.execute(sql`
      SELECT * FROM sensor_calibration_events
      WHERE calibration_id = ${sensorId}
      ORDER BY calibration_date DESC
    `);
    return rowsOf<Record<string, unknown>>(result);
  }

  async insert(orgId: string, v: SensorCalibrationInsert): Promise<SensorRow | undefined> {
    const result = await db.execute(sql`
      INSERT INTO sensor_calibrations (
        org_id, vessel_id, equipment_id, sensor_tag, sensor_type,
        sensor_location, manufacturer, model, serial_number,
        calibration_interval_days, last_calibration_date, next_calibration_due,
        calibration_standard, calibration_status,
        measurement_range_min, measurement_range_max, measurement_unit,
        alarm_low, alarm_high, trip_low, trip_high,
        installed_date, notes
      ) VALUES (
        ${orgId}, ${v.vesselId}, ${v.equipmentId || null},
        ${v.sensorTag}, ${v.sensorType},
        ${v.sensorLocation || null}, ${v.manufacturer || null},
        ${v.model || null}, ${v.serialNumber || null},
        ${v.calibrationIntervalDays}, ${v.lastCalDate},
        ${v.nextDue}, ${v.calibrationStandard || null}, ${v.status},
        ${v.measurementRangeMin ?? null}, ${v.measurementRangeMax ?? null},
        ${v.measurementUnit || null},
        ${v.alarmLow ?? null}, ${v.alarmHigh ?? null},
        ${v.tripLow ?? null}, ${v.tripHigh ?? null},
        ${v.installedDate ? new Date(v.installedDate) : null},
        ${v.notes || null}
      )
      RETURNING *
    `);
    return rowsOf<SensorRow>(result)[0];
  }

  async insertCalibrationEvent(
    orgId: string,
    sensorId: string,
    data: CalibrationEventInput
  ): Promise<void> {
    await db.execute(sql`
      INSERT INTO sensor_calibration_events (
        org_id, calibration_id, calibration_date, performed_by,
        performed_by_rank, status, drift_before, drift_after,
        reference_value, measured_value, adjusted_to,
        certificate_number, certificate_url, notes, method
      ) VALUES (
        ${orgId}, ${sensorId}, ${new Date(data.calibrationDate)},
        ${data.performedBy}, ${data.performedByRank || null},
        ${data.status}, ${data.driftBefore ?? null}, ${data.driftAfter ?? null},
        ${data.referenceValue ?? null}, ${data.measuredValue ?? null},
        ${data.adjustedTo ?? null},
        ${data.certificateNumber || null}, ${data.certificateUrl || null},
        ${data.notes || null}, ${data.method || null}
      )
    `);
  }

  async applyCalibrationUpdate(
    orgId: string,
    sensorId: string,
    u: SensorCalibrationUpdate
  ): Promise<void> {
    await db.execute(sql`
      UPDATE sensor_calibrations
      SET last_calibration_date = ${u.calDate},
          next_calibration_due = ${u.nextDue},
          calibration_status = ${u.newStatus},
          drift_percentage = ${u.driftPercentage},
          certificate_url = ${u.certificateUrl},
          updated_at = NOW()
      WHERE id = ${sensorId} AND org_id = ${orgId}
    `);
  }

  async decommission(orgId: string, sensorId: string): Promise<void> {
    await db.execute(sql`
      UPDATE sensor_calibrations
      SET calibration_status = 'decommissioned',
          decommissioned_date = CURRENT_DATE,
          updated_at = NOW()
      WHERE id = ${sensorId} AND org_id = ${orgId}
    `);
  }
}

export const sensorCalibrationRepository = new SensorCalibrationRepositoryAdapter();
