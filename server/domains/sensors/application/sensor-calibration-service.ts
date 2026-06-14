/**
 * Sensor Calibration Application Service
 * Calibration use-cases over the ISensorCalibrationRepository port (constructor
 * DI): summary aggregation, create with derived status, and calibration
 * recording with next-due computation.
 */

import type { ISensorCalibrationRepository } from "../domain/ports";
import type {
  SensorRow,
  CalibrationSummary,
  SensorListFilters,
  CreateSensorInput,
  CalibrationEventInput,
} from "../domain/types";

/** Thrown when a referenced sensor calibration record does not exist. */
export class SensorNotFoundError extends Error {
  constructor() {
    super("Sensor not found");
    this.name = "SensorNotFoundError";
  }
}

export interface CalibrationResult {
  success: true;
  sensorTag: string;
  calibrationStatus: string;
  nextCalibrationDue: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class SensorCalibrationService {
  constructor(private readonly repo: ISensorCalibrationRepository) {}

  async getSummary(orgId: string, vesselId?: string): Promise<CalibrationSummary> {
    const rows = await this.repo.getSummaryRows(orgId, vesselId);
    const summary: CalibrationSummary = {
      total: 0,
      calibrated: 0,
      due: 0,
      overdue: 0,
      failed: 0,
      unknown: 0,
      byType: {},
      dataQualityScore: 0,
    };
    for (const row of rows) {
      const count = Number(row.count);
      summary.total += count;
      if (row.calibration_status === "calibrated") {
        summary.calibrated += count;
      }
      if (row.calibration_status === "due") {
        summary.due += count;
      }
      if (row.calibration_status === "overdue") {
        summary.overdue += count;
      }
      if (row.calibration_status === "failed") {
        summary.failed += count;
      }
      if (row.calibration_status === "unknown") {
        summary.unknown += count;
      }
      const typeKey = row.sensor_type ?? row.sensorType ?? "unknown";
      summary.byType[typeKey] = (summary.byType[typeKey] || 0) + count;
    }
    summary.dataQualityScore =
      summary.total > 0 ? Math.round((summary.calibrated / summary.total) * 100) : 0;
    return summary;
  }

  listOverdue(orgId: string): Promise<SensorRow[]> {
    return this.repo.listOverdue(orgId);
  }

  list(orgId: string, filters: SensorListFilters): Promise<SensorRow[]> {
    return this.repo.list(orgId, filters);
  }

  async getSensorDetail(orgId: string, sensorId: string): Promise<SensorRow> {
    const sensor = await this.repo.findByIdWithNames(orgId, sensorId);
    if (!sensor) {
      throw new SensorNotFoundError();
    }
    const calibrationHistory = await this.repo.listCalibrationEvents(sensorId);
    return { ...sensor, calibrationHistory };
  }

  createSensor(orgId: string, data: CreateSensorInput): Promise<SensorRow | undefined> {
    const lastCalDate = data.lastCalibrationDate ? new Date(data.lastCalibrationDate) : null;
    const nextDue = lastCalDate
      ? new Date(lastCalDate.getTime() + data.calibrationIntervalDays * DAY_MS)
      : null;
    const status = !lastCalDate
      ? "unknown"
      : nextDue && nextDue < new Date()
        ? "overdue"
        : "calibrated";

    return this.repo.insert(orgId, { ...data, lastCalDate, nextDue, status });
  }

  async recordCalibration(
    orgId: string,
    sensorId: string,
    data: CalibrationEventInput
  ): Promise<CalibrationResult> {
    const sensor = await this.repo.findById(orgId, sensorId);
    if (!sensor) {
      throw new SensorNotFoundError();
    }

    await this.repo.insertCalibrationEvent(orgId, sensorId, data);

    const calDate = new Date(data.calibrationDate);
    const nextDue = new Date(calDate.getTime() + sensor.calibration_interval_days * DAY_MS);
    const newStatus = data.status === "fail" ? "failed" : "calibrated";

    await this.repo.applyCalibrationUpdate(orgId, sensorId, {
      calDate,
      nextDue,
      newStatus,
      driftPercentage: data.driftAfter ?? data.driftBefore ?? null,
      certificateUrl: data.certificateUrl || sensor.certificate_url,
    });

    return {
      success: true,
      sensorTag: sensor.sensor_tag,
      calibrationStatus: newStatus,
      nextCalibrationDue: nextDue,
    };
  }

  decommission(orgId: string, sensorId: string): Promise<void> {
    return this.repo.decommission(orgId, sensorId);
  }
}
