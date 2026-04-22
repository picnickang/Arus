import type { TelemetryReading } from "../../telemetry-batch-writer";

const MIN_TIMESTAMP = new Date("2000-01-01").getTime();
const MAX_FUTURE_MS = 5 * 60 * 1000;

export function validateReading(r: TelemetryReading): boolean {
  if (!r.equipmentId || r.equipmentId.trim() === "") {
    return false;
  }

  if (!Number.isFinite(r.value)) {
    return false;
  }

  const ts = r.timestamp.getTime();
  const now = Date.now();

  if (ts > now + MAX_FUTURE_MS) {
    return false;
  }

  if (ts < MIN_TIMESTAMP) {
    return false;
  }

  return true;
}

export function filterValidReadings(readings: TelemetryReading[]): TelemetryReading[] {
  return readings.filter(validateReading);
}
