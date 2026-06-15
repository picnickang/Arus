/**
 * Telemetry - Types
 */

export interface TelemetryTrend {
  equipmentId: string;
  sensorType: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  dataPoints: number;
  lastReading: Date;
}
