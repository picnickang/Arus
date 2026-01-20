/**
 * Enhanced Trends Types - Type definitions for telemetry statistical analysis
 */

export interface TrendAnalysisResult {
  equipmentId: string;
  sensorType: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  statisticalSummary: StatisticalSummary;
  anomalyDetection: AnomalyAnalysis;
  forecasting: ForecastingResult;
  seasonality: SeasonalityAnalysis;
  correlations: CorrelationAnalysis[];
}

export interface StatisticalSummary {
  count: number;
  mean: number;
  median: number;
  standardDeviation: number;
  min: number;
  max: number;
  quartiles: {
    q1: number;
    q2: number;
    q3: number;
  };
  distribution: {
    skewness: number;
    kurtosis: number;
    isNormal: boolean;
    normalityConfidence: number;
  };
  trend: {
    slope: number;
    rSquared: number;
    pValue: number;
    trendType: "increasing" | "decreasing" | "stable" | "volatile";
  };
}

export interface AnomalyAnalysis {
  method: "iqr" | "zscore" | "isolation" | "hybrid";
  anomalies: AnomalyPoint[];
  summary: {
    totalAnomalies: number;
    anomalyRate: number;
    severity: "low" | "medium" | "high" | "critical";
    recommendation: string;
  };
}

export interface AnomalyPoint {
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: "mild" | "moderate" | "severe" | "extreme";
  confidence: number;
  context?: string;
}

export interface ForecastingResult {
  method: "linear" | "seasonal" | "exponential" | "arima";
  predictions: ForecastPoint[];
  confidence: number;
  horizon: number;
  metrics: {
    mae: number;
    rmse: number;
    mape: number;
  };
  recommendation: string;
}

export interface ForecastPoint {
  timestamp: Date;
  predictedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  probability: number;
}

export interface SeasonalityAnalysis {
  hasSeasonality: boolean;
  cycles: SeasonalCycle[];
  dominantPeriod: number;
  strength: number;
  recommendation: string;
}

export interface SeasonalCycle {
  period: number;
  amplitude: number;
  phase: number;
  strength: number;
  type: "daily" | "weekly" | "operational" | "maintenance";
}

export interface CorrelationAnalysis {
  targetSensor: string;
  correlatedSensor: string;
  correlation: number;
  significance: number;
  lagHours: number;
  relationship: "positive" | "negative" | "nonlinear" | "none";
  strength: "weak" | "moderate" | "strong" | "very_strong";
  causality: "none" | "possible" | "likely" | "strong";
}

export interface FleetTrendSummary {
  fleetId: string;
  equipmentCount: number;
  sensorTypes: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  aggregatedMetrics: {
    healthScore: number;
    anomalyRate: number;
    volatilityIndex: number;
    maintenanceRisk: "low" | "medium" | "high" | "critical";
  };
  equipmentRankings: EquipmentRanking[];
  recommendations: FleetRecommendation[];
}

export interface EquipmentRanking {
  equipmentId: string;
  rank: number;
  score: number;
  riskFactors: string[];
  priority: "low" | "medium" | "high" | "critical";
}

export interface FleetRecommendation {
  type: "maintenance" | "optimization" | "replacement" | "monitoring";
  equipmentIds: string[];
  priority: number;
  description: string;
  expectedBenefit: string;
  timeFrame: string;
}

export interface TelemetryDataPoint {
  timestamp: Date;
  value: number;
  unit: string;
}

export interface TrendResult {
  slope: number;
  rSquared: number;
  pValue: number;
  trendType: "increasing" | "decreasing" | "stable" | "volatile";
}

export interface ForecastOutput {
  predictions: ForecastPoint[];
  confidence: number;
  metrics: { mae: number; rmse: number; mape: number };
}

export interface LagAnalysisResult {
  lag: number;
  maxCorrelation: number;
}
