/**
 * Sensor Management Domain - Types
 *
 * Entity aliases over @shared/schema and the sensor-status rollup shape.
 */

import type { Equipment, ThresholdOptimization, EquipmentTelemetry } from "@shared/schema";

export type { Equipment, ThresholdOptimization, EquipmentTelemetry };

export type SensorStatusValue = "disabled" | "inactive" | "offline" | "online";

export interface SensorStatusEntry {
  id: unknown;
  equipmentId: string;
  sensorType: string;
  status: SensorStatusValue;
  lastTelemetry: string | Date | null;
  lastValue: number | null;
  enabled: boolean | null;
  expectedIntervalMs: number | null;
  graceMultiplier: number | null;
}
