import type { InferenceRun, InsertPredictionExplanation } from "@shared/schema";

export interface InferenceResult {
  inferenceRun: InferenceRun;
  prediction: {
    failureProbability: number;
    riskLevel: string;
    remainingUsefulLife: number;
    recommendations: string[];
    method: "heuristic-baseline" | "model";
    caveat: string;
  };
  explanations: InsertPredictionExplanation[];
}

export interface FeatureVector {
  id?: string;
  meanTemp?: number | null;
  meanVibration?: number | null;
  rmsVibration?: number | null;
  meanPressure?: number | null;
  kurtosis?: number | null;
  peakToPeak?: number | null;
  [key: string]: unknown;
}

export interface PredictionScore {
  failureProbability: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  remainingUsefulLife: number;
  method?: "heuristic-baseline" | "model" | undefined;
  caveat?: string | undefined;
}

export interface InferenceContext {
  orgId: string;
  equipmentId: string;
  modelVersionId?: string | undefined;
  features: FeatureVector | null;
}

/**
 * Hexagonal inference port. Infrastructure adapters can implement this with
 * TensorFlow, ONNX, remote inference, or a deterministic heuristic adapter.
 */
export interface InferenceRunnerPort {
  scoreFeatures(context: InferenceContext): Promise<PredictionScore>;
}
