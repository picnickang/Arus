/**
 * Equipment - Health helpers
 *
 * Pure / `this`-free helpers backing the data-driven PdM health index, split
 * out of db-equipment.ts to keep that file within the source-size ratchet.
 */

import { eq, and, gte, desc } from "drizzle-orm";
import { db } from "../../db-config";
import { pdmScoreLogs as pdmScoreLogsTable } from "@shared/schema-runtime";

/**
 * Operational health status from the data-driven PdM health index. Bands match
 * the per-equipment health route (server/domains/pdm-platform/health/routes.ts:
 * healthy >=70, warning >=30, critical <30) so fleet aggregates, compliance
 * status counts (countByStatus), and risk levels all key off the same scale.
 * Inactive equipment keeps its operational "inactive" state regardless of score.
 */
export function deriveHealthStatus(
  isActive: boolean | null | undefined,
  healthIndex: number
): string {
  if (!isActive) {
    return "inactive";
  }
  if (healthIndex >= 70) {
    return "healthy";
  }
  if (healthIndex >= 30) {
    return "warning";
  }
  return "critical";
}

/**
 * Latest PdM health index per equipment, keyed by equipmentId.
 *
 * Reads pdm_score_logs — the table the daily scoring producer fills
 * (server/job-processors/pdm-scoring-processor.ts) — and keeps the most
 * recent non-null health_idx per equipment within a freshness window. The
 * 30-day window bounds the scan and stops a stale score from masquerading
 * as current health: the daily cron tolerates an extended outage, but
 * anything older falls back to the neutral default in getEquipmentHealth.
 * Dual-mode safe — pdm_score_logs is now a shared schema (cloud Postgres +
 * vessel SQLite). An optional equipmentId scopes the scan for the
 * single-equipment health route.
 */
export async function getLatestHealthIndexByEquipment(
  orgId: string,
  equipmentId?: string
): Promise<Map<string, number>> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const conditions = [eq(pdmScoreLogsTable.orgId, orgId), gte(pdmScoreLogsTable.ts, cutoff)];
  if (equipmentId) {
    conditions.push(eq(pdmScoreLogsTable.equipmentId, equipmentId));
  }
  const rows = await db
    .select({
      equipmentId: pdmScoreLogsTable.equipmentId,
      healthIdx: pdmScoreLogsTable.healthIdx,
    })
    .from(pdmScoreLogsTable)
    .where(and(...conditions))
    .orderBy(desc(pdmScoreLogsTable.ts));
  const latest = new Map<string, number>();
  for (const row of rows) {
    // Rows arrive newest-first; the first non-null reading per equipment wins.
    if (row.healthIdx == null || latest.has(row.equipmentId)) {
      continue;
    }
    latest.set(row.equipmentId, Math.round(row.healthIdx));
  }
  return latest;
}
