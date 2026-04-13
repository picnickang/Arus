/**
 * Engine Log Auto-Fill - Telemetry Data Fetching
 * Batch fetch and aggregate telemetry data
 */

import { dbTelemetryStorage } from "../../repositories.js";
import { log } from "./logging.js";
import type { EquipmentTelemetry, TelemetryAggregate } from "./types.js";

export async function batchFetchTelemetry(
  equipmentIds: string[],
  startDate: Date,
  endDate: Date,
  orgId: string
): Promise<EquipmentTelemetry[]> {
  if (equipmentIds.length === 0) { return []; }

  const allTelemetry: EquipmentTelemetry[] = [];
  const batchSize = 10;

  for (let i = 0; i < equipmentIds.length; i += batchSize) {
    const batch = equipmentIds.slice(i, i + batchSize);

    const batchPromises = batch.map(async (equipmentId) => {
      try {
        return await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
          equipmentId,
          startDate,
          endDate,
          orgId
        );
      } catch (error) {
        log('warn', 'Failed to get telemetry for equipment', {
          equipmentId,
          error: error instanceof Error ? error.message : String(error),
          operation: 'batchFetchTelemetry',
          orgId,
          vesselId: '',
          logDate: '',
        });
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (const readings of batchResults) {
      allTelemetry.push(...readings);
    }
  }

  return allTelemetry;
}

export function aggregateTelemetryByHour(
  readings: EquipmentTelemetry[],
  hour: number
): Map<string, TelemetryAggregate> {
  const hourlyReadings = readings.filter((r) => {
    if (!r.ts) { return false; }
    const readingHour = r.ts.getHours();
    return readingHour === hour;
  });

  const bySensorType = new Map<string, number[]>();
  for (const reading of hourlyReadings) {
    if (!reading.sensorType || reading.value === null || reading.value === undefined) { continue; }
    const sensorType = reading.sensorType.toLowerCase();
    if (!bySensorType.has(sensorType)) {
      bySensorType.set(sensorType, []);
    }
    bySensorType.get(sensorType)!.push(reading.value);
  }

  const aggregates = new Map<string, TelemetryAggregate>();
  for (const [sensorType, values] of bySensorType) {
    if (values.length === 0) { continue; }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    aggregates.set(sensorType, {
      field: sensorType,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      count: values.length,
      stdDev: Math.round(stdDev * 100) / 100,
    });
  }

  return aggregates;
}
