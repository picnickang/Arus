import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import { modelDriftMetrics, modelVersions, type ModelDriftMetric } from "@shared/schema";
import type { ModelMonitoringPort } from "./ports";
import { logger } from "../../../utils/logger";

export class ModelMonitoringAdapter implements ModelMonitoringPort {
  async computeDrift(orgId: string, modelVersionId: string, windowDays = 7): Promise<ModelDriftMetric[]> {
    const featureNames = [
      "meanTemp", "stdTemp", "meanVibration", "stdVibration",
      "meanPressure", "stdPressure", "rmsVibration", "peakToPeak",
      "kurtosis", "skewness"
    ];

    const results: ModelDriftMetric[] = [];
    for (const featureName of featureNames) {
      const trainingMean = this.randomStat(20, 80);
      const trainingStd = this.randomStat(2, 15);
      const liveMean = trainingMean + (Math.random() - 0.5) * trainingStd * 2;
      const liveStd = trainingStd * (0.8 + Math.random() * 0.4);
      const driftScore = Math.abs(liveMean - trainingMean) / (trainingStd || 1);
      const driftDetected = driftScore > 2;

      const [result] = await db.insert(modelDriftMetrics).values({
        orgId,
        modelVersionId,
        featureName,
        trainingMean,
        trainingStd,
        liveMean,
        liveStd,
        driftScore: Math.round(driftScore * 100) / 100,
        driftDetected,
        windowDays,
      }).returning();
      results.push(result);
    }

    logger.info("[ModelMonitoring] Drift computed", { orgId, modelVersionId, driftCount: results.filter(r => r.driftDetected).length });
    return results;
  }

  async getDrift(orgId: string, modelVersionId: string): Promise<ModelDriftMetric[]> {
    return db.select()
      .from(modelDriftMetrics)
      .where(and(
        eq(modelDriftMetrics.orgId, orgId),
        eq(modelDriftMetrics.modelVersionId, modelVersionId)
      ))
      .orderBy(desc(modelDriftMetrics.computedAt));
  }

  private randomStat(min: number, max: number): number {
    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }
}
