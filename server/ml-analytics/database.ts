/**
 * ML Analytics Database Operations
 *
 * Database record methods for anomaly detections, failure predictions,
 * and threshold optimizations.
 */

import { db } from "../db";
import {
  anomalyDetections,
  failurePredictions,
  thresholdOptimizations,
} from "@shared/schema-runtime";
import type { AnomalyDetection } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import type { AnomalyResult, FailurePredictionResult } from "./types";

export async function recordAnomalyDetection(
  orgId: string,
  equipmentId: string,
  sensorType: string,
  value: number,
  result: AnomalyResult,
  timestamp: Date
): Promise<void> {
  await db.insert(anomalyDetections).values({
    orgId,
    equipmentId,
    sensorType,
    detectionTimestamp: timestamp,
    anomalyScore: result.anomalyScore,
    anomalyType: result.anomalyType,
    severity: result.severity,
    detectedValue: value,
    expectedValue: null,
    deviation: null,
    contributingFactors: result.contributingFactors,
    recommendedActions: result.recommendedActions,
    metadata: {
      explanation: result.explanation,
      modelType: "statistical_enhanced",
    },
  });
}

export async function recordFailurePrediction(
  orgId: string,
  equipmentId: string,
  prediction: FailurePredictionResult
): Promise<void> {
  await db.insert(failurePredictions).values({
    orgId,
    equipmentId,
    failureProbability: prediction.failureProbability,
    predictedFailureDate: prediction.predictedFailureDate,
    remainingUsefulLife: prediction.remainingUsefulLife,
    confidenceInterval: prediction.confidenceInterval,
    failureMode: prediction.failureMode,
    riskLevel: prediction.riskLevel,
    maintenanceRecommendations: prediction.maintenanceRecommendations,
    costImpact: prediction.costImpact,
    metadata: {
      analysisMethod: "statistical_ml_hybrid",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function recordThresholdOptimization(
  equipmentId: string,
  sensorType: string,
  currentThresholds: { warning: number; critical: number },
  optimizedThresholds: { warning: number; critical: number }
): Promise<void> {
  await db.insert(thresholdOptimizations).values({
    equipmentId,
    sensorType,
    currentThresholds,
    optimizedThresholds,
    improvementMetrics: {
      expectedFalsePositiveReduction: 0.15,
      expectedAccuracyImprovement: 0.1,
    },
    optimizationMethod: "statistical_analysis",
    validationResults: { tested: false },
    metadata: {
      optimizedAt: new Date().toISOString(),
      algorithm: "statistical_distribution_analysis",
    },
  });
}

export async function getRecentAnomalies(
  equipmentId: string,
  sensorType: string,
  days: number
): Promise<AnomalyDetection[]> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return db
    .select()
    .from(anomalyDetections)
    .where(
      and(
        eq(anomalyDetections.equipmentId, equipmentId),
        eq(anomalyDetections.sensorType, sensorType),
        gte(anomalyDetections.detectionTimestamp, startDate)
      )
    )
    .orderBy(sql`${anomalyDetections.detectionTimestamp} DESC`);
}
