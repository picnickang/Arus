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
import { serveWithShadowOrCanary } from "../../../ml-prediction/shadow-canary";
import { HeuristicInferenceRunner } from "./heuristic-inference-runner";
import type { InferenceContext, InferenceRunnerPort, PredictionScore } from "./ports";

const logger = createLogger("ModelBackedInferenceRunner");

/**
 * Push A1 — Routes prediction calls through the Wave 3.3 shadow/canary
 * substrate. Production is always the deterministic heuristic so that
 * any ONNX runtime failure can never regress user-visible predictions.
 * The ONNX adapter is plumbed as the candidate model:
 *
 *   - When PDM_ONNX_MODEL_PATH is set and PDM_ONNX_MODE=shadow (default),
 *     ONNX runs in lockstep but production still serves.
 *   - When PDM_ONNX_MODE=canary, PDM_ONNX_CANARY_PERCENT of traffic is
 *     served from ONNX; the rest stays on heuristic.
 *   - When PDM_ONNX_MODEL_PATH is unset, the candidate is omitted and
 *     the call collapses to pure heuristic.
 */
export class ModelBackedInferenceRunner implements InferenceRunnerPort {
  private readonly production = new HeuristicInferenceRunner();
  private readonly candidate?: OnnxInferenceAdapter;
  private readonly mode: "shadow" | "canary";
  private readonly canaryPercent: number;
  private artifactReady?: Promise<boolean>;

  constructor(private readonly modelPath?: string) {
    if (modelPath) {
      this.candidate = new OnnxInferenceAdapter({ modelPath });
    }
    this.mode = (process.env.PDM_ONNX_MODE ?? "shadow") === "canary" ? "canary" : "shadow";
    const pct = Number(process.env.PDM_ONNX_CANARY_PERCENT ?? "0");
    this.canaryPercent = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  }

  private async hasArtifact(): Promise<boolean> {
    if (!this.modelPath) return false;
    if (!this.artifactReady) {
      this.artifactReady = fs
        .access(this.modelPath)
        .then(() => true)
        .catch(() => {
          logger.warn("ONNX artifact missing — candidate path disabled", {
            modelPath: this.modelPath,
          });
          return false;
        });
    }
    return this.artifactReady;
  }

  async scoreFeatures(context: InferenceContext): Promise<PredictionScore> {
    const candidateReady = this.candidate && (await this.hasArtifact());
    const result = await serveWithShadowOrCanary<PredictionScore>({
      productionModelId: "heuristic-baseline",
      candidateModelId: candidateReady ? "onnx-candidate" : undefined,
      productionPredict: () => this.production.scoreFeatures(context),
      candidatePredict: candidateReady
        ? () => this.candidate!.scoreFeatures(context)
        : undefined,
      canaryPercent: this.mode === "canary" ? this.canaryPercent : undefined,
      divergence: (p, c) => Math.abs(p.failureProbability - c.failureProbability),
    });
    return result.result;
  }
}

/** Resolves the configured runner based on env. Exported for routes wiring. */
export function resolveInferenceRunner(): InferenceRunnerPort {
  const modelPath = process.env.PDM_ONNX_MODEL_PATH?.trim();
  if (modelPath) {
    logger.info("ONNX runner active via shadow/canary substrate", {
      modelPath,
      mode: process.env.PDM_ONNX_MODE ?? "shadow",
      canaryPercent: process.env.PDM_ONNX_CANARY_PERCENT ?? "0",
    });
    return new ModelBackedInferenceRunner(modelPath);
  }
  return new HeuristicInferenceRunner();
}
