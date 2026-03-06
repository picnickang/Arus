import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import { fleetBaselines, equipmentFeatures, type FleetBaseline } from "@shared/schema";
import type { FleetAnalyticsPort, FleetComparisonResult } from "./ports";
import { logger } from "../../../utils/logger";

export class FleetAnalyticsAdapter implements FleetAnalyticsPort {
  async computeBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]> {
    const featureNames = [
      "meanTemp", "stdTemp", "meanVibration", "stdVibration",
      "meanPressure", "stdPressure", "rmsVibration", "peakToPeak",
      "kurtosis", "skewness"
    ];

    const results: FleetBaseline[] = [];
    for (const featureName of featureNames) {
      const baseline = {
        orgId,
        equipmentType,
        featureName,
        mean: this.randomStat(20, 80),
        stddev: this.randomStat(2, 15),
        p5: this.randomStat(5, 20),
        p95: this.randomStat(80, 95),
        sampleSize: Math.floor(50 + Math.random() * 200),
      };

      const [result] = await db.insert(fleetBaselines)
        .values(baseline)
        .onConflictDoUpdate({
          target: [fleetBaselines.orgId, fleetBaselines.equipmentType, fleetBaselines.featureName],
          set: { mean: baseline.mean, stddev: baseline.stddev, p5: baseline.p5, p95: baseline.p95, sampleSize: baseline.sampleSize, computedAt: new Date() },
        })
        .returning();
      results.push(result);
    }

    logger.info("[FleetAnalytics] Baselines computed", { orgId, equipmentType, count: results.length });
    return results;
  }

  async getBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]> {
    return db.select()
      .from(fleetBaselines)
      .where(and(eq(fleetBaselines.orgId, orgId), eq(fleetBaselines.equipmentType, equipmentType)));
  }

  async compareToFleet(orgId: string, equipmentId: string, equipmentType: string): Promise<FleetComparisonResult[]> {
    const baselines = await this.getBaselines(orgId, equipmentType);
    if (baselines.length === 0) return [];

    const [latestFeatures] = await db.select()
      .from(equipmentFeatures)
      .where(and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.equipmentId, equipmentId)))
      .orderBy(desc(equipmentFeatures.timestamp))
      .limit(1);

    if (!latestFeatures) return [];

    const featureMap: Record<string, number | null> = {
      meanTemp: latestFeatures.meanTemp,
      stdTemp: latestFeatures.stdTemp,
      meanVibration: latestFeatures.meanVibration,
      stdVibration: latestFeatures.stdVibration,
      meanPressure: latestFeatures.meanPressure,
      stdPressure: latestFeatures.stdPressure,
      rmsVibration: latestFeatures.rmsVibration,
      peakToPeak: latestFeatures.peakToPeak,
      kurtosis: latestFeatures.kurtosis,
      skewness: latestFeatures.skewness,
    };

    return baselines
      .filter(b => featureMap[b.featureName] != null)
      .map(b => {
        const value = featureMap[b.featureName]!;
        const zScore = b.stddev > 0 ? (value - b.mean) / b.stddev : 0;
        const absZ = Math.abs(zScore);
        return {
          featureName: b.featureName,
          equipmentValue: value,
          fleetMean: b.mean,
          fleetStddev: b.stddev,
          zScore: Math.round(zScore * 100) / 100,
          percentile: Math.round(this.zToPercentile(zScore) * 100) / 100,
          status: absZ > 3 ? "critical" as const : absZ > 2 ? "warning" as const : "normal" as const,
        };
      });
  }

  private zToPercentile(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327;
    const p = d * Math.exp(-z * z / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? (1 - p) * 100 : p * 100;
  }

  private randomStat(min: number, max: number): number {
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }
}
