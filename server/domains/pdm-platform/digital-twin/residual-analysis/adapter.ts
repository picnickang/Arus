import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../../../db";
import { twinResiduals, type TwinResidual, type InsertTwinResidual } from "@shared/schema";
import type { ResidualAnalysisPort, ResidualRanking } from "./ports";

export class ResidualAnalysisAdapter implements ResidualAnalysisPort {
  async computeResiduals(_orgId: string, _twinId: string): Promise<TwinResidual[]> {
    throw new Error("Use ResidualAnalysisService.computeResiduals instead");
  }

  async getResidualsByTwin(orgId: string, twinId: string, limit = 100): Promise<TwinResidual[]> {
    return db
      .select()
      .from(twinResiduals)
      .where(and(eq(twinResiduals.orgId, orgId), eq(twinResiduals.twinId, twinId)))
      .orderBy(desc(twinResiduals.timestamp))
      .limit(limit);
  }

  async getResidualRankings(orgId: string): Promise<ResidualRanking[]> {
    const rows = await db
      .select({
        twinId: twinResiduals.twinId,
        sensorType: twinResiduals.sensorType,
        avgResidual: sql<number>`avg(abs(${twinResiduals.residual}))`.as("avg_residual"),
        avgZScore: sql<number>`avg(abs(${twinResiduals.zScore}))`.as("avg_z_score"),
        maxZScore: sql<number>`max(abs(${twinResiduals.zScore}))`.as("max_z_score"),
        count: sql<number>`count(*)::int`.as("cnt"),
      })
      .from(twinResiduals)
      .where(eq(twinResiduals.orgId, orgId))
      .groupBy(twinResiduals.twinId, twinResiduals.sensorType)
      .orderBy(sql`avg(abs(${twinResiduals.zScore})) desc`)
      .limit(50);

    return rows.map((r) => ({
      twinId: r.twinId,
      sensorType: r.sensorType,
      avgResidual: round(r.avgResidual),
      avgZScore: round(r.avgZScore),
      maxZScore: round(r.maxZScore),
      severity:
        r.maxZScore > 3
          ? ("critical" as const)
          : r.avgZScore > 2
            ? ("warning" as const)
            : ("normal" as const),
      count: r.count,
    }));
  }

  async storeResiduals(records: InsertTwinResidual[]): Promise<TwinResidual[]> {
    if (records.length === 0) {
      return [];
    }
    return db.insert(twinResiduals).values(records).returning();
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
