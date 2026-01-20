/**
 * ML Analytics Service Type Definitions
 *
 * Core interfaces for statistical analysis, anomaly detection,
 * and failure prediction in marine equipment monitoring.
 */

export interface StatisticalBaseline {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  sampleCount: number;
  trend: "increasing" | "decreasing" | "stable";
  seasonality: boolean;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyType: "statistical" | "pattern" | "trend" | "seasonal";
  severity: "low" | "medium" | "high" | "critical";
  contributingFactors: string[];
  recommendedActions: string[];
  explanation: string;
}

export interface FailurePredictionResult {
  failureProbability: number;
  predictedFailureDate: Date | null;
  remainingUsefulLife: number;
  confidenceInterval: { lower: number; upper: number };
  failureMode: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  maintenanceRecommendations: string[];
  costImpact: { estimatedCost: number; downtime: number };
}

export interface DegradationMetrics {
  overallTrend: "increasing" | "decreasing" | "stable";
  riskFactors: string[];
  degradationScore: number;
  criticalSensors: string[];
}

export interface TelemetryReading {
  sensorType: string;
  avgValue: number | null;
  anomalyScore?: number;
  windowStart: Date;
}
