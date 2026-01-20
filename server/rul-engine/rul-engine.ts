/**
 * RUL Engine Core
 * 
 * RUL (Remaining Useful Life) Calculation Engine v2.0
 * ML-based predictive maintenance with component-specific degradation tracking
 *
 * Enhancements v2.0:
 * - Mode-aware predictions (DP/Transit/Harbor/Cargo/Standby/Docking)
 * - Data quality propagation
 * - Repair awareness (right-censoring)
 * - Calibrated probabilities
 *
 * Target: 95% failure prediction accuracy with 4-6 weeks advance warning
 */

import { eq, and, gte, sql } from "drizzle-orm";
import {
  failurePredictions,
  componentDegradation,
  equipment,
  mlModels,
} from "../../shared/schema.js";
import { ModeDetector, type OperatingMode as DetectedMode } from "../context/mode-detector.js";
import {
  deriveOpMode,
  dataQualityScore,
  modeThresholdMultiplier,
  calibrateFailureProb,
  type OpMode,
} from "../utils/rul-utils.js";
import { recordRulPrediction } from "../ml-prometheus-metrics.js";

import type { RulPrediction, DegradationMetrics } from "./types.js";
import {
  ENABLE_MODE_AWARE,
  ENABLE_QUALITY_SCORING,
  ENABLE_REPAIR_CENSORING,
  ENABLE_CALIBRATION,
} from "./constants.js";
import { determineDataStatus } from "./data-status.js";
import { determineRiskLevel, estimateFailureProbability } from "./risk-assessment.js";
import { generateRecommendations } from "./recommendations.js";
import { analyzeDegradationPattern, calculateComponentHealth } from "./degradation-analysis.js";
import { calculateHealthIndex } from "./health-calculation.js";
import { fetchEnhancementData } from "./data-fetchers.js";

export class RulEngine {
  constructor(private db: any) {}

  /**
   * Calculate RUL for equipment using ML predictions and degradation patterns
   * This is the main entry point for advanced predictive maintenance
   */
  async calculateRul(equipmentId: string, orgId: string): Promise<RulPrediction | null> {
    const predictionStartTime = Date.now();

    // Get the most recent ML-based failure prediction
    const mlPredictions = await this.db
      .select()
      .from(failurePredictions)
      .where(
        and(eq(failurePredictions.equipmentId, equipmentId), eq(failurePredictions.orgId, orgId))
      )
      .orderBy(sql`${failurePredictions.predictionTimestamp} DESC`)
      .limit(1);

    // Get component degradation data
    const degradationData = await this.db
      .select()
      .from(componentDegradation)
      .where(
        and(
          eq(componentDegradation.equipmentId, equipmentId),
          eq(componentDegradation.orgId, orgId),
          gte(
            componentDegradation.measurementTimestamp,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          )
        )
      )
      .orderBy(sql`${componentDegradation.measurementTimestamp} DESC`);

    // Get equipment record
    const equipmentRecord = await this.db
      .select()
      .from(equipment)
      .where(eq(equipment.id, equipmentId))
      .limit(1);

    if (!equipmentRecord.length) {
      return null;
    }

    const equipmentType = equipmentRecord[0].type;

    // Batch fetch all v2.0 enhancement data in parallel
    const batchStartTime = Date.now();
    const enhancementData = await fetchEnhancementData(this.db, equipmentId, equipmentType, orgId);
    const batchEndTime = Date.now();

    // v2.0: Detect operating mode from batched telemetry data
    let opMode: OpMode = "UNKNOWN";
    if (ENABLE_MODE_AWARE && enhancementData.telemetry) {
      opMode = this.detectModeFromTelemetry(enhancementData.telemetry);
    }

    // v2.0: Apply repair censoring using batched repair data
    let degradationDataFiltered = degradationData;
    let repairCensored = false;
    if (
      ENABLE_REPAIR_CENSORING &&
      enhancementData.lastRepair &&
      enhancementData.lastRepair.resolvedAt
    ) {
      const repairDate = new Date(enhancementData.lastRepair.resolvedAt);
      degradationDataFiltered = degradationData.filter(
        (d: any) => new Date(d.measurementTimestamp) > repairDate
      );
      repairCensored = degradationDataFiltered.length !== degradationData.length;

      if (repairCensored) {
        console.log(
          `[RUL Engine] Repair censoring: ${degradationData.length} → ${degradationDataFiltered.length} points (repair: ${repairDate.toISOString()})`
        );
      }
    }

    // Analyze degradation patterns
    const degradationPattern = analyzeDegradationPattern(degradationDataFiltered);
    const componentStatus = calculateComponentHealth(degradationDataFiltered);

    // v2.0: Calculate data quality from batched stats
    let dataQuality = 1;
    let telemetryCount = 0;
    let spanDays = 0;
    let stalenessMins = 0;
    
    if (ENABLE_QUALITY_SCORING && enhancementData.qualityStats) {
      const stats = enhancementData.qualityStats as any;
      telemetryCount = Number(stats.n ?? 0);
      spanDays = Number(stats.span_days ?? 0);
      stalenessMins = Number(stats.staleness_min ?? 0);
      dataQuality = dataQualityScore(
        telemetryCount,
        spanDays,
        Number(stats.missing_pct ?? 0),
        stalenessMins
      );
    } else if (ENABLE_QUALITY_SCORING) {
      dataQuality = 0.5;
    }
    
    // v2.1 ML Governance: Determine data status
    const { dataStatus, dataStatusReason } = determineDataStatus(
      telemetryCount,
      spanDays,
      stalenessMins,
      dataQuality,
      mlPredictions.length,
      degradationDataFiltered.length
    );

    // Combine ML predictions with degradation analysis
    let remainingDays = 30;
    let confidenceScore = 0.5;
    let predictionMethod: "ml_lstm" | "ml_rf" | "statistical" | "hybrid" = "statistical";
    let failureProbability = 0.1;

    if (mlPredictions.length > 0) {
      const prediction = mlPredictions[0];

      if (prediction.predictedFailureDate) {
        const daysUntilFailure = Math.max(
          0,
          (prediction.predictedFailureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        remainingDays = Math.round(daysUntilFailure);
      }

      const baseConfidence = prediction.confidence || 0.5;

      // Apply tier-based confidence multiplier
      if (prediction.modelId) {
        const modelRecord = await this.db
          .select()
          .from(mlModels)
          .where(eq(mlModels.id, prediction.modelId))
          .limit(1);

        if (modelRecord.length > 0 && modelRecord[0].hyperparameters) {
          const hyperparams = modelRecord[0].hyperparameters as any;
          const confidenceMultiplier = hyperparams.confidenceMultiplier || 1;
          confidenceScore = Math.min(0.95, baseConfidence * confidenceMultiplier);
          console.log(
            `[RUL Engine] Applied ${hyperparams.dataQualityTier} tier multiplier (${confidenceMultiplier}x): ${baseConfidence.toFixed(2)} → ${confidenceScore.toFixed(2)}`
          );
        } else {
          confidenceScore = baseConfidence;
        }
      } else {
        confidenceScore = baseConfidence;
      }

      predictionMethod = (
        prediction.modelType?.includes("lstm")
          ? "ml_lstm"
          : prediction.modelType?.includes("forest")
            ? "ml_rf"
            : "hybrid"
      ) as any;
      failureProbability = prediction.failureProbability || 0.1;
    } else if (degradationPattern?.timeToFailure > 0) {
      remainingDays = Math.round(degradationPattern.timeToFailure);
      confidenceScore = degradationPattern.confidence;
      predictionMethod = "statistical";
      failureProbability = estimateFailureProbability(degradationPattern);
    }

    // v2.0: Apply data quality to confidence score
    if (ENABLE_QUALITY_SCORING) {
      const originalConfidence = confidenceScore;
      confidenceScore = Math.max(0.1, Math.min(0.95, confidenceScore * (0.6 + 0.4 * dataQuality)));
      console.log(
        `[RUL Engine] Data quality impact: confidence ${originalConfidence.toFixed(2)} → ${confidenceScore.toFixed(2)} (quality: ${dataQuality.toFixed(2)})`
      );
    }

    // v2.0: Calibrate failure probability
    let calibrated = false;
    if (ENABLE_CALIBRATION) {
      const baseRate = enhancementData.baseRate;
      const originalProb = failureProbability;
      failureProbability = calibrateFailureProb(failureProbability, baseRate);
      calibrated = true;
      console.log(
        `[RUL Engine] Probability calibration: ${originalProb.toFixed(2)} → ${failureProbability.toFixed(2)} (base rate: ${baseRate.toFixed(2)})`
      );
    }

    // v2.0: Apply mode-aware threshold multiplier
    let modeMultiplier = 1;
    if (ENABLE_MODE_AWARE && opMode !== "UNKNOWN") {
      modeMultiplier = modeThresholdMultiplier(opMode);
      const originalRUL = remainingDays;
      remainingDays = Math.round(remainingDays * modeMultiplier);
      console.log(
        `[RUL Engine] Mode adjustment (${opMode}): RUL ${originalRUL}d → ${remainingDays}d (${modeMultiplier}x)`
      );
    }

    // Calculate overall health index
    const healthIndex = calculateHealthIndex(remainingDays, degradationPattern, componentStatus);
    const riskLevel = determineRiskLevel(remainingDays, failureProbability, healthIndex);
    const recommendations = generateRecommendations(remainingDays, riskLevel, componentStatus, degradationPattern);

    // Record Prometheus metrics
    const predictionEndTime = Date.now();
    const totalDurationSeconds = (predictionEndTime - predictionStartTime) / 1000;
    const batchDurationSeconds = (batchEndTime - batchStartTime) / 1000;
    const calibrationDelta =
      calibrated && mlPredictions.length > 0
        ? failureProbability - (mlPredictions[0].failureProbability || 0.1)
        : 0;

    recordRulPrediction({
      orgId,
      equipmentType,
      operatingMode: opMode,
      durationSeconds: totalDurationSeconds,
      dataQuality,
      modeMultiplier,
      repairCensored,
      calibrated,
      calibrationDelta,
      confidenceScore,
      remainingDays,
      riskLevel,
      cacheHit: false,
      batchDurationSeconds,
    });

    if (dataStatus !== "sufficient_data") {
      console.log(
        `[RUL Engine] Data status warning for ${equipmentId}: ${dataStatus} - ${dataStatusReason}`
      );
    }

    return {
      equipmentId,
      remainingDays,
      confidenceScore,
      healthIndex,
      degradationRate: degradationPattern?.trendSlope || 0,
      failureProbability,
      riskLevel,
      componentStatus,
      predictionMethod,
      recommendations,
      operatingMode: opMode,
      dataQuality,
      modeMultiplier,
      calibrated,
      repairCensored,
      dataStatus,
      dataStatusReason,
    };
  }

  /**
   * Calculate RUL for multiple equipment in batch
   */
  async calculateBatchRul(
    equipmentIds: string[],
    orgId: string
  ): Promise<Map<string, RulPrediction>> {
    const results = new Map<string, RulPrediction>();
    const predictions = await Promise.all(equipmentIds.map((id) => this.calculateRul(id, orgId)));

    equipmentIds.forEach((id, index) => {
      if (predictions[index]) {
        results.set(id, predictions[index]);
      }
    });

    return results;
  }

  /**
   * Record component degradation measurement
   */
  async recordDegradation(
    orgId: string,
    equipmentId: string,
    componentType: string,
    metrics: DegradationMetrics
  ): Promise<void> {
    const previous = await this.db
      .select()
      .from(componentDegradation)
      .where(
        and(
          eq(componentDegradation.equipmentId, equipmentId),
          eq(componentDegradation.componentType, componentType)
        )
      )
      .orderBy(sql`${componentDegradation.measurementTimestamp} DESC`)
      .limit(1);

    let degradationRate = 0;
    if (previous.length > 0) {
      const timeDiff =
        (Date.now() - previous[0].measurementTimestamp.getTime()) / (1000 * 60 * 60 * 24);
      if (timeDiff > 0) {
        degradationRate = (metrics.degradationMetric - previous[0].degradationMetric) / timeDiff;
      }
    }

    await this.db.insert(componentDegradation).values({
      orgId,
      equipmentId,
      componentType,
      ...metrics,
      degradationRate,
    });
  }

  /**
   * Detect mode from telemetry point
   */
  private detectModeFromTelemetry(telemetryPoint: any): OpMode {
    // Method 1: Check for operating_mode field
    const modeFromField = deriveOpMode([], telemetryPoint.operatingMode);
    if (modeFromField !== "UNKNOWN") {return modeFromField;}

    // Method 2: Check tags array
    const tags = telemetryPoint.tags ?? [];
    const modeFromTags = deriveOpMode(tags);
    if (modeFromTags !== "UNKNOWN") {return modeFromTags;}

    // Method 3: Use ModeDetector
    const detector = new ModeDetector();
    const window = detector.toTelemetryWindow(telemetryPoint);
    const detection = detector.detectMode(window);

    const modeMap: Record<DetectedMode, OpMode> = {
      DP: "DP",
      Transit: "TRANSIT",
      Harbor: "HARBOR",
      Cargo_Ops: "CARGO_OPS",
      Standby: "STANDBY",
      Docking: "DOCKING",
      Unknown: "UNKNOWN",
    };

    return modeMap[detection.mode] || "UNKNOWN";
  }
}
