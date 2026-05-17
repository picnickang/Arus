/**
 * Telemetry - Types
 */

import type {
  equipmentTelemetry,
  pdmScoreLogs,
  edgeHeartbeats,
} from "@shared/schema-runtime";

export type EquipmentTelemetry = typeof equipmentTelemetry.$inferSelect;
export type InsertTelemetry = typeof equipmentTelemetry.$inferInsert;
export type PdmScoreLog = typeof pdmScoreLogs.$inferSelect;
export type InsertPdmScore = typeof pdmScoreLogs.$inferInsert;
export type EdgeHeartbeat = typeof edgeHeartbeats.$inferSelect;
export type InsertHeartbeat = typeof edgeHeartbeats.$inferInsert;

export interface TelemetryFilters {
  equipmentId?: string;
  sensorType?: string;
  startDate?: Date;
  endDate?: Date;
}
export interface TelemetryTrend {
  equipmentId: string;
  sensorType: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataPoints: number;
  lastReading: Date;
}
