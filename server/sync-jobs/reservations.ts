/**
 * Sync Jobs - Reservation Overflow Check
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("SyncJobs:Reservations");
import { db } from "../db.js";
import { parts, stock, reservations } from "@shared/schema.js";
import { eq, sql, and } from "drizzle-orm";
import type { DataIntegrityCheckResult } from "./types.js";

/**
 * Check if reservations exceed available stock levels
 */
export async function checkReservationOverflow(orgId: string): Promise<DataIntegrityCheckResult> {
  const issues: DataIntegrityCheckResult["issues"] = [];

  try {
    const reservationOverflows = await db
      .select({
        partId: stock.partId,
        partName: parts.name,
        onHand: stock.quantityOnHand,
        reserved: sql<number>`COALESCE(SUM(${reservations.quantity}), 0)::float8`,
      })
      .from(stock)
      .innerJoin(parts, eq(stock.partId, parts.id))
      .leftJoin(
        reservations,
        and(eq(reservations.partId, stock.partId), eq(reservations.status, "active"))
      )
      .where(eq(stock.orgId, orgId))
      .groupBy(stock.partId, stock.quantityOnHand, parts.name)
      .having(sql`COALESCE(SUM(${reservations.quantity}), 0) > ${stock.quantityOnHand}`);

    for (const overflow of reservationOverflows) {
      issues.push({
        code: "RESERVATION_EXCEEDS_STOCK",
        message: `Reservations (${overflow.reserved}) exceed available stock (${overflow.onHand}) for ${overflow.partName}`,
        severity: "high",
        reference: {
          partId: overflow.partId,
          onHand: overflow.onHand,
          reserved: overflow.reserved,
          overage: Number(overflow.reserved) - Number(overflow.onHand),
        },
      });
    }

    const entitiesChecked = await db
      .select({ count: sql<number>`count(*)` })
      .from(reservations)
      .innerJoin(stock, eq(reservations.partId, stock.partId))
      .where(and(eq(stock.orgId, orgId), eq(reservations.status, "active")))
      .then((r) => r[0]?.count || 0);

    return { issues, entitiesChecked };
  } catch (error) {
    logger.error("Reservation overflow check failed:", undefined, error);
    return {
      issues: [
        {
          code: "RESERVATION_CHECK_ERROR",
          message: `Failed to check reservation overflows: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "high",
        },
      ],
      entitiesChecked: 0,
    };
  }
}
