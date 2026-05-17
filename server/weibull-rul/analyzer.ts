import { db } from "../db";
import { weibullEstimates } from "@shared/schema-runtime";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { beastModeManager } from "../beast-mode-config";
import type { RULPrediction } from "./types.js";
import { estimateWeibullParameters } from "./parameter-estimation.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("WeibullRul:Analyzer");
import {
  calculateReliability,
  predictRUL,
  calculateConfidenceInterval,
  calculateFailureProbability,
  generateMaintenanceRecommendation,
} from "./reliability-calculations.js";
import { getEquipmentLifeData, getCurrentEquipmentAge } from "./data-extraction.js";

export class WeibullRULAnalyzer {
  constructor() {}

  async analyzeEquipmentRUL(equipmentId: string, orgId: string): Promise<RULPrediction> {
    const isEnabled = await beastModeManager.isFeatureEnabled(orgId, "weibull_rul");
    if (!isEnabled) {
      throw new Error("Weibull RUL analysis is not enabled");
    }

    logger.info(`[Weibull RUL] Starting RUL analysis for equipment ${equipmentId}`);

    try {
      const lifeData = await getEquipmentLifeData(equipmentId, orgId);

      if (lifeData.length < 3) {
        logger.info(`[Weibull RUL] Insufficient data for ${equipmentId} (${lifeData.length} samples, need ≥3)`);
        throw new Error(
          "Insufficient historical data for Weibull analysis (minimum 3 data points required)"
        );
      }

      const weibullParams = estimateWeibullParameters(lifeData);

      const currentAge = await getCurrentEquipmentAge(equipmentId, orgId);
      const currentReliability = calculateReliability(currentAge, weibullParams);

      const predictedRUL = predictRUL(currentAge, weibullParams, 0.1);
      const confidenceInterval = calculateConfidenceInterval(currentAge, weibullParams, 0.95);

      const failureProbability = {
        next30days: calculateFailureProbability(currentAge, currentAge + 30 * 24, weibullParams),
        next90days: calculateFailureProbability(currentAge, currentAge + 90 * 24, weibullParams),
        next365days: calculateFailureProbability(currentAge, currentAge + 365 * 24, weibullParams),
      };

      const maintenanceRecommendation = generateMaintenanceRecommendation(
        predictedRUL,
        failureProbability,
        currentReliability
      );

      const prediction: RULPrediction = {
        equipmentId,
        currentAge,
        predictedRUL,
        confidenceInterval,
        failureProbability,
        weibullParams,
        reliability: currentReliability,
        maintenanceRecommendation,
      };

      await this.storeRULAnalysis(prediction, orgId);

      logger.info(`[Weibull RUL] Analysis completed for ${equipmentId}: RUL=${Math.round(predictedRUL)}h, Reliability=${(currentReliability * 100).toFixed(1)}%`);

      return prediction;
    } catch (error: any) {
      logger.error(`[Weibull RUL] Error analyzing ${equipmentId}:`, undefined, error);
      throw new Error(`Unable to perform RUL analysis: ${error.message}`);
    }
  }

  private async storeRULAnalysis(prediction: RULPrediction, orgId: string): Promise<void> {
    try {
      await (db.insert(weibullEstimates).values as any)({
        id: randomUUID(),
        orgId,
        equipmentId: prediction.equipmentId,
        currentAge: prediction.currentAge,
        predictedRUL: prediction.predictedRUL,
        confidenceLevel: prediction.confidenceInterval.level,
        confidenceLower: prediction.confidenceInterval.lower,
        confidenceUpper: prediction.confidenceInterval.upper,
        failureProb30d: prediction.failureProbability.next30days,
        failureProb90d: prediction.failureProbability.next90days,
        failureProb365d: prediction.failureProbability.next365days,
        weibullShape: prediction.weibullParams.shape,
        weibullScale: prediction.weibullParams.scale,
        weibullLocation: prediction.weibullParams.location,
        rSquared: prediction.weibullParams.rsquared,
        reliability: prediction.reliability,
        recommendation: prediction.maintenanceRecommendation,
        analysisConfig: {
          method: "weibull_mle",
          dataPoints: 0,
          confidence: prediction.confidenceInterval.level,
        },
        createdAt: new Date(),
      });
    } catch (error) {
      logger.error(`[Weibull RUL] Error storing analysis for ${prediction.equipmentId}:`, undefined, error);
    }
  }

  async getRULHistory(equipmentId: string, orgId: string, limit: number = 50): Promise<any[]> {
    try {
      return await db
        .select()
        .from(weibullEstimates)
        .where(
          and(eq(weibullEstimates.equipmentId, equipmentId), eq(weibullEstimates.orgId, orgId))
        )
        .orderBy(desc(weibullEstimates.createdAt))
        .limit(limit);
    } catch (error) {
      logger.error(`[Weibull RUL] Error getting history for ${equipmentId}:`, undefined, error);
      return [];
    }
  }

  async batchAnalyzeRUL(
    equipmentIds: string[],
    orgId: string
  ): Promise<{ success: RULPrediction[]; failed: string[] }> {
    const results = {
      success: [] as RULPrediction[],
      failed: [] as string[],
    };

    logger.info(`[Weibull RUL] Starting batch analysis for ${equipmentIds.length} equipment units`);

    for (const equipmentId of equipmentIds) {
      try {
        const prediction = await this.analyzeEquipmentRUL(equipmentId, orgId);
        results.success.push(prediction);
      } catch (error) {
        logger.error(`[Weibull RUL] Failed to analyze ${equipmentId}:`, undefined, error);
        results.failed.push(equipmentId);
      }
    }

    logger.info(`[Weibull RUL] Batch analysis completed: ${results.success.length} success, ${results.failed.length} failed`);
    return results;
  }
}
