import type { InferenceRun, InsertPredictionExplanation } from "@shared/schema";

export interface InferenceResult {
  inferenceRun: InferenceRun;
  prediction: {
    failureProbability: number;
    riskLevel: string;
    remainingUsefulLife: number;
    recommendations: string[];
  };
  explanations: InsertPredictionExplanation[];
}

export interface InferenceRunnerPort {
  runInference(
    orgId: string,
    equipmentId: string,
    modelVersionId?: string
  ): Promise<InferenceResult>;
}
