/**
 * Sensor Management Domain - Ports
 *
 * - ISensorRepository is derived structurally from the domain's OWN sensor
 *   storage (`dbSensorsStorage` maps to this domain, so naming it here is not a
 *   cross-domain leak); its concrete binding lives in infrastructure/.
 * - The equipment / threshold-optimization / telemetry-history ports are
 *   cross-domain reads whose adapters live in composition/, so those storages
 *   are never named under domains/sensor-management.
 */

import type { dbSensorsStorage } from "../../../db/sensors/index.js";
import type { Equipment, ThresholdOptimization, EquipmentTelemetry } from "./types";

export type ISensorRepository = Pick<
  typeof dbSensorsStorage,
  | "getSensorConfigurations"
  | "getSensorConfiguration"
  | "createSensorConfiguration"
  | "bulkCreateSensorConfigurations"
  | "updateSensorConfiguration"
  | "updateSensorConfigurationById"
  | "deleteSensorConfiguration"
  | "deleteSensorConfigurationById"
  | "getSensorState"
  | "upsertSensorState"
  | "getJ1939Configurations"
  | "getJ1939Configuration"
  | "createJ1939Configuration"
  | "updateJ1939Configuration"
  | "deleteJ1939Configuration"
>;

export interface ISensorEquipmentPort {
  getEquipment(orgId: string, equipmentId: string): Promise<Equipment | undefined>;
}

export interface ISensorThresholdOptimizationPort {
  getThresholdOptimizations(
    orgId: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<ThresholdOptimization[]>;
  getThresholdOptimization(
    id: number,
    orgId: string
  ): Promise<ThresholdOptimization | undefined>;
  applyThresholdOptimization(id: number, orgId: string): Promise<ThresholdOptimization>;
  rejectThresholdOptimization(
    id: number,
    reason: string,
    orgId: string
  ): Promise<ThresholdOptimization>;
}

export interface ISensorTelemetryHistoryPort {
  getTelemetryHistory(
    equipmentId: string,
    sensorType?: string,
    limit?: number
  ): Promise<EquipmentTelemetry[]>;
}
