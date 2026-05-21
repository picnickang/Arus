/**
 * Entity Upserters
 *
 * Functions for upserting entity records during import.
 */

import * as crypto from "node:crypto";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:DataExportImport:EntityUpserters");
import {
  dbUserStorage,
  dbEquipmentStorage,
  dbAlertStorage,
  dbSensorsStorage,
  dbInventoryStorage,
  dbMaintenanceStorage,
  dbTelemetryStorage,
  vesselService,
  workOrderService,
} from "../../repositories";
import type { ConflictResolution } from "./types";

/**
 * Upsert a record to the database
 * Returns the new ID if the record was created with a new ID (for cross-org mapping)
 */
type UpsertHandler = (
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
) => Promise<string | undefined>;

const entityUpserters: Record<string, UpsertHandler> = {
  organizations: upsertOrganization,
  vessels: upsertVessel,
  equipment: upsertEquipment,
  work_orders: upsertWorkOrder,
  maintenance_schedules: upsertMaintenanceSchedule,
  sensors: upsertSensor,
  alert_configurations: upsertAlertConfiguration,
  sensor_configurations: (record, conflictResolution) =>
    upsertSensorConfiguration(record, conflictResolution),
  parts_inventory: (record) => upsertPartsInventory(record),
  equipment_telemetry: (record) => upsertTelemetry(record),
};

export async function upsertRecord(
  entityName: string,
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean = false
): Promise<string | undefined> {
  const handler = entityUpserters[entityName];
  if (!handler) {
    logger.warn(`[DataImport] Upsert not implemented for: ${entityName}`);
    return undefined;
  }
  return handler(record, conflictResolution, isRemapping);
}

async function upsertOrganization(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    return undefined;
  }
  const existingOrg = await dbUserStorage.getOrganization(record.id);
  if (existingOrg) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await dbUserStorage.updateOrganization(record.id, record);
  } else {
    await dbUserStorage.createOrganization(record);
  }
  return record.id;
}

async function upsertVessel(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    const oldId = record.id;
    record.id = crypto.randomUUID();
    await vesselService.createVessel(record);
    logger.info(`[DataImport] Created vessel: ${oldId} → ${record.id}`);
    return record.id;
  }
  const existingVessel = await vesselService.getVessel(record.id);
  if (existingVessel) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await vesselService.updateVessel(record.id, record, record.orgId);
    return undefined;
  }
  await vesselService.createVessel(record);
  return record.id;
}

async function upsertEquipment(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    const oldId = record.id;
    record.id = crypto.randomUUID();
    await dbEquipmentStorage.createEquipment(record);
    logger.info(`[DataImport] Created equipment: ${oldId} → ${record.id} (vesselId: ${record.vesselId})`);
    return record.id;
  }
  const existingEquip = await dbEquipmentStorage.getEquipment(record.orgId, record.id);
  if (existingEquip) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await dbEquipmentStorage.updateEquipment(record.id, record, record.orgId || "");
    return undefined;
  }
  await dbEquipmentStorage.createEquipment(record);
  return record.id;
}

async function upsertWorkOrder(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    const oldId = record.id;
    record.id = crypto.randomUUID();
    record.woNumber = `WO-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await workOrderService.createWorkOrder(record);
    logger.info(`[DataImport] Created work_order: ${oldId} → ${record.id}`);
    return record.id;
  }
  const existingWO = await workOrderService.getWorkOrderById(record.id, record.orgId);
  if (existingWO) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await workOrderService.updateWorkOrderWithDowntimeTracking(record.id, record);
    return undefined;
  }
  await workOrderService.createWorkOrder(record);
  return record.id;
}

async function upsertMaintenanceSchedule(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  const existingSched = await dbMaintenanceStorage.getMaintenanceSchedule(record.id);
  if (existingSched) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await dbMaintenanceStorage.updateMaintenanceSchedule(record.id, record);
  } else {
    if (isRemapping) {
      record.id = crypto.randomUUID();
    }
    await dbMaintenanceStorage.createMaintenanceSchedule(record);
  }
  return record.id;
}

async function upsertSensor(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    record.id = crypto.randomUUID();
  }
  try {
    await dbSensorsStorage.createSensorConfiguration(record);
  } catch {
    if (conflictResolution !== "skip") {
      await dbSensorsStorage.updateSensorConfigurationById(record.id, record);
    }
  }
  return record.id;
}

async function upsertAlertConfiguration(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    record.id = crypto.randomUUID();
  }
  try {
    await dbAlertStorage.createAlertConfiguration(record);
  } catch {
    if (conflictResolution !== "skip") {
      await dbAlertStorage.updateAlertConfiguration(record.id, record);
    }
  }
  return record.id;
}

async function upsertSensorConfiguration(
  record: any,
  conflictResolution: ConflictResolution
): Promise<string | undefined> {
  try {
    await dbSensorsStorage.createSensorConfiguration(record);
  } catch {
    if (conflictResolution !== "skip") {
      await dbSensorsStorage.updateSensorConfigurationById(record.id, record);
    }
  }
  return record.id;
}

async function upsertPartsInventory(record: any): Promise<string | undefined> {
  try {
    await dbInventoryStorage.createPartsInventory(record);
  } catch {}
  return record.id;
}

async function upsertTelemetry(record: any): Promise<string | undefined> {
  await dbTelemetryStorage.createTelemetryReading({
    equipmentId: record.equipmentId,
    sensorType: record.sensorType,
    value: record.value,
    unit: record.unit,
    quality: record.quality,
    source: record.source,
    ts: record.ts ? new Date(record.ts) : undefined,
  } as object as Parameters<typeof dbTelemetryStorage.createTelemetryReading>[0]);
  return undefined;
}
