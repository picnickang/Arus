/**
 * Telemetry - Types
 */

export type { EquipmentTelemetry, InsertTelemetry, PdmScoreLog, InsertPdmScore, EdgeHeartbeat, InsertHeartbeat } from "@shared/schema-runtime";

export interface TelemetryFilters { equipmentId?: string; sensorType?: string; startDate?: Date; endDate?: Date; }
export interface TelemetryTrend { equipmentId: string; sensorType: string; avgValue: number; minValue: number; maxValue: number; dataPoints: number; lastReading: Date; }
