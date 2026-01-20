export interface TelemetryReading {
  id: string;
  equipmentId: string;
  sensorType: string;
  value: number;
  unit?: string;
  quality?: "good" | "uncertain" | "bad";
  timestamp: Date;
}

export interface SensorConfiguration {
  id: string;
  orgId: string;
  equipmentId: string;
  sensorType: string;
  sensorName: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  warningThresholdLow?: number;
  warningThresholdHigh?: number;
  criticalThresholdLow?: number;
  criticalThresholdHigh?: number;
  samplingIntervalSeconds?: number;
  isEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SensorState {
  id: string;
  equipmentId: string;
  sensorType: string;
  currentValue?: number;
  lastUpdated?: Date;
  status: "normal" | "warning" | "critical" | "offline";
  trend?: "increasing" | "stable" | "decreasing";
}

export interface SensorTemplate {
  id: string;
  orgId: string;
  name: string;
  equipmentType?: string;
  sensors: SensorDefinition[];
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SensorDefinition {
  sensorType: string;
  sensorName: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  defaultWarningLow?: number;
  defaultWarningHigh?: number;
  defaultCriticalLow?: number;
  defaultCriticalHigh?: number;
}

export interface DeviceHeartbeat {
  deviceId: string;
  timestamp: Date;
  status: "online" | "offline" | "degraded";
  signalStrength?: number;
  batteryLevel?: number;
  firmwareVersion?: string;
}

export const SENSOR_TYPES = [
  "temperature",
  "pressure",
  "vibration",
  "rpm",
  "flow",
  "level",
  "voltage",
  "current",
  "power",
  "humidity",
] as const;

export const SENSOR_STATUSES = ["normal", "warning", "critical", "offline"] as const;

export type SensorType = typeof SENSOR_TYPES[number];
export type SensorStatus = typeof SENSOR_STATUSES[number];
