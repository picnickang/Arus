/**
 * ML Ensemble Types
 * 
 * Type definitions for ensemble prediction system.
 */

export interface EnsemblePrediction {
  failureProbability: number;
  confidence: number;
  daysToFailure: number | null;
  method: "ensemble";
  modelBreakdown: {
    lstm?: number;
    randomForest?: number;
    xgboost?: number;
  };
  modelWeights: {
    lstm: number;
    rf: number;
    xgb: number;
  };
  agreement: number;
  recommendations: string[];
}

export interface EnsembleConfig {
  equipmentType: string;
  useAdaptiveWeights: boolean;
  minConfidence: number;
  enableShadowMode: boolean;
}

export interface ModelWeights {
  lstm: number;
  rf: number;
  xgb: number;
}

export interface ModelBreakdown {
  lstm?: number;
  randomForest?: number;
  xgboost?: number;
}

export interface ModelConfidences {
  lstm?: number;
  randomForest?: number;
  xgboost?: number;
}

export interface StatsResult {
  avg: number;
  max: number;
  min: number;
  std: number;
}
