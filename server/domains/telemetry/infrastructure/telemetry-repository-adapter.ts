/**
 * Telemetry Infrastructure - Repository Adapter
 * Implements ITelemetryRepository using dbTelemetryStorage (the only telemetry
 * layer permitted to touch the storage barrel).
 */

import type { ITelemetryRepository } from "../domain/ports";
import type { EquipmentTelemetry, TelemetryTrend } from "../domain/types";
import { dbTelemetryStorage } from "../../../repositories";

export class TelemetryRepositoryAdapter implements ITelemetryRepository {
  getLatestTelemetryReadings(
    equipmentId?: string,
    limit?: number,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]> {
    return dbTelemetryStorage.getLatestTelemetryReadings(equipmentId, limit, sensorType);
  }

  getTelemetryTrends(equipmentId?: string, hours?: number): Promise<TelemetryTrend[]> {
    return dbTelemetryStorage.getTelemetryTrends(equipmentId, hours);
  }

  getTelemetryByEquipmentAndDateRange(
    equipmentId: string,
    since: Date,
    to: Date,
    sensorType?: string
  ): Promise<EquipmentTelemetry[]> {
    return dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(equipmentId, since, to, sensorType);
  }

  clearOrphanedTelemetryData(): Promise<void> {
    return dbTelemetryStorage.clearOrphanedTelemetryData();
  }
}

export const telemetryRepository = new TelemetryRepositoryAdapter();
