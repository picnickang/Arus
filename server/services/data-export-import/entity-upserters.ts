/**
 * Entity Upserters
 * 
 * Functions for upserting entity records during import.
 */

import * as crypto from "node:crypto";
import { storage } from "../../storage";
import type { ConflictResolution } from "./types";

/**
 * Upsert a record to the database
 * Returns the new ID if the record was created with a new ID (for cross-org mapping)
 */
type UpsertHandler = (record: any, conflictResolution: ConflictResolution, isRemapping: boolean) => Promise<string | undefined>;

const entityUpserters: Record<string, UpsertHandler> = {
  organizations: upsertOrganization,
  vessels: upsertVessel,
  equipment: upsertEquipment,
  work_orders: upsertWorkOrder,
  maintenance_schedules: upsertMaintenanceSchedule,
  sensors: upsertSensor,
  alert_configurations: upsertAlertConfiguration,
  sensor_configurations: (record, conflictResolution) => upsertSensorConfiguration(record, conflictResolution),
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
    console.warn(`[DataImport] Upsert not implemented for: ${entityName}`);
    return undefined;
  }
  return handler(record, conflictResolution, isRemapping);
}

async function upsertOrganization(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) { return undefined; }
  const existingOrg = await storage.getOrganization(record.id);
  if (existingOrg) {
    if (conflictResolution === "skip") { return undefined; }
    await storage.updateOrganization(record.id, record);
  } else {
    await storage.createOrganization(record);
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
    await storage.createVessel(record);
    console.log(`[DataImport] Created vessel: ${oldId} → ${record.id}`);
    return record.id;
  }
  const existingVessel = await storage.getVessel(record.id);
  if (existingVessel) {
    if (conflictResolution === "skip") { return undefined; }
    await storage.updateVessel(record.id, record, record.orgId);
    return undefined;
  } 
    await storage.createVessel(record);
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
    await storage.createEquipment(record);
    console.log(`[DataImport] Created equipment: ${oldId} → ${record.id} (vesselId: ${record.vesselId})`);
    return record.id;
  }
  const existingEquip = await storage.getEquipment(record.orgId, record.id);
  if (existingEquip) {
    if (conflictResolution === "skip") { return undefined; }
    await storage.updateEquipment(record.id, record, record.orgId);
    return undefined;
  } 
    await storage.createEquipment(record);
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
    await storage.createWorkOrder(record);
    console.log(`[DataImport] Created work_order: ${oldId} → ${record.id}`);
    return record.id;
  }
  const existingWO = await storage.getWorkOrderById(record.id, record.orgId);
  if (existingWO) {
    if (conflictResolution === "skip") { return undefined; }
    await storage.updateWorkOrder(record.id, record);
    return undefined;
  } 
    await storage.createWorkOrder(record);
    return record.id;
  
}

async function upsertMaintenanceSchedule(
  record: any,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  const existingSched = await storage.getMaintenanceSchedule(record.id);
  if (existingSched) {
    if (conflictResolution === "skip") { return undefined; }
    await storage.updateMaintenanceSchedule(record.id, record);
  } else {
    if (isRemapping) {
      record.id = crypto.randomUUID();
    }
    await storage.createMaintenanceSchedule(record);
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
    await storage.createSensor(record);
  } catch {
    if (conflictResolution !== "skip") {
      await storage.updateSensor(record.id, record);
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
    await storage.createAlertConfiguration(record);
  } catch {
    if (conflictResolution !== "skip") {
      await storage.updateAlertConfiguration(record.id, record);
    }
  }
  return record.id;
}

async function upsertSensorConfiguration(
  record: any,
  conflictResolution: ConflictResolution
): Promise<string | undefined> {
  try {
    await storage.createSensorConfiguration(record);
  } catch {
    if (conflictResolution !== "skip") {
      await storage.updateSensorConfiguration(record.id, record);
    }
  }
  return record.id;
}

async function upsertPartsInventory(record: any): Promise<string | undefined> {
  try {
    await storage.createPartInventory(record);
  } catch {
    // Silently skip on conflict
  }
  return record.id;
}

async function upsertTelemetry(record: any): Promise<string | undefined> {
  await storage.upsertTelemetry({
    equipmentId: record.equipmentId,
    sensorType: record.sensorType,
    value: record.value,
    unit: record.unit,
    quality: record.quality,
    source: record.source,
    ts: record.ts ? new Date(record.ts) : undefined,
  });
  return undefined;
}
