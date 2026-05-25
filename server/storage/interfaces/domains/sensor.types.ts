import type { WidenPartial } from "../../../lib/widen-partial";
/**
 * Sensor Storage Interface - Sensor Configurations, States, Templates, J1939, DTCs
 * Part of IStorage modularization for improved maintainability
 */

import type {
  SensorConfiguration,
  InsertSensorConfiguration,
  SensorState,
  InsertSensorState,
  SensorTemplate,
  InsertSensorTemplate,
  J1939Configuration,
  InsertJ1939Configuration,
  DtcDefinition,
  InsertDtcDefinition,
  DtcFault,
  InsertDtcFault,
} from "@shared/schema";

/**
 * Sensor storage operations for configurations, states, templates, and diagnostics
 */
export interface ISensorStorage {
  // Sensor Configurations
  getSensorConfigurations(
    orgId?: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<SensorConfiguration[]>;
  getSensorConfiguration(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<SensorConfiguration | undefined>;
  createSensorConfiguration(config: InsertSensorConfiguration): Promise<SensorConfiguration>;
  bulkCreateSensorConfigurations(
    configs: InsertSensorConfiguration[],
    overwriteExisting?: boolean
  ): Promise<SensorConfiguration[]>;
  updateSensorConfiguration(
    equipmentId: string,
    sensorType: string,
    config: WidenPartial<InsertSensorConfiguration>,
    orgId?: string
  ): Promise<SensorConfiguration>;
  deleteSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<void>;
  updateSensorConfigurationById(
    id: string,
    config: WidenPartial<InsertSensorConfiguration>,
    orgId?: string
  ): Promise<SensorConfiguration>;
  deleteSensorConfigurationById(id: string, orgId?: string): Promise<void>;

  // Sensor States
  getSensorState(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<SensorState | undefined>;
  upsertSensorState(state: InsertSensorState): Promise<SensorState>;

  // Sensor Templates
  getSensorTemplates(orgId: string, equipmentType?: string): Promise<SensorTemplate[]>;
  getSensorTemplateById(id: string, orgId: string): Promise<SensorTemplate | null>;
  createSensorTemplate(template: InsertSensorTemplate & { orgId: string }): Promise<SensorTemplate>;
  updateSensorTemplate(
    id: string,
    orgId: string,
    data: WidenPartial<InsertSensorTemplate>
  ): Promise<SensorTemplate>;
  deleteSensorTemplate(id: string, orgId: string): Promise<void>;

  // J1939 Configurations
  getJ1939Configurations(orgId: string, deviceId?: string): Promise<J1939Configuration[]>;
  getJ1939Configuration(id: string, orgId: string): Promise<J1939Configuration | undefined>;
  createJ1939Configuration(config: InsertJ1939Configuration): Promise<J1939Configuration>;
  updateJ1939Configuration(
    id: string,
    config: WidenPartial<InsertJ1939Configuration>,
    orgId: string
  ): Promise<J1939Configuration>;
  deleteJ1939Configuration(id: string, orgId: string): Promise<void>;

  // DTC Definitions
  getDtcDefinitions(spn?: number, fmi?: number, manufacturer?: string): Promise<DtcDefinition[]>;
  getDtcDefinition(
    spn: number,
    fmi: number,
    manufacturer?: string
  ): Promise<DtcDefinition | undefined>;
  createDtcDefinition(definition: InsertDtcDefinition): Promise<DtcDefinition>;
  bulkInsertDtcDefinitions(definitions: InsertDtcDefinition[]): Promise<number>;

  // DTC Faults
  getActiveDtcs(
    equipmentId: string,
    orgId?: string
  ): Promise<(DtcFault & { definition?: DtcDefinition | undefined })[]>;
  getActiveDtcsBatch(
    equipmentIds: string[],
    orgId?: string
  ): Promise<(DtcFault & { definition?: DtcDefinition | undefined })[]>;
  getDtcHistory(
    equipmentId: string,
    orgId?: string,
    filters?: {
      spn?: number | undefined;
      fmi?: number | undefined;
      severity?: number | undefined;
      from?: Date | undefined;
      to?: Date | undefined;
      limit?: number | undefined;
    }
  ): Promise<(DtcFault & { definition?: DtcDefinition | undefined })[]>;
  upsertDtcFault(fault: InsertDtcFault): Promise<DtcFault>;
  clearInactiveDtcs(
    deviceId: string,
    activeSPNs: Array<{ spn: number; fmi: number }>
  ): Promise<number>;
}
