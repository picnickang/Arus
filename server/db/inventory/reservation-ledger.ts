import { and, eq, sql } from "drizzle-orm";

import type { DbTransaction } from "../../db-config";
import { stock } from "@shared/schema-runtime";
import type { Stock } from "@shared/schema-runtime";

export interface ReservationAllocation {
  stockId: string;
  reserved: number;
  onHand: number;
  prevReserved: number;
}

export interface ReservationRelease {
  stockId: string;
  released: number;
  onHand: number;
  prevReserved: number;
}

export async function allocateReservation(
  tx: DbTransaction,
  partId: string,
  orgId: string,
  quantity: number
): Promise<{ rows: ReservationAllocation[] }> {
  const allStock = await tx
    .select()
    .from(stock)
    .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)))
    .orderBy(sql`(${stock.quantityOnHand} - ${stock.quantityReserved}) DESC`);
  if (allStock.length === 0) {
    throw new Error(`Part ${partId} not found in stock`);
  }
  const totalAvailable = allStock.reduce(
    (s: number, r: Stock) => s + Math.max(0, (r.quantityOnHand ?? 0) - (r.quantityReserved ?? 0)),
    0
  );
  if (totalAvailable < quantity) {
    throw new Error(
      `Insufficient stock for part ${partId}: available=${totalAvailable}, requested=${quantity}`
    );
  }
  const allocated: ReservationAllocation[] = [];
  let remaining = quantity;
  for (const row of allStock) {
    if (remaining <= 0) {
      break;
    }
    const avail = Math.max(0, (row.quantityOnHand ?? 0) - (row.quantityReserved ?? 0));
    const toReserve = Math.min(remaining, avail);
    if (toReserve > 0) {
      await tx
        .update(stock)
        .set({
          quantityReserved: (row.quantityReserved ?? 0) + toReserve,
          updatedAt: new Date(),
        })
        .where(eq(stock.id, row.id));
      allocated.push({
        stockId: row.id,
        reserved: toReserve,
        onHand: row.quantityOnHand ?? 0,
        prevReserved: row.quantityReserved ?? 0,
      });
      remaining -= toReserve;
    }
  }
  return { rows: allocated };
}

export async function distributeRelease(
  tx: DbTransaction,
  partId: string,
  orgId: string,
  quantity: number
): Promise<{ rows: ReservationRelease[] }> {
  const allStock = await tx
    .select()
    .from(stock)
    .where(
      and(eq(stock.partId, partId), eq(stock.orgId, orgId), sql`${stock.quantityReserved} > 0`)
    )
    .orderBy(sql`${stock.quantityReserved} DESC`);
  const released: ReservationRelease[] = [];
  let remaining = quantity;
  for (const row of allStock) {
    if (remaining <= 0) {
      break;
    }
    const reserved = row.quantityReserved ?? 0;
    const toRelease = Math.min(remaining, reserved);
    if (toRelease > 0) {
      await tx
        .update(stock)
        .set({ quantityReserved: reserved - toRelease, updatedAt: new Date() })
        .where(eq(stock.id, row.id));
      released.push({
        stockId: row.id,
        released: toRelease,
        onHand: row.quantityOnHand ?? 0,
        prevReserved: reserved,
      });
      remaining -= toRelease;
    }
  }
  return { rows: released };
}
