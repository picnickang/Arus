/**
 * RUL Engine Types
 * 
 * Core types and interfaces for the RUL (Remaining Useful Life) calculation engine.
 */

import type { OpMode } from "../utils/rul-utils.js";

/**
 * Data status for ML governance - differentiates "no data" from "low risk"
 * This is critical for compliance: we must not conflate insufficient data with actual low-risk assessments
 */
export type DataStatus = 
  | "sufficient_data"    // Enough telemetry for confident prediction
  | "limited_data"       // Some data but below ideal thresholds (lower confidence)
  | "no_data"            // Insufficient or no data to make a prediction
  | "stale_data";        // Data exists but is too old for reliable prediction

export interface RulPrediction {
  equipmentId: string;
  remainingDays: number;
  confidenceScore: number;
  healthIndex: number; // 0-100
  degradationRate: number; // Health points per day
  failureProbability: number; // 0-1
  riskLevel: "low" | "medium" | "high" | "critical";
  componentStatus: ComponentHealthStatus[];
  predictionMethod: "ml_lstm" | "ml_rf" | "statistical" | "hybrid";
  recommendations: string[];
  // v2.0 Enhancements
  operatingMode?: OpMode;
  dataQuality?: number; // 0-1
  modeMultiplier?: number;
  calibrated?: boolean;
  repairCensored?: boolean;
  // v2.1 ML Governance: Data status for transparency
  dataStatus?: DataStatus;
  dataStatusReason?: string; // Human-readable explanation of data status
}

export interface ComponentHealthStatus {
  componentType: string;
  healthScore: number; // 0-100
  degradationMetric: number;
  degradationRate: number;
  predictedFailureDays: number;
  confidence: number;
  criticalMetrics: string[];
}

export interface DegradationPattern {
  equipmentId: string;
  trendSlope: number; // Degradation per day
  acceleration: number; // Change in degradation rate
  volatility: number; // Variance in measurements
  timeToFailure: number; // Estimated days
  confidence: number;
}

export interface DegradationMetrics {
  degradationMetric: number;
  vibrationLevel?: number;
  temperature?: number;
  oilCondition?: number;
  acousticSignature?: number;
  wearParticleCount?: number;
  operatingHours?: number;
  cycleCount?: number;
  loadFactor?: number;
}

export interface EnhancementData {
  telemetry: any;
  qualityStats: any;
  lastRepair: any;
  baseRate: number;
}

export interface DataStatusResult {
  dataStatus: DataStatus;
  dataStatusReason: string;
}
