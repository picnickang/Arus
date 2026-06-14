import { and, eq } from "drizzle-orm";
import { equipment, parts, stock, workOrders } from "@shared/schema-runtime";
import { projectEquipment, retractInstalledOn } from "../../graph/projector";
import { createLogger } from "../../lib/structured-logger";
import { recordUserVisibleStub } from "../../observability/security-metrics.js";
import type { db as amosDb } from "../../db";
import type { AmosUpsertResult, ImportType } from "./types";

const logger = createLogger("amos-import");
type AmosDatabase = typeof amosDb;

// ============================================================================
// Database upsert per type
// ============================================================================

export async function upsertAmosRow(
  database: AmosDatabase,
  orgId: string,
  type: ImportType,
  data: Record<string, unknown>,
  vesselId?: string
): Promise<AmosUpsertResult> {
  switch (type) {
    case "equipment":
      return upsertAmosEquipment(database, orgId, data, vesselId);
    case "work_orders":
      return upsertAmosWorkOrder(database, orgId, data, vesselId);
    case "parts":
      return upsertAmosPart(database, orgId, data);
    case "maintenance_plans":
      return upsertAmosMaintenancePlan(orgId, data);
    default:
      return "skipped";
  }
}

export function topologicalSortAmosRows(
  rows: Array<{ rowNum: number; data: Record<string, unknown> }>
): Array<{ rowNum: number; data: Record<string, unknown> }> {
  const idMap = new Map<string, { rowNum: number; data: Record<string, unknown> }>();
  const roots: Array<{ rowNum: number; data: Record<string, unknown> }> = [];
  const children: Array<{ rowNum: number; data: Record<string, unknown> }> = [];

  for (const row of rows) {
    const id = row.data["id"] as string;
    if (id) {
      idMap.set(id, row);
    }
    const parentId = row.data["parentEquipmentId"] as string | undefined;
    if (!parentId) {
      roots.push(row);
    } else {
      children.push(row);
    }
  }

  const sorted = [...roots];
  const insertedIds = new Set(roots.map((r) => r.data["id"] as string));
  let remaining = [...children];
  let maxPasses = remaining.length + 1;

  while (remaining.length > 0 && maxPasses-- > 0) {
    const next: typeof remaining = [];
    for (const row of remaining) {
      const parentId = row.data["parentEquipmentId"] as string;
      if (insertedIds.has(parentId)) {
        sorted.push(row);
        insertedIds.add(row.data["id"] as string);
      } else {
        next.push(row);
      }
    }
    if (next.length === remaining.length) {
      break;
    }
    remaining = next;
  }

  sorted.push(...remaining);
  return sorted;
}

async function upsertAmosEquipment(
  database: AmosDatabase,
  orgId: string,
  data: Record<string, unknown>,
  vesselId?: string
): Promise<AmosUpsertResult> {
  // Pack _spec_ prefixed fields into specifications JSONB
  const specifications: Record<string, unknown> = {};
  const cleanData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_spec_") && value != null) {
      specifications[key.replace("_spec_", "")] = value;
    } else if (!key.startsWith("_")) {
      cleanData[key] = value;
    }
  }

  if (Object.keys(specifications).length > 0) {
    cleanData["specifications"] = specifications;
  }

  cleanData["orgId"] = orgId;
  if (vesselId && !cleanData["vesselId"]) {
    cleanData["vesselId"] = vesselId;
  }
  if (!cleanData["type"]) {
    cleanData["type"] = (cleanData["systemType"] as string) || "general";
  }

  const equipmentId = cleanData["id"] as string;
  if (!equipmentId) {
    return "skipped";
  }

  // Check if exists
  const [existing] = await database
    .select({ id: equipment.id, vesselId: equipment.vesselId })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
    .limit(1);

  // Task #81 — keep the knowledge graph in lockstep on AMOS bulk
  // imports for BOTH insert AND update branches. Best-effort
  // (no-op when GRAPH_ENABLED=false). The AMOS adapter uses the
  // import-service database handle outside a transaction, so the row
  // is committed by the time this runs — safe to project here.
  // projectEquipment is internally wrapped in `safe()` and never
  // throws.
  //
  // Effective values come from `.returning(...)` (the persisted
  // row), not `cleanData`. A partial import update may omit
  // `vesselId`/`name`/`type`/`systemType`; treating omitted as
  // `null` would cause spurious retractions of edges whose
  // relational backing is still intact.
  const projectAfterCommit = async (
    persisted: {
      id: string;
      name: string | null;
      type: string | null;
      vesselId: string | null;
      systemType: string | null;
    },
    priorVesselId: string | null
  ) => {
    if (!orgId) {
      return;
    }
    if (priorVesselId && priorVesselId !== persisted.vesselId) {
      await retractInstalledOn(orgId, persisted.id, priorVesselId);
    }
    await projectEquipment(orgId, {
      id: persisted.id,
      name: persisted.name,
      type: persisted.type,
      vesselId: persisted.vesselId,
      systemType: persisted.systemType,
    });
  };

  if (existing) {
    const [updatedRow] = await database
      .update(equipment)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .returning({
        id: equipment.id,
        name: equipment.name,
        type: equipment.type,
        vesselId: equipment.vesselId,
        systemType: equipment.systemType,
      });
    if (updatedRow) {
      await projectAfterCommit(updatedRow, existing.vesselId ?? null);
    }
    return "updated";
  }

  const [insertedRow] = await database
    .insert(equipment)
    .values({
      ...cleanData,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as object as never)
    .returning({
      id: equipment.id,
      name: equipment.name,
      type: equipment.type,
      vesselId: equipment.vesselId,
      systemType: equipment.systemType,
    });
  if (insertedRow) {
    await projectAfterCommit(insertedRow, null);
  }
  return "inserted";
}

async function upsertAmosWorkOrder(
  database: AmosDatabase,
  orgId: string,
  data: Record<string, unknown>,
  vesselId?: string
): Promise<AmosUpsertResult> {
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith("_")) {
      cleanData[key] = value;
    }
  }

  cleanData["orgId"] = orgId;
  if (vesselId && !cleanData["vesselId"]) {
    cleanData["vesselId"] = vesselId;
  }

  const woNumber = cleanData["woNumber"] as string;
  if (!woNumber) {
    return "skipped";
  }

  // Check if exists by woNumber
  const [existing] = await database
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)))
    .limit(1);

  if (existing) {
    await database
      .update(workOrders)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)));
    return "updated";
  }

  await database.insert(workOrders).values({
    ...cleanData,
    createdAt: cleanData["createdAt"] ?? new Date(),
    updatedAt: new Date(),
  } as object as never);
  return "inserted";
}

async function upsertAmosPart(
  database: AmosDatabase,
  orgId: string,
  data: Record<string, unknown>
): Promise<AmosUpsertResult> {
  const cleanData: Record<string, unknown> = {};
  const stockData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_stock_")) {
      stockData[key.replace("_stock_", "")] = value;
    } else if (key.startsWith("_supplier_")) {
      // Handle supplier linking separately
    } else if (!key.startsWith("_")) {
      cleanData[key] = value;
    }
  }

  cleanData["orgId"] = orgId;
  const partNo = cleanData["partNo"] as string;
  if (!partNo) {
    return "skipped";
  }

  // Check if exists
  const [existing] = await database
    .select({ id: parts.id })
    .from(parts)
    .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)))
    .limit(1);

  let partId: string;

  if (existing) {
    await database
      .update(parts)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)));
    partId = existing.id;
  } else {
    const [inserted] = await database
      .insert(parts)
      .values({
        ...cleanData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as object as never)
      .returning({ id: parts.id });
    if (!inserted) {
      throw new Error("Failed to insert part during AMOS import");
    }
    partId = inserted.id;
  }

  // Upsert stock record if we have stock data
  if (Object.keys(stockData).length > 0) {
    const location = (stockData["location"] as string) || "MAIN";

    const [existingStock] = await database
      .select({ id: stock.id })
      .from(stock)
      .where(and(eq(stock.orgId, orgId), eq(stock.partId, partId), eq(stock.location, location)))
      .limit(1);

    if (existingStock) {
      await database
        .update(stock)
        .set({
          quantityOnHand: (stockData["quantityOnHand"] as number) ?? 0,
          unitCost: (stockData["unitCost"] as number) ?? 0,
          binLocation: (stockData["binLocation"] as string) ?? null,
          updatedAt: new Date(),
        })
        .where(eq(stock.id, existingStock.id));
    } else {
      await database.insert(stock).values({
        orgId,
        partId,
        partNo,
        location,
        quantityOnHand: (stockData["quantityOnHand"] as number) ?? 0,
        unitCost: (stockData["unitCost"] as number) ?? 0,
        binLocation: (stockData["binLocation"] as string) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as object as never);
    }
  }

  return existing ? "updated" : "inserted";
}

async function upsertAmosMaintenancePlan(
  orgId: string,
  data: Record<string, unknown>
): Promise<AmosUpsertResult> {
  // Maintenance plans map to maintenance_templates in ARUS
  // This is a simplified upsert — full implementation would parse
  // task lists and required parts from the AMOS format
  const cleanData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith("_")) {
      cleanData[key] = value;
    }
  }

  cleanData["orgId"] = orgId;

  // For now, store as a generic upsert
  // TODO: Map to maintenance_templates table when it exists with templateCode unique constraint
  // P2 #31 — AMOS imports report "skipped" rows to the operator UI;
  // emit a counter so the volume of unmapped maintenance-plan rows
  // is visible while the templates-table mapping is pending.
  logger.info("Maintenance plan import (stub)", { templateCode: cleanData["templateCode"] });
  recordUserVisibleStub("amos_import", "maintenance_plan_unmapped");
  return "skipped";
}
