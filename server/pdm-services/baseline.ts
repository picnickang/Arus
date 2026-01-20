/**
 * PdM Services - Baseline Operations
 * Welford's algorithm for baseline management
 */

import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { pdmBaseline, PdmBaseline } from "../../shared/schema.js";
import type { BaselinePoint } from "./types.js";

/**
 * Upsert baseline point using Welford's online algorithm
 */
export async function upsertBaselinePoint(
  db: any,
  orgId: string,
  point: BaselinePoint
): Promise<void> {
  console.log(
    `[PdM Service] Upserting baseline for ${point.assetClass} ${point.assetId} with ${Object.keys(point.features).length} features`
  );

  for (const [feature, value] of Object.entries(point.features)) {
    if (!Number.isFinite(value)) {continue;}

    await db
      .insert(pdmBaseline)
      .values({
        orgId,
        vesselName: point.vesselName,
        assetId: point.assetId,
        assetClass: point.assetClass,
        feature,
        mu: value,
        sigma: 0,
        n: 1,
      })
      .onConflictDoUpdate({
        target: [
          pdmBaseline.orgId,
          pdmBaseline.vesselName,
          pdmBaseline.assetId,
          pdmBaseline.feature,
        ],
        set: {
          mu: sql`${pdmBaseline.mu} + (${value} - ${pdmBaseline.mu}) / (${pdmBaseline.n} + 1)`,
          sigma: sql`CASE 
            WHEN ${pdmBaseline.n} > 0 THEN
              SQRT(
                ((${pdmBaseline.n} - 1) * POWER(${pdmBaseline.sigma}, 2) + 
                 (${value} - ${pdmBaseline.mu}) * (${value} - (${pdmBaseline.mu} + (${value} - ${pdmBaseline.mu}) / (${pdmBaseline.n} + 1)))) 
                / GREATEST(1, ${pdmBaseline.n})
              )
            ELSE 0
          END`,
          n: sql`${pdmBaseline.n} + 1`,
          updatedAt: new Date(),
        },
      });
  }
}

/**
 * Get baseline statistics for asset
 */
export async function getBaselineStats(
  db: any,
  orgId: string,
  vesselName: string,
  assetId: string
): Promise<PdmBaseline[]> {
  return db
    .select()
    .from(pdmBaseline)
    .where(
      and(
        eq(pdmBaseline.orgId, orgId),
        eq(pdmBaseline.vesselName, vesselName),
        eq(pdmBaseline.assetId, assetId)
      )
    );
}
