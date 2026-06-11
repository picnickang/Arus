import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../../../db";
import { fleetBaselines, equipmentFeatures, equipment, type FleetBaseline } from "@shared/schema";
import type { FleetAnalyticsPort, FleetComparisonResult } from "./ports";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("PdmPlatform:FleetAnalytics");

type FeatureExtractor = (row: typeof equipmentFeatures.$inferSelect) => number | null;

const FEATURE_EXTRACTORS: Record<string, FeatureExtractor> = {
  meanTemp: (r) => r.meanTemp,
  stdTemp: (r) => r.stdTemp,
  meanVibration: (r) => r.meanVibration,
  stdVibration: (r) => r.stdVibration,
  meanPressure: (r) => r.meanPressure,
  stdPressure: (r) => r.stdPressure,
  rmsVibration: (r) => r.rmsVibration,
  peakToPeak: (r) => r.peakToPeak,
  kurtosis: (r) => r.kurtosis,
  skewness: (r) => r.skewness,
};

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const lo = sorted[lower] ?? 0;
  const hi = sorted[upper] ?? 0;
  if (lower === upper) {
    return lo;
  }
  return lo + (idx - lower) * (hi - lo);
}

export class FleetAnalyticsAdapter implements FleetAnalyticsPort {
  async computeBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]> {
    const matchingEquipment = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(and(eq(equipment.orgId, orgId), eq(equipment.type, equipmentType)));

    const equipmentIds = matchingEquipment.map((e) => e.id);

    let allFeatures;
    if (equipmentIds.length > 0) {
      allFeatures = await db
        .select()
        .from(equipmentFeatures)
        .where(
          and(
            eq(equipmentFeatures.orgId, orgId),
            inArray(equipmentFeatures.equipmentId, equipmentIds)
          )
        )
        .orderBy(desc(equipmentFeatures.timestamp))
        .limit(2000);
    } else {
      allFeatures = await db
        .select()
        .from(equipmentFeatures)
        .where(eq(equipmentFeatures.orgId, orgId))
        .orderBy(desc(equipmentFeatures.timestamp))
        .limit(2000);
      logger.warn("[FleetAnalytics] No equipment found for type, using all features as fallback", {
        orgId,
        equipmentType,
      });
    }

    if (allFeatures.length === 0) {
      logger.warn("[FleetAnalytics] No feature records found for baseline computation", {
        orgId,
        equipmentType,
      });
      return [];
    }

    const results: FleetBaseline[] = [];
    for (const [featureName, extractor] of Object.entries(FEATURE_EXTRACTORS)) {
      const values = allFeatures.map(extractor).filter((v): v is number => v != null && !isNaN(v));

      if (values.length < 3) {
        continue;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
      const stddev = Math.sqrt(variance);
      const p5 = percentile(sorted, 5);
      const p95 = percentile(sorted, 95);

      const baseline = {
        orgId,
        equipmentType,
        featureName,
        mean: round(mean),
        stddev: round(stddev),
        p5: round(p5),
        p95: round(p95),
        sampleSize: n,
      };

      const [result] = await db
        .insert(fleetBaselines)
        .values(baseline)
        .onConflictDoUpdate({
          target: [fleetBaselines.orgId, fleetBaselines.equipmentType, fleetBaselines.featureName],
          set: {
            mean: baseline.mean,
            stddev: baseline.stddev,
            p5: baseline.p5,
            p95: baseline.p95,
            sampleSize: baseline.sampleSize,
            computedAt: new Date(),
          },
        })
        .returning();
      if (!result) {
        throw new Error("computeBaselines: insert returned no row");
      }
      results.push(result);
    }

    logger.info("[FleetAnalytics] Baselines computed from feature records", {
      orgId,
      equipmentType,
      count: results.length,
      sourceRecords: allFeatures.length,
    });
    return results;
  }

  async getBaselines(orgId: string, equipmentType: string): Promise<FleetBaseline[]> {
    return db
      .select()
      .from(fleetBaselines)
      .where(and(eq(fleetBaselines.orgId, orgId), eq(fleetBaselines.equipmentType, equipmentType)));
  }

  async compareToFleet(
    orgId: string,
    equipmentId: string,
    equipmentType: string
  ): Promise<FleetComparisonResult[]> {
    const baselines = await this.getBaselines(orgId, equipmentType);
    if (baselines.length === 0) {
      return [];
    }

    const [latestFeatures] = await db
      .select()
      .from(equipmentFeatures)
      .where(
        and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.equipmentId, equipmentId))
      )
      .orderBy(desc(equipmentFeatures.timestamp))
      .limit(1);

    if (!latestFeatures) {
      return [];
    }

    const featureMap: Record<string, number | null> = {};
    for (const [name, extractor] of Object.entries(FEATURE_EXTRACTORS)) {
      featureMap[name] = extractor(latestFeatures);
    }

    return baselines
      .filter((b) => featureMap[b.featureName] != null)
      .map((b) => {
        const value = featureMap[b.featureName]!;
        const zScore = b.stddev && b.stddev > 0 ? (value - (b.mean ?? 0)) / b.stddev : 0;
        const absZ = Math.abs(zScore);
        const pctl = this.zToPercentile(zScore);
        const aboveFleet = value > (b.mean ?? 0);

        return {
          featureName: b.featureName,
          equipmentValue: value,
          fleetMean: b.mean ?? 0,
          fleetStddev: b.stddev ?? 0,
          fleetP5: b.p5 ?? 0,
          fleetP95: b.p95 ?? 0,
          zScore: round(zScore),
          percentile: round(pctl),
          aboveFleetAvg: aboveFleet,
          status:
            absZ > 3
              ? ("critical" as const)
              : absZ > 2
                ? ("warning" as const)
                : ("normal" as const),
        };
      });
  }

  private zToPercentile(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327;
    const p =
      d *
      Math.exp((-z * z) / 2) *
      t *
      (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? (1 - p) * 100 : p * 100;
  }
}
