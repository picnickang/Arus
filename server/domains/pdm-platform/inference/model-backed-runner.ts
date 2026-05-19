/**
 * Push A1 — Model-backed inference runner.
 *
 * Wraps the ONNX adapter so the existing PredictionEngineService can
 * serve real-model predictions when an ONNX artifact is configured,
 * while preserving failure isolation: any ONNX error (file missing,
 * shape mismatch, runtime crash) falls through to the heuristic
 * baseline so user-visible predictions never regress.
 *
 * Selection is env-gated on PDM_ONNX_MODEL_PATH so production keeps
 * the deterministic heuristic until an operator opts the path in by
 * publishing a model artifact. This honours the "shadow first, canary
 * second" rollout pattern established by Wave 3.3.
 */

import { promises as fs } from "node:fs";
import { createLogger } from "../../../lib/structured-logger";
import { OnnxInferenceAdapter } from "../../../ml-prediction/onnx-adapter";
import { HeuristicInferenceRunner } from "./heuristic-inference-runner";
import type { InferenceContext, InferenceRunnerPort, PredictionScore } from "./ports";

const logger = createLogger("ModelBackedInferenceRunner");

export class ModelBackedInferenceRunner implements InferenceRunnerPort {
  private readonly fallback = new HeuristicInferenceRunner();
  private readonly onnx?: OnnxInferenceAdapter;
  private artifactReady?: Promise<boolean>;

  constructor(private readonly modelPath?: string) {
    if (modelPath) {
      this.onnx = new OnnxInferenceAdapter({ modelPath });
    }
  }

  private async hasArtifact(): Promise<boolean> {
    if (!this.modelPath) return false;
    if (!this.artifactReady) {
      this.artifactReady = fs
        .access(this.modelPath)
        .then(() => true)
        .catch(() => {
          logger.warn("ONNX model artifact missing — falling back to heuristic", {
            modelPath: this.modelPath,
          });
          return false;
        });
    }
    return this.artifactReady;
  }

  async scoreFeatures(context: InferenceContext): Promise<PredictionScore> {
    if (this.onnx && (await this.hasArtifact())) {
      try {
        return await this.onnx.scoreFeatures(context);
      } catch (err) {
        logger.warn("ONNX inference failed — falling back to heuristic", {
          equipmentId: context.equipmentId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return this.fallback.scoreFeatures(context);
  }
}

/** Resolves the configured runner based on env. Exported for routes wiring. */
export function resolveInferenceRunner(): InferenceRunnerPort {
  const modelPath = process.env.PDM_ONNX_MODEL_PATH?.trim();
  if (modelPath) {
    logger.info("ONNX runner active", { modelPath });
    return new ModelBackedInferenceRunner(modelPath);
  }
  return new HeuristicInferenceRunner();
}
