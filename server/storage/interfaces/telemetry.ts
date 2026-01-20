import type { 
  EquipmentTelemetry, 
  InsertTelemetry,
  SensorState,
  InsertSensorState,
  PdmScoreLog,
  InsertPdmScore,
} from "@shared/schema-runtime";

export interface TelemetryTrend {
  equipmentId: string;
  sensorType: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  count: number;
  timestamp: Date;
}

export interface TelemetryFilters {
  equipmentId?: string;
  sensorType?: string;
  startDate?: Date;
  endDate?: Date;
  hours?: number;
}

export interface ITelemetryStorage {
  createTelemetryReading(reading: InsertTelemetry): Promise<EquipmentTelemetry>;
  batchInsertTelemetry(readings: InsertTelemetry[]): Promise<{ inserted: number; errors: number }>;
  
  getTelemetryTrends(equipmentId?: string, hours?: number): Promise<TelemetryTrend[]>;
  getTelemetryHistory(
    equipmentId: string,
    sensorType: string,
    hours?: number,
    orgId?: string
  ): Promise<EquipmentTelemetry[]>;
  getTelemetryByEquipmentAndDateRange(
    equipmentId: string,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<EquipmentTelemetry[]>;
  
  getLatestTelemetryReadings(orgId?: string, limit?: number): Promise<EquipmentTelemetry[]>;
  getLatestTelemetryForSensor(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<EquipmentTelemetry | undefined>;
  getLatestTelemetryForSensors(
    equipmentId: string,
    sensorTypes: string[],
    orgId?: string
  ): Promise<Map<string, EquipmentTelemetry>>;
  
  getTelemetryStats(orgId?: string): Promise<{
    totalReadings: number;
    uniqueEquipment: number;
    uniqueSensors: number;
    latestTimestamp: Date | null;
  }>;
}

export interface ISensorStateStorage {
  getSensorState(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<SensorState | undefined>;
  upsertSensorState(state: InsertSensorState): Promise<SensorState>;
  getSensorStates(equipmentId: string, orgId?: string): Promise<SensorState[]>;
}

export interface IPdmScoreStorage {
  getPdmScores(equipmentId?: string): Promise<PdmScoreLog[]>;
  createPdmScore(score: InsertPdmScore): Promise<PdmScoreLog>;
  getLatestPdmScore(equipmentId: string): Promise<PdmScoreLog | undefined>;
  getPdmScoreHistory(
    equipmentId: string,
    days?: number,
    orgId?: string
  ): Promise<PdmScoreLog[]>;
}
