import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "../../db-config";
import { inventoryMovements, stock, workOrderParts, workOrders } from "@shared/schema-runtime";
import type { WorkOrderParts } from "@shared/schema-runtime";
import {
  fireInventoryMovementProjections,
  type PendingMovementProjection,
} from "./inventory-projections.js";
import { allocateReservation, distributeRelease } from "./reservation-ledger.js";

export async function addBulkPartsToWorkOrder(
  workOrderId: string,
  partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>,
  orgId: string
): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
  if (!orgId) {
    throw new Error("orgId is required for tenant isolation");
  }
  const result = {
    added: [] as WorkOrderParts[],
    updated: [] as WorkOrderParts[],
    errors: [] as string[],
  };
  // No graph projections here — addBulkPartsToWorkOrder only writes
  // to `work_order_parts`, not `inventory_movements`. REQUIRES_PART
  // edges are produced by the reserve / release / return paths via
  // fireProjectionsAfterCommit().

  await db.transaction(async (tx) => {
    const existingParts = await tx
      .select()
      .from(workOrderParts)
      .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
    const existingMap = new Map<string, WorkOrderParts>(
      existingParts.map((p: WorkOrderParts) => [p.partId, p] as [string, WorkOrderParts])
    );

    for (const partToAdd of partsToAdd) {
      try {
        const [stockRow] = await tx
          .select()
          .from(stock)
          .where(and(eq(stock.partId, partToAdd.partId), eq(stock.orgId, orgId)))
          .limit(1);
        const unitCost = stockRow?.unitCost || 0;
        const existing = existingMap.get(partToAdd.partId);

        if (existing) {
          const newQty = (existing.quantityUsed ?? 0) + partToAdd.quantity;
          const [updated] = await tx
            .update(workOrderParts)
            .set({
              quantityUsed: newQty,
              totalCost: newQty * unitCost,
              notes: partToAdd.notes
                ? existing.notes
                  ? `${existing.notes}; ${partToAdd.notes}`
                  : partToAdd.notes
                : existing.notes,
              updatedAt: new Date(),
            } as never)
            .where(and(eq(workOrderParts.id, existing.id), eq(workOrderParts.orgId, orgId)))
            .returning();
          if (!updated) {
            throw new Error("addBulkParts: update returned no row");
          }
          result.updated.push(updated);
          existingMap.set(partToAdd.partId, updated);
        } else {
          const [newPart] = await tx
            .insert(workOrderParts)
            .values({
              id: randomUUID(),
              orgId,
              workOrderId,
              partId: partToAdd.partId,
              quantityUsed: partToAdd.quantity,
              unitCost,
              totalCost: partToAdd.quantity * unitCost,
              usedBy: partToAdd.usedBy,
              notes: partToAdd.notes,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never)
            .returning();
          if (!newPart) {
            throw new Error("addBulkParts: insert returned no row");
          }
          result.added.push(newPart);
          existingMap.set(partToAdd.partId, newPart);
        }
      } catch (err) {
        result.errors.push(
          `Failed to add part ${partToAdd.partId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  });

  return result;
}

export async function reservePartsForWorkOrder(workOrderId: string, orgId: string): Promise<void> {
  if (!orgId) {
    throw new Error("orgId is required for tenant isolation");
  }

  const pendingProjections: PendingMovementProjection[] = [];
  await db.transaction(async (tx) => {
    const woParts = await tx
      .select()
      .from(workOrderParts)
      .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

    const partQuantities = new Map<string, number>();
    for (const woPart of woParts) {
      partQuantities.set(
        woPart.partId,
        (partQuantities.get(woPart.partId) || 0) + (woPart.quantityUsed ?? 0)
      );
    }

    // Use Array.from to avoid downlevelIteration target requirement
    for (const [partId, totalQty] of Array.from(partQuantities.entries())) {
      const { rows } = await allocateReservation(tx, partId, orgId, totalQty);
      for (const alloc of rows) {
        const movementId = randomUUID();
        await tx.insert(inventoryMovements).values({
          id: movementId,
          orgId,
          partId,
          workOrderId,
          movementType: "reserve",
          quantity: alloc.reserved,
          quantityBefore: alloc.onHand,
          quantityAfter: alloc.onHand,
          reservedBefore: alloc.prevReserved,
          reservedAfter: alloc.prevReserved + alloc.reserved,
          performedBy: "system",
          notes: `Reserved ${alloc.reserved} units for work order ${workOrderId} (stock ${alloc.stockId})`,
          createdAt: new Date(),
        });
        pendingProjections.push({ movementId, partId, workOrderId, movementType: "reserve" });
      }
    }
  });
  await fireInventoryMovementProjections(orgId, pendingProjections);
}

export async function addBulkPartsAndReserveInventory(
  workOrderId: string,
  partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>,
  orgId: string
): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> {
  if (!orgId) {
    throw new Error("orgId is required for tenant isolation");
  }
  const result = {
    added: [] as WorkOrderParts[],
    updated: [] as WorkOrderParts[],
    errors: [] as string[],
  };
  const pendingProjections: PendingMovementProjection[] = [];

  await db.transaction(async (tx) => {
    const existingParts = await tx
      .select()
      .from(workOrderParts)
      .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));
    const existingMap = new Map<string, WorkOrderParts>(
      existingParts.map((p: WorkOrderParts) => [p.partId, p] as [string, WorkOrderParts])
    );

    for (const partToAdd of partsToAdd) {
      try {
        const [stockRow] = await tx
          .select()
          .from(stock)
          .where(and(eq(stock.partId, partToAdd.partId), eq(stock.orgId, orgId)))
          .limit(1);
        const unitCost = stockRow?.unitCost || 0;
        const existing = existingMap.get(partToAdd.partId);

        if (existing) {
          const newQty = (existing.quantityUsed ?? 0) + partToAdd.quantity;
          const [updated] = await tx
            .update(workOrderParts)
            .set({
              quantityUsed: newQty,
              totalCost: newQty * unitCost,
              notes: partToAdd.notes
                ? existing.notes
                  ? `${existing.notes}; ${partToAdd.notes}`
                  : partToAdd.notes
                : existing.notes,
              updatedAt: new Date(),
            } as never)
            .where(and(eq(workOrderParts.id, existing.id), eq(workOrderParts.orgId, orgId)))
            .returning();
          if (!updated) {
            throw new Error("addBulkPartsAndReserveInventory: update returned no row");
          }
          result.updated.push(updated);
          existingMap.set(partToAdd.partId, updated);
        } else {
          const [newPart] = await tx
            .insert(workOrderParts)
            .values({
              id: randomUUID(),
              orgId,
              workOrderId,
              partId: partToAdd.partId,
              quantityUsed: partToAdd.quantity,
              unitCost,
              totalCost: partToAdd.quantity * unitCost,
              usedBy: partToAdd.usedBy,
              notes: partToAdd.notes,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never)
            .returning();
          if (!newPart) {
            throw new Error("addBulkPartsAndReserveInventory: insert returned no row");
          }
          result.added.push(newPart);
          existingMap.set(partToAdd.partId, newPart);
        }
      } catch (err) {
        result.errors.push(
          `Failed to add part ${partToAdd.partId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (result.added.length > 0 || result.updated.length > 0) {
      const allWoParts = await tx
        .select()
        .from(workOrderParts)
        .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

      const partQuantities = new Map<string, number>();
      for (const woPart of allWoParts) {
        partQuantities.set(
          woPart.partId,
          (partQuantities.get(woPart.partId) || 0) + (woPart.quantityUsed ?? 0)
        );
      }

      for (const [partId, totalQty] of Array.from(partQuantities.entries())) {
        const { rows } = await allocateReservation(tx, partId, orgId, totalQty);
        for (const alloc of rows) {
          const movementId = randomUUID();
          await tx.insert(inventoryMovements).values({
            id: movementId,
            orgId,
            partId,
            workOrderId,
            movementType: "reserve",
            quantity: alloc.reserved,
            quantityBefore: alloc.onHand,
            quantityAfter: alloc.onHand,
            reservedBefore: alloc.prevReserved,
            reservedAfter: alloc.prevReserved + alloc.reserved,
            performedBy: "system",
            notes: `Reserved for work order ${workOrderId} (stock ${alloc.stockId})`,
            createdAt: new Date(),
          });
          pendingProjections.push({ movementId, partId, workOrderId, movementType: "reserve" });
        }
      }
    }
  });
  await fireInventoryMovementProjections(orgId, pendingProjections);

  return result;
}

export async function releasePartsFromWorkOrder(
  workOrderId: string,
  orgId: string
): Promise<void> {
  if (!orgId) {
    throw new Error("orgId is required for tenant isolation");
  }

  const pendingProjections: PendingMovementProjection[] = [];
  await db.transaction(async (tx) => {
    const woParts = await tx
      .select()
      .from(workOrderParts)
      .where(and(eq(workOrderParts.workOrderId, workOrderId), eq(workOrderParts.orgId, orgId)));

    const partQuantities = new Map<string, number>();
    for (const woPart of woParts) {
      partQuantities.set(
        woPart.partId,
        (partQuantities.get(woPart.partId) || 0) + (woPart.quantityUsed ?? 0)
      );
    }

    for (const [partId, totalQty] of Array.from(partQuantities.entries())) {
      const { rows } = await distributeRelease(tx, partId, orgId, totalQty);
      for (const rel of rows) {
        const movementId = randomUUID();
        await tx.insert(inventoryMovements).values({
          id: movementId,
          orgId,
          partId,
          workOrderId,
          movementType: "release",
          quantity: rel.released,
          quantityBefore: rel.onHand,
          quantityAfter: rel.onHand,
          reservedBefore: rel.prevReserved,
          reservedAfter: rel.prevReserved - rel.released,
          performedBy: "system",
          notes: `Released from work order ${workOrderId} (stock ${rel.stockId})`,
          createdAt: new Date(),
        });
        pendingProjections.push({ movementId, partId, workOrderId, movementType: "release" });
      }
    }
  });
  await fireInventoryMovementProjections(orgId, pendingProjections);
}

export async function removePartAndRestoreInventory(
  workOrderPartId: string,
  orgId: string,
  performedBy: string
): Promise<void> {
  if (!orgId) {
    throw new Error("orgId is required for tenant isolation");
  }
  const pendingProjections: PendingMovementProjection[] = [];
  await db.transaction(async (tx) => {
    const [woPart] = await tx
      .select()
      .from(workOrderParts)
      .where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));
    if (!woPart) {
      throw new Error(`Work order part ${workOrderPartId} not found`);
    }

    const { rows } = await distributeRelease(tx, woPart.partId, orgId, woPart.quantityUsed ?? 0);
    for (const rel of rows) {
      const movementId = randomUUID();
      await tx.insert(inventoryMovements).values({
        id: movementId,
        orgId,
        partId: woPart.partId,
        workOrderId: woPart.workOrderId,
        movementType: "return",
        quantity: rel.released,
        quantityBefore: rel.onHand,
        quantityAfter: rel.onHand,
        reservedBefore: rel.prevReserved,
        reservedAfter: rel.prevReserved - rel.released,
        performedBy,
        notes: `Returned ${rel.released} units from work order (stock ${rel.stockId})`,
        createdAt: new Date(),
      });
      pendingProjections.push({
        movementId,
        partId: woPart.partId,
        workOrderId: woPart.workOrderId,
        movementType: "return",
      });
    }

    await tx
      .delete(workOrderParts)
      .where(and(eq(workOrderParts.id, workOrderPartId), eq(workOrderParts.orgId, orgId)));

    // Defer projection until after the surrounding tx commits below
    // (see fireProjectionsAfterCommit at end of method).

    const [wo] = await tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
    if (wo) {
      const remainingParts = await tx
        .select()
        .from(workOrderParts)
        .where(
          and(eq(workOrderParts.workOrderId, woPart.workOrderId), eq(workOrderParts.orgId, orgId))
        );
      const totalPartsCost = remainingParts.reduce(
        (sum: number, p: WorkOrderParts) => sum + (p.totalCost || 0),
        0
      );
      await tx
        .update(workOrders)
        .set({
          totalPartsCost,
          totalCost: totalPartsCost + (wo.totalLaborCost || 0),
          updatedAt: new Date(),
        })
        .where(and(eq(workOrders.id, woPart.workOrderId), eq(workOrders.orgId, orgId)));
    }
  });
  await fireInventoryMovementProjections(orgId, pendingProjections);
}
