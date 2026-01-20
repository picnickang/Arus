/**
 * Telemetry Storage Types
 * Equipment telemetry, sensors, and diagnostics
 */

import type {
  EquipmentTelemetry,
  InsertTelemetry,
  RawTelemetry,
  InsertRawTelemetry,
  SensorConfiguration,
  InsertSensorConfiguration,
  SensorState,
  InsertSensorState,
  SensorTemplate,
  InsertSensorTemplate,
  EdgeHeartbeat,
  InsertHeartbeat,
  EdgeDiagnosticLog,
  InsertEdgeDiagnosticLog,
} from "@shared/schema-runtime";

export interface TelemetryFilters {
  equipmentId?: string;
  vesselId?: string;
  sensorType?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface SensorFilters {
  equipmentId?: string;
  vesselId?: string;
  isActive?: boolean;
}

/**
 * Telemetry Storage Interface
 */
export interface ITelemetryStorage {
  // Equipment telemetry
  getTelemetryReadings(filters?: TelemetryFilters): Promise<EquipmentTelemetry[]>;
  getLatestTelemetryReadings(vesselId?: string, equipmentId?: string): Promise<EquipmentTelemetry[]>;
  createTelemetryReading(reading: InsertTelemetry): Promise<EquipmentTelemetry>;
  createBulkTelemetryReadings(readings: InsertTelemetry[]): Promise<EquipmentTelemetry[]>;

  // Raw telemetry
  getRawTelemetry(equipmentId: string, limit?: number): Promise<RawTelemetry[]>;
  createRawTelemetry(raw: InsertRawTelemetry): Promise<RawTelemetry>;

  // Sensor configurations
  getSensorConfigurations(orgId: string, filters?: SensorFilters): Promise<SensorConfiguration[]>;
  getSensorConfiguration(id: string, orgId: string): Promise<SensorConfiguration | undefined>;
  createSensorConfiguration(config: InsertSensorConfiguration): Promise<SensorConfiguration>;
  updateSensorConfiguration(id: string, config: Partial<InsertSensorConfiguration>, orgId: string): Promise<SensorConfiguration>;
  deleteSensorConfiguration(id: string, orgId: string): Promise<void>;

  // Sensor states
  getSensorStates(orgId: string, filters?: SensorFilters): Promise<SensorState[]>;
  getSensorState(equipmentId: string, sensorId: string, orgId: string): Promise<SensorState | undefined>;
  upsertSensorState(state: InsertSensorState): Promise<SensorState>;

  // Sensor templates
  getSensorTemplates(orgId?: string): Promise<SensorTemplate[]>;
  getSensorTemplate(id: string): Promise<SensorTemplate | undefined>;
  createSensorTemplate(template: InsertSensorTemplate): Promise<SensorTemplate>;
  updateSensorTemplate(id: string, template: Partial<InsertSensorTemplate>): Promise<SensorTemplate>;
  deleteSensorTemplate(id: string): Promise<void>;

  // Edge heartbeats
  getEdgeHeartbeats(orgId?: string, limit?: number): Promise<EdgeHeartbeat[]>;
  createEdgeHeartbeat(heartbeat: InsertHeartbeat): Promise<EdgeHeartbeat>;

  // Edge diagnostics
  getEdgeDiagnosticLogs(deviceId: string, limit?: number): Promise<EdgeDiagnosticLog[]>;
  createEdgeDiagnosticLog(log: InsertEdgeDiagnosticLog): Promise<EdgeDiagnosticLog>;
}

export type {
  EquipmentTelemetry,
  InsertTelemetry,
  RawTelemetry,
  InsertRawTelemetry,
  SensorConfiguration,
  InsertSensorConfiguration,
  SensorState,
  InsertSensorState,
  SensorTemplate,
  InsertSensorTemplate,
  EdgeHeartbeat,
  InsertHeartbeat,
  EdgeDiagnosticLog,
  InsertEdgeDiagnosticLog,
};
