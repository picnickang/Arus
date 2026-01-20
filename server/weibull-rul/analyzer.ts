/**
 * Weibull RUL Analyzer
 * 
 * Main engine class for Weibull reliability and RUL analysis.
 */

import { storage } from "../storage";
import { beastModeManager } from "../beast-mode-config";
import type { RULPrediction } from "./types.js";
import { estimateWeibullParameters } from "./parameter-estimation.js";
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

    console.log(`[Weibull RUL] Starting RUL analysis for equipment ${equipmentId}`);

    try {
      const lifeData = await getEquipmentLifeData(equipmentId, orgId);

      if (lifeData.length < 3) {
        console.log(
          `[Weibull RUL] Insufficient data for ${equipmentId} (${lifeData.length} samples, need ≥3)`
        );
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

      console.log(
        `[Weibull RUL] Analysis completed for ${equipmentId}: RUL=${Math.round(predictedRUL)}h, Reliability=${(currentReliability * 100).toFixed(1)}%`
      );

      return prediction;
    } catch (error: any) {
      console.error(`[Weibull RUL] Error analyzing ${equipmentId}:`, error);
      throw new Error(`Unable to perform RUL analysis: ${error.message}`);
    }
  }

  private async storeRULAnalysis(prediction: RULPrediction, orgId: string): Promise<void> {
    try {
      await storage.createWeibullAnalysis({
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
      });
    } catch (error) {
      console.error(`[Weibull RUL] Error storing analysis for ${prediction.equipmentId}:`, error);
    }
  }

  async getRULHistory(equipmentId: string, orgId: string, limit: number = 50): Promise<any[]> {
    try {
      return await storage.getWeibullAnalysisHistory(equipmentId, orgId, limit);
    } catch (error) {
      console.error(`[Weibull RUL] Error getting history for ${equipmentId}:`, error);
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

    console.log(`[Weibull RUL] Starting batch analysis for ${equipmentIds.length} equipment units`);

    for (const equipmentId of equipmentIds) {
      try {
        const prediction = await this.analyzeEquipmentRUL(equipmentId, orgId);
        results.success.push(prediction);
      } catch (error) {
        console.error(`[Weibull RUL] Failed to analyze ${equipmentId}:`, error);
        results.failed.push(equipmentId);
      }
    }

    console.log(
      `[Weibull RUL] Batch analysis completed: ${results.success.length} success, ${results.failed.length} failed`
    );
    return results;
  }
}
