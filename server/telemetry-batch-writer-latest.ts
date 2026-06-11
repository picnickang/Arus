import type { TelemetryBatchReading } from "./telemetry-batch-writer-types";

/** Latest reading per (equipmentId, sensorType) in a flushed batch. */
export function latestPerEquipmentSensor(
  readings: TelemetryBatchReading[]
): Map<string, Map<string, TelemetryBatchReading>> {
  const latest = new Map<string, Map<string, TelemetryBatchReading>>();
  for (const reading of readings) {
    let sensors = latest.get(reading.equipmentId);
    if (!sensors) {
      sensors = new Map();
      latest.set(reading.equipmentId, sensors);
    }
    const prior = sensors.get(reading.sensorType);
    if (!prior || reading.timestamp.getTime() >= prior.timestamp.getTime()) {
      sensors.set(reading.sensorType, reading);
    }
  }
  return latest;
}
