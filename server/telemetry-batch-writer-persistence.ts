import type { InsertTelemetry } from "@shared/schema";
import { dbTelemetryStorage } from "./repositories";
import { batchWriterNaturalKeyConflicts } from "./telemetry-batch-writer-metrics";
import type { TelemetryBatchReading } from "./telemetry-batch-writer-types";

export async function insertTelemetryReadings(
  readings: TelemetryBatchReading[],
  chunkSize: number
): Promise<void> {
  for (let i = 0; i < readings.length; i += chunkSize) {
    const chunk = readings.slice(i, i + chunkSize);

    const rows: InsertTelemetry[] = chunk.map((reading) => ({
      equipmentId: reading.equipmentId,
      sensorType: reading.sensorType,
      value: reading.value,
      ts: reading.timestamp,
      orgId: reading.orgId || "default-org-id",
      unit: reading.unit,
    }));

    const insertedCount = await dbTelemetryStorage.createTelemetryReadingsBulk(rows);
    const conflicts = rows.length - insertedCount;
    if (conflicts > 0) {
      batchWriterNaturalKeyConflicts.inc(conflicts);
    }
  }
}
