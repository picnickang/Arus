/**
 * Telemetry Storage Interface - Telemetry Readings and Trends
 * Part of IStorage modularization for improved maintainability
 */

import type {
  EquipmentTelemetry,
  InsertTelemetry,
  TelemetryTrend,
  RawTelemetry,
  InsertRawTelemetry,
} from "@shared/schema";

/**
 * Telemetry storage operations for equipment readings and trends
 */
export interface ITelemetryStorage {
  // Telemetry Readings
  createTelemetryReading(reading: InsertTelemetry): Promise<EquipmentTelemetry>;
  getTelemetryHistory(
    arg1: string,
    arg2: string,
    arg3?: number | string,
    arg4?: Date,
    arg5?: Date
  ): Promise<EquipmentTelemetry[]>;
  getTelemetryByEquipmentAndDateRange(
    equipmentId: string,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<EquipmentTelemetry[]>;
  getLatestTelemetryReadings(
    vesselId?: string,
    equipmentId?: string,
    sensorType?: string,
    limit?: number,
    orgId?: string
  ): Promise<EquipmentTelemetry[]>;
  getLatestTelemetryForSensor(
    equipmentId: string,
    sensorType: string,
    orgId: string
  ): Promise<{ ts: Date; value: number } | undefined>;
  getLatestTelemetryForSensors(
    sensors: Array<{ equipmentId: string; sensorType: string }>,
    orgId: string
  ): Promise<
    Array<{ equipmentId: string; sensorType: string; ts: Date | null; value: number | null }>
  >;

  // Telemetry Trends
  getTelemetryTrends(equipmentId?: string, hours?: number): Promise<TelemetryTrend[]>;

  // Raw Telemetry
  getRawTelemetry(vessel?: string, fromDate?: Date, toDate?: Date): Promise<RawTelemetry[]>;
  bulkInsertRawTelemetry(telemetryData: InsertRawTelemetry[]): Promise<number>;
  deleteRawTelemetry(id: string): Promise<void>;

  // Cleanup
  clearOrphanedTelemetryData(): Promise<void>;
}
