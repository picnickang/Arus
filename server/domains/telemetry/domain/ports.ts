/**
 * Telemetry Domain - Ports
 *
 * - ITelemetryRepository is the telemetry domain's own storage (impl in
 *   infrastructure/).
 * - ITelemetryExternalReads covers cross-domain reads (sensor configs, device
 *   heartbeats, open alert notifications) whose adapter lives in composition/,
 *   so the telemetry domain stays free of those storages.
 */

import type {
  EquipmentTelemetry,
  SensorConfiguration,
  EdgeHeartbeat,
  AlertNotification,
  TelemetryTrend,
} from "./types";

export interface ITelemetryRepository {
  getLatestTelemetryReadings(
    equipmentId?: string,
    limit?: number,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]>;
  getTelemetryTrends(equipmentId?: string, hours?: number): Promise<TelemetryTrend[]>;
  getTelemetryByEquipmentAndDateRange(
    equipmentId: string,
    since: Date,
    to: Date,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]>;
  clearOrphanedTelemetryData(): Promise<void>;
}

export interface ITelemetryExternalReads {
  getSensorConfigurations(
    orgId?: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<SensorConfiguration[]>;
  getHeartbeatsByOrg(orgId?: string): Promise<EdgeHeartbeat[]>;
  listUnacknowledgedAlertNotifications(orgId: string): Promise<AlertNotification[]>;
}
