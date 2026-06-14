/**
 * Telemetry Application Service
 *
 * Telemetry read use-cases over the ITelemetryRepository port plus cross-domain
 * reads via ITelemetryExternalReads (constructor DI). The sensor-health rollup
 * and history decimation live here rather than in the routes.
 */

import type { ITelemetryRepository, ITelemetryExternalReads } from "../domain/ports";
import type {
  EquipmentTelemetry,
  TelemetryTrend,
  SensorConfiguration,
  EdgeHeartbeat,
  EquipmentSensorHealth,
} from "../domain/types";
import { getSensorBaselines } from "../infrastructure/telemetry-baseline.js";

const MAX_HISTORY_POINTS = 1000;

export class TelemetryService {
  constructor(
    private readonly repo: ITelemetryRepository,
    private readonly external: ITelemetryExternalReads
  ) {}

  getLatestReadings(equipmentId: string | undefined, limit: number): Promise<EquipmentTelemetry[]> {
    return equipmentId ? this.repo.getLatestTelemetryReadings(equipmentId, limit) : Promise.resolve([]);
  }

  getTrends(equipmentId: string | undefined, hours: number): Promise<TelemetryTrend[]> {
    return this.repo.getTelemetryTrends(equipmentId, hours);
  }

  getBaseline(equipmentId: string, days: number) {
    return getSensorBaselines(equipmentId, days);
  }

  getHeartbeats(orgId?: string): Promise<EdgeHeartbeat[]> {
    return this.external.getHeartbeatsByOrg(orgId);
  }

  getSensorConfigurations(
    orgId?: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<SensorConfiguration[]> {
    return this.external.getSensorConfigurations(orgId, equipmentId, sensorType);
  }

  async getSensorConfiguration(
    orgId: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<SensorConfiguration | undefined> {
    const configs = await this.external.getSensorConfigurations(orgId, equipmentId, sensorType);
    return configs[0];
  }

  clearOrphanedData(): Promise<void> {
    return this.repo.clearOrphanedTelemetryData();
  }

  /**
   * Decimated telemetry history for charts: caps the series at MAX_HISTORY_POINTS
   * by even stride sampling, always retaining the newest reading.
   */
  async getHistory(
    equipmentId: string,
    sensorType: string,
    hours: number
  ): Promise<EquipmentTelemetry[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const history = await this.repo.getTelemetryByEquipmentAndDateRange(
      equipmentId,
      since,
      new Date(),
      sensorType
    );
    if (history.length <= MAX_HISTORY_POINTS) {
      return history;
    }
    const stride = Math.ceil(history.length / MAX_HISTORY_POINTS);
    const decimated = history.filter((_, i) => i % stride === 0);
    const newest = history[history.length - 1];
    if (newest && decimated[decimated.length - 1] !== newest) {
      decimated.push(newest);
    }
    return decimated;
  }

  /**
   * Per-equipment sensor-health rollup. Status comes from each sensor's newest
   * reading in a 24h window; sensors are the configured set when configurations
   * exist, otherwise the sensor types observed in the window.
   */
  async getEquipmentSensorHealth(
    orgId: string,
    equipmentId: string
  ): Promise<EquipmentSensorHealth> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [configs, readings, openAlerts] = await Promise.all([
      this.external.getSensorConfigurations(orgId, equipmentId),
      this.repo.getTelemetryByEquipmentAndDateRange(equipmentId, since, new Date()),
      this.external.listUnacknowledgedAlertNotifications(orgId),
    ]);

    // Newest reading + sample count per sensor type. Rows arrive ASCENDING by
    // ts, so the last row seen per sensor is the newest — overwrite as we go.
    const bySensor = new Map<string, { status: string; count: number }>();
    for (const reading of readings) {
      const entry = bySensor.get(reading.sensorType);
      if (entry) {
        entry.count++;
        entry.status = reading.status ?? "normal";
      } else {
        bySensor.set(reading.sensorType, { status: reading.status ?? "normal", count: 1 });
      }
    }

    const sensorTypes =
      configs.length > 0
        ? configs.map((c) => ({ type: c.sensorType, enabled: c.enabled !== false }))
        : Array.from(bySensor.keys()).map((type) => ({ type, enabled: true }));

    let normalSensors = 0;
    let warningSensors = 0;
    let criticalSensors = 0;
    let offlineSensors = 0;
    let consistentSensors = 0;
    for (const sensor of sensorTypes) {
      const latest = bySensor.get(sensor.type);
      if (!sensor.enabled || !latest) {
        offlineSensors++;
        continue;
      }
      if (latest.count >= 10) {
        consistentSensors++;
      }
      if (latest.status === "critical") {
        criticalSensors++;
      } else if (latest.status === "warning") {
        warningSensors++;
      } else {
        normalSensors++;
      }
    }

    const totalSensors = sensorTypes.length;
    const activeSensors = totalSensors - offlineSensors;
    const recentAnomalies = openAlerts.filter(
      (a) => a.equipmentId === equipmentId && a.createdAt && new Date(a.createdAt) >= since
    ).length;
    const pct = (n: number) => (totalSensors === 0 ? 0 : Math.round((n / totalSensors) * 100));

    return {
      totalSensors,
      activeSensors,
      normalSensors,
      warningSensors,
      criticalSensors,
      offlineSensors,
      overallHealthScore:
        totalSensors === 0
          ? 0
          : Math.round(
              (normalSensors * 100 + warningSensors * 60 + criticalSensors * 20) / totalSensors
            ),
      dataQualityScore: pct(consistentSensors),
      recentAnomalies,
      uptimePercentage: pct(activeSensors),
    };
  }
}
