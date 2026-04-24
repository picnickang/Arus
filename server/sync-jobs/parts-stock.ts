/**
 * Sync Jobs - Parts Stock Alignment Check
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("SyncJobs:PartsStock");
import { db } from "../db.js";
import { parts, stock } from "@shared/schema.js";
import { eq, sql, and } from "drizzle-orm";
import type { CheckResult } from "./types.js";

/**
 * Check if parts catalog prices are synchronized with stock unit costs
 */
export async function checkPartsStockAlignment(orgId: string): Promise<CheckResult> {
  const issues: CheckResult["issues"] = [];

  try {
    await db
      .update(stock)
      .set({
        unitCost: sql`(SELECT ${parts.standardCost} FROM ${parts} WHERE ${parts.id} = ${stock.partId})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stock.orgId, orgId),
          sql`${stock.unitCost} != (SELECT ${parts.standardCost} FROM ${parts} WHERE ${parts.id} = ${stock.partId} AND ${parts.orgId} = ${orgId})`
        )
      );

    const misalignedStock = await db
      .select({
        partId: stock.partId,
        stockUnitCost: stock.unitCost,
        partsStandardCost: parts.standardCost,
        partName: parts.name,
      })
      .from(stock)
      .innerJoin(parts, eq(stock.partId, parts.id))
      .where(and(eq(stock.orgId, orgId), sql`${stock.unitCost} != ${parts.standardCost}`));

    for (const item of misalignedStock) {
      issues.push({
        code: "PARTS_STOCK_PRICE_MISMATCH",
        message: `Price mismatch for ${item.partName}: stock shows $${item.stockUnitCost}, parts catalog shows $${item.partsStandardCost}`,
        severity: "medium",
        reference: {
          partId: item.partId,
          stockPrice: item.stockUnitCost,
          catalogPrice: item.partsStandardCost,
        },
      });
    }

    const entitiesChecked = await db
      .select({ count: sql<number>`count(*)` })
      .from(stock)
      .where(eq(stock.orgId, orgId))
      .then((r) => r[0]?.count || 0);

    return { issues, entitiesChecked };
  } catch (error) {
    logger.error("Parts-stock alignment check failed:", undefined, error);
    return {
      issues: [
        {
          code: "PARTS_STOCK_CHECK_ERROR",
          message: `Failed to check parts-stock alignment: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "high",
        },
      ],
      entitiesChecked: 0,
    };
  }
}
