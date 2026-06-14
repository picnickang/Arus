/**
 * Telemetry Domain - Types
 *
 * Entity aliases over @shared/schema (+ the db-local TelemetryTrend type the
 * storage returns) and the sensor-health rollup result shape.
 */

import type {
  EquipmentTelemetry,
  SensorConfiguration,
  EdgeHeartbeat,
  AlertNotification,
} from "@shared/schema";
import type { TelemetryTrend } from "../../../db/telemetry/types.js";

export type {
  EquipmentTelemetry,
  SensorConfiguration,
  EdgeHeartbeat,
  AlertNotification,
  TelemetryTrend,
};

/** Per-equipment sensor-health rollup for the SensorHealthDashboard. */
export interface EquipmentSensorHealth {
  totalSensors: number;
  activeSensors: number;
  normalSensors: number;
  warningSensors: number;
  criticalSensors: number;
  offlineSensors: number;
  overallHealthScore: number;
  dataQualityScore: number;
  recentAnomalies: number;
  uptimePercentage: number;
}
