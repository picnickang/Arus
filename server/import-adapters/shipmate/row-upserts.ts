import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { createLogger } from "../../lib/structured-logger";
import { equipment, parts, stock, workOrders } from "@shared/schema";
import type { ShipmateModuleType } from "./field-mapping";
import type { PendingEquipmentProjection, ShipmateUpsertResult } from "./types";

const logger = createLogger("shipmate-import");

export async function upsertShipmateRow(
  tx: typeof db,
  orgId: string,
  module: ShipmateModuleType,
  data: Record<string, unknown>,
  pendingEquipmentProjections: PendingEquipmentProjection[]
): Promise<ShipmateUpsertResult> {
  switch (module) {
    case "pms_equipment":
      return upsertEquipment(tx, orgId, data, pendingEquipmentProjections);
    case "pms_jobs":
      return upsertJob(tx, orgId, data);
    case "sps_stores":
      return upsertPart(tx, orgId, data);
    case "cms_crew_certs":
    case "cms_rest_hours":
      logger.debug("Crew data ingested for analytics (read-only)", {
        module,
        id: data["employeeId"],
      });
      return "skipped";
    default:
      return "skipped";
  }
}

async function upsertEquipment(
  tx: typeof db,
  orgId: string,
  data: Record<string, unknown>,
  pendingEquipmentProjections: PendingEquipmentProjection[]
): Promise<ShipmateUpsertResult> {
  const specifications: Record<string, unknown> = {};
  const cleanData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_spec_") && value != null) {
      specifications[key.replace("_spec_", "")] = value;
    } else if (key === "_vesselName") {
      // skip
    } else if (!key.startsWith("_")) {
      cleanData[key] = value;
    }
  }

  if (Object.keys(specifications).length > 0) {
    cleanData["specifications"] = specifications;
  }

  cleanData["orgId"] = orgId;
  cleanData["sourceSystem"] = "shipmate";

  const equipmentId = cleanData["id"] as string;
  if (!equipmentId) {
    return "skipped";
  }

  const [existing] = await tx
    .select({ id: equipment.id, vesselId: equipment.vesselId })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
    .limit(1);

  // Task #81 — Capture an equipment snapshot for post-commit graph
  // projection (both insert and update branches). We MUST NOT call
  // projectEquipment here: this method runs inside
  // `db.transaction(...)`, and firing pre-commit (even via
  // queueMicrotask) risks the graph leading relational truth when
  // the surrounding tx rolls back. `pendingEquipmentProjections`
  // is drained by `importFile` after the tx commits successfully.
  //
  // Effective field values are taken from the row that was actually
  // persisted (`.returning(...)`), NOT from `cleanData`. A partial
  // import update may omit `vesselId`/`name`/`type`/`systemType`,
  // and treating an omitted field as `null` would cause spurious
  // retractions (e.g. `INSTALLED_ON` would be torn down even though
  // the relational vessel assignment was unchanged).
  const enqueueProjection = (
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
    pendingEquipmentProjections.push({
      orgId,
      id: persisted.id,
      name: persisted.name,
      type: persisted.type,
      vesselId: persisted.vesselId,
      systemType: persisted.systemType,
      priorVesselId,
    });
  };

  if (existing) {
    const [updatedRow] = await tx
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
      enqueueProjection(updatedRow, existing.vesselId ?? null);
    }
    return "updated";
  }

  const [insertedRow] = await tx
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
    enqueueProjection(insertedRow, null);
  }
  return "inserted";
}

async function upsertJob(
  tx: typeof db,
  orgId: string,
  data: Record<string, unknown>
): Promise<ShipmateUpsertResult> {
  const cleanData: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) {
      if (value != null) {
        metadata[key.replace("_", "")] = value;
      }
    } else {
      cleanData[key] = value;
    }
  }

  cleanData["orgId"] = orgId;
  cleanData["sourceSystem"] = "shipmate";
  if (Object.keys(metadata).length > 0) {
    cleanData["metadata"] = metadata;
  }

  const woNumber = cleanData["woNumber"] as string;
  if (!woNumber) {
    return "skipped";
  }

  const [existing] = await tx
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)))
    .limit(1);

  if (existing) {
    await tx
      .update(workOrders)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)));
    return "updated";
  }

  await tx.insert(workOrders).values({
    ...cleanData,
    createdAt: cleanData["createdAt"] ?? new Date(),
    updatedAt: new Date(),
  } as object as never);
  return "inserted";
}

async function upsertPart(
  tx: typeof db,
  orgId: string,
  data: Record<string, unknown>
): Promise<ShipmateUpsertResult> {
  const cleanData: Record<string, unknown> = {};
  const stockData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_stock_")) {
      stockData[key.replace("_stock_", "")] = value;
    } else if (!key.startsWith("_")) {
      cleanData[key] = value;
    }
  }

  cleanData["orgId"] = orgId;
  cleanData["sourceSystem"] = "shipmate";

  const partNo = cleanData["partNo"] as string;
  if (!partNo) {
    return "skipped";
  }

  const [existing] = await tx
    .select({ id: parts.id })
    .from(parts)
    .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)))
    .limit(1);

  let partId: string;

  if (existing) {
    await tx
      .update(parts)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)));
    partId = existing.id;
  } else {
    const [inserted] = await tx
      .insert(parts)
      .values({
        ...cleanData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as object as never)
      .returning({ id: parts.id });
    if (!inserted) {
      throw new Error("import: parts insert returned no row");
    }
    partId = inserted.id;
  }

  // Upsert stock (inside the same transaction)
  if (Object.keys(stockData).length > 0) {
    const location = (stockData["location"] as string) || "MAIN";

    const [existingStock] = await tx
      .select({ id: stock.id })
      .from(stock)
      .where(and(eq(stock.orgId, orgId), eq(stock.partId, partId), eq(stock.location, location)))
      .limit(1);

    if (existingStock) {
      await tx
        .update(stock)
        .set({
          quantityOnHand: (stockData["quantityOnHand"] as number) ?? 0,
          unitCost: (stockData["unitCost"] as number) ?? 0,
          updatedAt: new Date(),
        })
        .where(eq(stock.id, existingStock.id));
    } else {
      await tx.insert(stock).values({
        orgId,
        partId,
        partNo,
        location,
        quantityOnHand: (stockData["quantityOnHand"] as number) ?? 0,
        unitCost: (stockData["unitCost"] as number) ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as object as never);
    }
  }

  return existing ? "updated" : "inserted";
}
