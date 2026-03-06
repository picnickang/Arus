import type { InferenceRunnerPort, InferenceResult } from "./ports";

export class StubInferenceRunner implements InferenceRunnerPort {
  async runInference(_orgId: string, _equipmentId: string, _modelVersionId?: string): Promise<InferenceResult> {
    throw new Error("StubInferenceRunner: No real model runtime available. Use PredictionEngineService.predict() instead.");
  }
}
