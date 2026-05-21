export interface FeatureStoreTelemetryReading {
  sensorType: string;
  value: number;
  ts: Date;
  unit: string | null;
}

export interface TelemetryPort {
  getRecentReadings(
    orgId: string,
    equipmentId: string,
    windowMinutes: number
  ): Promise<FeatureStoreTelemetryReading[]>;
  getAvailableSensorTypes(orgId: string, equipmentId: string): Promise<string[]>;
}
