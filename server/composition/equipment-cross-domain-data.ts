/**
 * Composition - Equipment Cross-Domain Data Providers
 *
 * The equipment repository's legacy sensor-coverage / sensor-setup / compatible-
 * parts methods read sensor configurations (sensor-management) and parts
 * (inventory) — both cross-domain. These adapters live in the composition layer
 * (outside server/domains/) so the equipment domain stays free of those storages;
 * the ports are injected into the repository methods by the equipment service
 * (mirrors the alerts→crew / telemetry seams).
 */

import type { SensorConfiguration, Part } from "@shared/schema";
import { dbSensorsStorage } from "../db/sensors/index.js";
import { dbInventoryStorage } from "../db/inventory/index.js";

export interface EquipmentSensorConfigInput {
  equipmentId: string;
  orgId: string;
  sensorType: string;
  enabled: boolean;
  isCritical?: boolean | undefined;
  minValue?: number | undefined;
  maxValue?: number | undefined;
}

export interface IEquipmentSensorPort {
  getSensorConfigurations(orgId?: string, equipmentId?: string): Promise<SensorConfiguration[]>;
  createSensorConfiguration(data: EquipmentSensorConfigInput): Promise<SensorConfiguration>;
}

export interface IEquipmentPartsPort {
  getParts(orgId?: string): Promise<Part[]>;
}

export const equipmentSensorProvider: IEquipmentSensorPort = {
  getSensorConfigurations: (orgId, equipmentId) =>
    dbSensorsStorage.getSensorConfigurations(orgId, equipmentId),
  createSensorConfiguration: (data) =>
    dbSensorsStorage.createSensorConfiguration(
      data as object as Parameters<typeof dbSensorsStorage.createSensorConfiguration>[0]
    ),
};

export const equipmentPartsProvider: IEquipmentPartsPort = {
  getParts: (orgId) => dbInventoryStorage.getParts(orgId),
};
