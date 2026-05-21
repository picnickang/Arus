import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../../../db";
import {
  modelDriftMetrics,
  equipmentFeatures,
  fleetBaselines,
  modelVersions,
  type ModelDriftMetric,
} from "@shared/schema";
import type { ModelMonitoringPort } from "./ports";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("PdmPlatform:Monitoring");

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

interface FeatureDistribution {
  mean: number;
  std: number;
}

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

export class ModelMonitoringAdapter implements ModelMonitoringPort {
  async computeDrift(
    orgId: string,
    modelVersionId: string,
    windowDays = 7
  ): Promise<ModelDriftMetric[]> {
    const trainingRef = await this.getTrainingReference(orgId, modelVersionId);
    const liveDistributions = await this.getLiveDistributions(orgId, windowDays);

    if (Object.keys(trainingRef).length === 0 && Object.keys(liveDistributions).length === 0) {
      logger.warn("[ModelMonitoring] No data available for drift computation", {
        orgId,
        modelVersionId,
      });
      return [];
    }

    const featureNames = [
      ...new Set([...Object.keys(trainingRef), ...Object.keys(liveDistributions)]),
    ];
    const results: ModelDriftMetric[] = [];

    for (const featureName of featureNames) {
      const training = trainingRef[featureName];
      const live = liveDistributions[featureName];

      if (!training && !live) {
        continue;
      }

      const trainingMean = training?.mean ?? live?.mean ?? 0;
      const trainingStd = training?.std ?? live?.std ?? 1;
      const liveMean = live?.mean ?? trainingMean;
      const liveStd = live?.std ?? trainingStd;

      const driftScore =
        trainingStd > 0 ? round(Math.abs(liveMean - trainingMean) / trainingStd) : 0;
      const driftDetected = driftScore > 2.0;

      const [result] = await db
        .insert(modelDriftMetrics)
        .values({
          orgId,
          modelVersionId,
          featureName,
          trainingMean: round(trainingMean),
          trainingStd: round(trainingStd),
          liveMean: round(liveMean),
          liveStd: round(liveStd),
          driftScore,
          driftDetected,
          windowDays,
        })
        .returning();
      results.push(result);
    }

    const drifted = results.filter((r) => r.driftDetected).length;
    logger.info("[ModelMonitoring] Drift computed from real data", {
      orgId,
      modelVersionId,
      total: results.length,
      drifted,
      method: "normalized_mean_shift",
    });
    return results;
  }

  private async getTrainingReference(
    orgId: string,
    modelVersionId: string
  ): Promise<Record<string, FeatureDistribution>> {
    const ref: Record<string, FeatureDistribution> = {};

    try {
      const [version] = await db
        .select()
        .from(modelVersions)
        .where(and(eq(modelVersions.id, modelVersionId), eq(modelVersions.orgId, orgId)))
        .limit(1);

      if (version?.hyperparameters && typeof version.hyperparameters === "object") {
        const hp = version.hyperparameters as Record<string, any>;
        if (hp.trainingStats && typeof hp.trainingStats === "object") {
          for (const [key, val] of Object.entries(hp.trainingStats)) {
            if (val && typeof val === "object" && "mean" in val && "std" in val) {
              const stats = val as { mean: number; std: number };
              ref[key] = { mean: stats.mean, std: stats.std };
            }
          }
        }
      }
    } catch {
      logger.warn("[ModelMonitoring] Could not load model version training stats");
    }

    if (Object.keys(ref).length === 0) {
      const baselines = await db
        .select()
        .from(fleetBaselines)
        .where(eq(fleetBaselines.orgId, orgId));

      for (const b of baselines) {
        if (b.mean != null && b.stddev != null) {
          ref[b.featureName] = { mean: b.mean, std: b.stddev };
        }
      }

      if (baselines.length > 0) {
        logger.info("[ModelMonitoring] Using fleet baselines as training reference", {
          count: baselines.length,
        });
      }
    }

    return ref;
  }

  private async getLiveDistributions(
    orgId: string,
    windowDays: number
  ): Promise<Record<string, FeatureDistribution>> {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const recentFeatures = await db
      .select()
      .from(equipmentFeatures)
      .where(and(eq(equipmentFeatures.orgId, orgId), gte(equipmentFeatures.timestamp, cutoff)))
      .orderBy(desc(equipmentFeatures.timestamp))
      .limit(1000);

    const result: Record<string, FeatureDistribution> = {};

    for (const [featureName, extractor] of Object.entries(FEATURE_EXTRACTORS)) {
      const values = recentFeatures
        .map(extractor)
        .filter((v): v is number => v != null && !isNaN(v));
      if (values.length < 2) {
        continue;
      }

      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
      result[featureName] = { mean: round(mean), std: round(Math.sqrt(variance)) };
    }

    return result;
  }

  async getDrift(orgId: string, modelVersionId: string): Promise<ModelDriftMetric[]> {
    return db
      .select()
      .from(modelDriftMetrics)
      .where(
        and(
          eq(modelDriftMetrics.orgId, orgId),
          eq(modelDriftMetrics.modelVersionId, modelVersionId)
        )
      )
      .orderBy(desc(modelDriftMetrics.computedAt));
  }

  async getDriftSummary(orgId: string): Promise<{ alertCount: number; monitoredVersions: number }> {
    const allMetrics = await db
      .select()
      .from(modelDriftMetrics)
      .where(eq(modelDriftMetrics.orgId, orgId));

    const versionIds = new Set(allMetrics.map((m) => m.modelVersionId));
    const alertVersions = new Set(
      allMetrics.filter((m) => m.driftDetected).map((m) => m.modelVersionId)
    );

    return {
      alertCount: alertVersions.size,
      monitoredVersions: versionIds.size,
    };
  }
}
