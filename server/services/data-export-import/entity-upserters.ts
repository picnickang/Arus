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

type ImportRecord = Record<string, unknown> & { id?: string };

const asString = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

const recordId = (r: ImportRecord): string => asString(r.id);
const recordOrgId = (r: ImportRecord): string => asString(r.orgId);

const asCreateOrganization = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbUserStorage.createOrganization>[0];
const asUpdateOrganization = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbUserStorage.updateOrganization>[1];
const asCreateVessel = (r: ImportRecord) =>
  r as unknown as Parameters<typeof vesselService.createVessel>[0];
const asUpdateVessel = (r: ImportRecord) =>
  r as unknown as Parameters<typeof vesselService.updateVessel>[1];
const asCreateEquipment = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbEquipmentStorage.createEquipment>[0];
const asUpdateEquipment = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbEquipmentStorage.updateEquipment>[1];
const asCreateWorkOrder = (r: ImportRecord) =>
  r as unknown as Parameters<typeof workOrderService.createWorkOrder>[0];
const asUpdateWorkOrder = (r: ImportRecord) =>
  r as unknown as Parameters<typeof workOrderService.updateWorkOrderWithDowntimeTracking>[1];
const asCreateMaintenanceSchedule = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbMaintenanceStorage.createMaintenanceSchedule>[0];
const asUpdateMaintenanceSchedule = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbMaintenanceStorage.updateMaintenanceSchedule>[1];
const asCreateSensorConfig = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbSensorsStorage.createSensorConfiguration>[0];
const asUpdateSensorConfig = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbSensorsStorage.updateSensorConfigurationById>[1];
const asCreateAlertConfig = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbAlertStorage.createAlertConfiguration>[0];
const asUpdateAlertConfig = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbAlertStorage.updateAlertConfiguration>[1];
const asCreatePartsInventory = (r: ImportRecord) =>
  r as unknown as Parameters<typeof dbInventoryStorage.createPartsInventory>[0];

/**
 * Upsert a record to the database
 * Returns the new ID if the record was created with a new ID (for cross-org mapping)
 */
type UpsertHandler = (
  record: ImportRecord,
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
  record: ImportRecord,
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
  record: ImportRecord,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    return undefined;
  }
  const id = recordId(record);
  const existingOrg = await dbUserStorage.getOrganization(id);
  if (existingOrg) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await dbUserStorage.updateOrganization(id, asUpdateOrganization(record));
  } else {
    await dbUserStorage.createOrganization(asCreateOrganization(record));
  }
  return id;
}

async function upsertVessel(
  record: ImportRecord,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    const oldId = recordId(record);
    record.id = crypto.randomUUID();
    await vesselService.createVessel(asCreateVessel(record));
    logger.info(`[DataImport] Created vessel: ${oldId} → ${record.id}`);
    return record.id;
  }
  const id = recordId(record);
  const existingVessel = await vesselService.getVessel(id);
  if (existingVessel) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await vesselService.updateVessel(id, asUpdateVessel(record), recordOrgId(record));
    return undefined;
  }
  await vesselService.createVessel(asCreateVessel(record));
  return id;
}

async function upsertEquipment(
  record: ImportRecord,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    const oldId = recordId(record);
    record.id = crypto.randomUUID();
    await dbEquipmentStorage.createEquipment(asCreateEquipment(record));
    logger.info(
      `[DataImport] Created equipment: ${oldId} → ${record.id} (vesselId: ${asString(record.vesselId)})`
    );
    return record.id;
  }
  const id = recordId(record);
  const orgId = recordOrgId(record);
  const existingEquip = await dbEquipmentStorage.getEquipment(orgId, id);
  if (existingEquip) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await dbEquipmentStorage.updateEquipment(id, asUpdateEquipment(record), orgId);
    return undefined;
  }
  await dbEquipmentStorage.createEquipment(asCreateEquipment(record));
  return id;
}

async function upsertWorkOrder(
  record: ImportRecord,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    const oldId = recordId(record);
    record.id = crypto.randomUUID();
    record.woNumber = `WO-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await workOrderService.createWorkOrder(asCreateWorkOrder(record));
    logger.info(`[DataImport] Created work_order: ${oldId} → ${record.id}`);
    return record.id;
  }
  const id = recordId(record);
  const orgId = recordOrgId(record);
  const existingWO = await workOrderService.getWorkOrderById(id, orgId);
  if (existingWO) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await workOrderService.updateWorkOrderWithDowntimeTracking(id, asUpdateWorkOrder(record));
    return undefined;
  }
  await workOrderService.createWorkOrder(asCreateWorkOrder(record));
  return id;
}

async function upsertMaintenanceSchedule(
  record: ImportRecord,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  const id = recordId(record);
  const existingSched = await dbMaintenanceStorage.getMaintenanceSchedule(id);
  if (existingSched) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await dbMaintenanceStorage.updateMaintenanceSchedule(id, asUpdateMaintenanceSchedule(record));
  } else {
    if (isRemapping) {
      record.id = crypto.randomUUID();
    }
    await dbMaintenanceStorage.createMaintenanceSchedule(asCreateMaintenanceSchedule(record));
  }
  return recordId(record);
}

async function upsertSensor(
  record: ImportRecord,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    record.id = crypto.randomUUID();
  }
  try {
    await dbSensorsStorage.createSensorConfiguration(asCreateSensorConfig(record));
  } catch {
    if (conflictResolution !== "skip") {
      await dbSensorsStorage.updateSensorConfigurationById(
        recordId(record),
        asUpdateSensorConfig(record)
      );
    }
  }
  return recordId(record);
}

async function upsertAlertConfiguration(
  record: ImportRecord,
  conflictResolution: ConflictResolution,
  isRemapping: boolean
): Promise<string | undefined> {
  if (isRemapping) {
    record.id = crypto.randomUUID();
  }
  try {
    await dbAlertStorage.createAlertConfiguration(asCreateAlertConfig(record));
  } catch {
    if (conflictResolution !== "skip") {
      await dbAlertStorage.updateAlertConfiguration(recordId(record), asUpdateAlertConfig(record));
    }
  }
  return recordId(record);
}

async function upsertSensorConfiguration(
  record: ImportRecord,
  conflictResolution: ConflictResolution
): Promise<string | undefined> {
  try {
    await dbSensorsStorage.createSensorConfiguration(asCreateSensorConfig(record));
  } catch {
    if (conflictResolution !== "skip") {
      await dbSensorsStorage.updateSensorConfigurationById(
        recordId(record),
        asUpdateSensorConfig(record)
      );
    }
  }
  return recordId(record);
}

async function upsertPartsInventory(record: ImportRecord): Promise<string | undefined> {
  try {
    await dbInventoryStorage.createPartsInventory(asCreatePartsInventory(record));
  } catch {
    /* ignore */
  }
  return recordId(record);
}

async function upsertTelemetry(record: ImportRecord): Promise<string | undefined> {
  const ts = record.ts;
  await dbTelemetryStorage.createTelemetryReading({
    equipmentId: asString(record.equipmentId),
    sensorType: asString(record.sensorType),
    value: typeof record.value === "number" ? record.value : Number(record.value),
    unit: asString(record.unit),
    quality: asString(record.quality),
    source: asString(record.source),
    ts: typeof ts === "string" || typeof ts === "number" ? new Date(ts) : undefined,
  } as unknown as Parameters<typeof dbTelemetryStorage.createTelemetryReading>[0]);
  return undefined;
}
