/**
 * ML Analytics Service
 *
 * Main orchestrator for ML-powered analytics including anomaly detection,
 * failure prediction, and threshold optimization for marine equipment.
 */

import { EventEmitter } from "node:events";
import { db } from "../db";
import { mlModels } from "@shared/schema-runtime";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("MlAnalytics:Index");

import type { AnomalyResult, FailurePredictionResult } from "./types";
import {
  calculateStatisticalBaseline,
  detectStatisticalAnomaly,
  enhanceAnomalyDetectionWithAI,
  basicThresholdDetection,
} from "./anomaly-detection";
import {
  getMultiSensorData,
  calculateDegradationMetrics,
  statisticalFailurePrediction,
  getDefaultPrediction,
} from "./failure-prediction";
import {
  recordAnomalyDetection,
  recordFailurePrediction,
  recordThresholdOptimization,
  getRecentAnomalies,
} from "./database";

export class MLAnalyticsService extends EventEmitter {
  private models: Map<string, any> = new Map();
  private enabled: boolean = true;
  private aiEnhancementEnabled: boolean = Boolean(process.env.OPENAI_API_KEY);

  constructor() {
    super();
    this.loadActiveModels();
  }

  private async loadActiveModels(): Promise<void> {
    if (!db) {
      logger.warn("[ML Analytics] Disabled: database not initialized (embedded/local mode)");
      this.enabled = false;
      return;
    }

    try {
      const activeModels = await db.select().from(mlModels).where(eq(mlModels.status, "deployed"));

      for (const model of activeModels) {
        this.models.set(`${model.type}:${model.equipmentType || "all"}`, model);
      }
    } catch (error) {
      logger.error("[ML Analytics] Error loading models:", undefined, error);
    }
  }

  async detectAnomalies(
    orgId: string,
    equipmentId: string,
    sensorType: string,
    currentValue: number,
    timestamp: Date = new Date()
  ): Promise<AnomalyResult> {
    try {
      const baseline = await calculateStatisticalBaseline(equipmentId, sensorType);
      const statisticalResult = detectStatisticalAnomaly(currentValue, baseline);

      let enhancedResult = statisticalResult;
      if (this.aiEnhancementEnabled && statisticalResult.isAnomaly) {
        enhancedResult = await enhanceAnomalyDetectionWithAI(
          equipmentId,
          sensorType,
          currentValue,
          baseline,
          statisticalResult
        );
      }

      if (enhancedResult.isAnomaly) {
        await recordAnomalyDetection(
          orgId,
          equipmentId,
          sensorType,
          currentValue,
          enhancedResult,
          timestamp
        );
      }

      this.emit("anomaly_detected", {
        equipmentId,
        sensorType,
        value: currentValue,
        result: enhancedResult,
        timestamp,
      });

      return enhancedResult;
    } catch (error) {
      logger.error("[ML Analytics] Error detecting anomalies:", undefined, error);
      return basicThresholdDetection(currentValue, sensorType);
    }
  }

  async predictFailure(
    orgId: string,
    equipmentId: string,
    equipmentType: string = "general"
  ): Promise<FailurePredictionResult> {
    try {
      const recentData = await getMultiSensorData(equipmentId, 7);

      if (recentData.length < 10) {
        return getDefaultPrediction("insufficient_data");
      }

      const degradationMetrics = calculateDegradationMetrics(recentData);
      const prediction = statisticalFailurePrediction(degradationMetrics);

      await recordFailurePrediction(orgId, equipmentId, prediction);

      this.emit("failure_predicted", {
        equipmentId,
        prediction,
        timestamp: new Date(),
      });

      return prediction;
    } catch (error) {
      logger.error("[ML Analytics] Error predicting failure:", undefined, error);
      return getDefaultPrediction("error");
    }
  }

  async optimizeThresholds(
    equipmentId: string,
    sensorType: string,
    currentThresholds: { warning: number; critical: number }
  ): Promise<{ warning: number; critical: number }> {
    try {
      const baseline = await calculateStatisticalBaseline(equipmentId, sensorType);
      const recentAnomalies = await getRecentAnomalies(equipmentId, sensorType, 30);

      const optimizedThresholds = {
        warning: baseline.mean + 2 * baseline.stdDev,
        critical: baseline.mean + 3 * baseline.stdDev,
      };

      if (recentAnomalies.length > 0) {
        const falsePositiveRate =
          recentAnomalies.filter((a) => a.severity === "low").length / recentAnomalies.length;

        if (falsePositiveRate > 0.3) {
          optimizedThresholds.warning *= 1.1;
          optimizedThresholds.critical *= 1.1;
        }
      }

      await recordThresholdOptimization(
        equipmentId,
        sensorType,
        currentThresholds,
        optimizedThresholds
      );

      return optimizedThresholds;
    } catch (error) {
      logger.error("[ML Analytics] Error optimizing thresholds:", undefined, error);
      return currentThresholds;
    }
  }

  getHealthStatus(): { status: string; features: string[]; stats: any } {
    return {
      status: "operational",
      features: [
        "statistical_anomaly_detection",
        "pattern_recognition",
        "failure_prediction",
        "threshold_optimization",
        "openai_enhanced_analysis",
        "multi_sensor_correlation",
        "degradation_tracking",
      ],
      stats: {
        activeModels: this.models.size,
        openaiEnabled: this.aiEnhancementEnabled,
        analyticsVersion: "2.0",
      },
    };
  }
}

export const mlAnalyticsService = new MLAnalyticsService();

export type { AnomalyResult, FailurePredictionResult, StatisticalBaseline } from "./types";
