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
import type { InsertOrganization } from "@shared/schema/core";
import type { InsertVessel } from "@shared/schema/vessels";
import type { InsertEquipment } from "@shared/schema/equipment";
import type { InsertWorkOrder } from "@shared/schema/work-orders";
import type { InsertMaintenanceSchedule } from "@shared/schema/maintenance";
import type { InsertSensorConfiguration } from "@shared/schema/sensors";
import type { InsertAlertConfiguration } from "@shared/schema/alerts";
import type { InsertPartsInventory } from "@shared/schema/inventory";
import type { InsertTelemetry } from "@shared/schema/telemetry";

type ImportRecord = Record<string, unknown> & { id?: string };

const asString = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

const recordId = (r: ImportRecord): string => asString(r.id);
const recordOrgId = (r: ImportRecord): string => asString(r.orgId);

/**
 * Single adapter-boundary helper for import records.
 *
 * Import data arrives from a JSON export of the same schema, so the field
 * shape matches the target insert type — but TypeScript cannot statically
 * verify that the loose `Record<string, unknown>` payload conforms. We
 * isolate the necessary widening into this one helper rather than scatter
 * `as unknown as Parameters<typeof fn>[0]` across every call site. The
 * downstream storage layer (drizzle + Zod insert schemas via
 * `createInsertSchema`) performs the actual structural validation on write.
 */
function asInsert<T>(record: ImportRecord): T {
  return record as unknown as T;
}

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
    await dbUserStorage.updateOrganization(id, asInsert<Partial<InsertOrganization>>(record));
  } else {
    await dbUserStorage.createOrganization(asInsert<InsertOrganization>(record));
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
    await vesselService.createVessel(asInsert<InsertVessel>(record));
    logger.info(`[DataImport] Created vessel: ${oldId} → ${record.id}`);
    return record.id;
  }
  const id = recordId(record);
  const existingVessel = await vesselService.getVessel(id);
  if (existingVessel) {
    if (conflictResolution === "skip") {
      return undefined;
    }
    await vesselService.updateVessel(
      id,
      asInsert<Partial<InsertVessel>>(record),
      recordOrgId(record)
    );
    return undefined;
  }
  await vesselService.createVessel(asInsert<InsertVessel>(record));
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
    await dbEquipmentStorage.createEquipment(asInsert<InsertEquipment>(record));
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
    await dbEquipmentStorage.updateEquipment(
      id,
      asInsert<Partial<InsertEquipment>>(record),
      orgId
    );
    return undefined;
  }
  await dbEquipmentStorage.createEquipment(asInsert<InsertEquipment>(record));
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
    await workOrderService.createWorkOrder(asInsert<InsertWorkOrder>(record));
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
    await workOrderService.updateWorkOrderWithDowntimeTracking(
      id,
      asInsert<Partial<InsertWorkOrder>>(record)
    );
    return undefined;
  }
  await workOrderService.createWorkOrder(asInsert<InsertWorkOrder>(record));
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
    await dbMaintenanceStorage.updateMaintenanceSchedule(
      id,
      asInsert<Partial<InsertMaintenanceSchedule>>(record)
    );
  } else {
    if (isRemapping) {
      record.id = crypto.randomUUID();
    }
    await dbMaintenanceStorage.createMaintenanceSchedule(
      asInsert<InsertMaintenanceSchedule>(record)
    );
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
    await dbSensorsStorage.createSensorConfiguration(asInsert<InsertSensorConfiguration>(record));
  } catch {
    if (conflictResolution !== "skip") {
      await dbSensorsStorage.updateSensorConfigurationById(
        recordId(record),
        asInsert<Partial<InsertSensorConfiguration>>(record)
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
    await dbAlertStorage.createAlertConfiguration(asInsert<InsertAlertConfiguration>(record));
  } catch {
    if (conflictResolution !== "skip") {
      await dbAlertStorage.updateAlertConfiguration(
        recordId(record),
        asInsert<Partial<InsertAlertConfiguration>>(record)
      );
    }
  }
  return recordId(record);
}

async function upsertSensorConfiguration(
  record: ImportRecord,
  conflictResolution: ConflictResolution
): Promise<string | undefined> {
  try {
    await dbSensorsStorage.createSensorConfiguration(asInsert<InsertSensorConfiguration>(record));
  } catch {
    if (conflictResolution !== "skip") {
      await dbSensorsStorage.updateSensorConfigurationById(
        recordId(record),
        asInsert<Partial<InsertSensorConfiguration>>(record)
      );
    }
  }
  return recordId(record);
}

async function upsertPartsInventory(record: ImportRecord): Promise<string | undefined> {
  try {
    await dbInventoryStorage.createPartsInventory(asInsert<InsertPartsInventory>(record));
  } catch {
    /* ignore */
  }
  return recordId(record);
}

async function upsertTelemetry(record: ImportRecord): Promise<string | undefined> {
  const ts = record.ts;
  const status = record.status;
  const reading: InsertTelemetry = {
    orgId: recordOrgId(record),
    equipmentId: asString(record.equipmentId),
    sensorType: asString(record.sensorType),
    value: typeof record.value === "number" ? record.value : Number(record.value),
    unit: typeof record.unit === "string" ? record.unit : undefined,
    ts: typeof ts === "string" || typeof ts === "number" ? new Date(ts) : undefined,
    ...(typeof status === "string" ? { status } : {}),
  };
  await dbTelemetryStorage.createTelemetryReading(reading);
  return undefined;
}
