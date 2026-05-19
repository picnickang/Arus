/**
 * Push A1 — Model-backed inference runner.
 *
 * Wraps the ONNX adapter so the existing PredictionEngineService can
 * serve real-model predictions when a model is deployed in the
 * registry, while preserving failure isolation: any ONNX error
 * (artifact missing, shape mismatch, runtime crash) falls through to
 * the heuristic baseline so user-visible predictions never regress.
 *
 * Selection priority:
 *   1. The ml_models registry — for each incoming InferenceContext
 *      whose modelVersionId points at a `status='deployed'` row with
 *      a `training_metrics.artifactPath` on disk, that artifact is
 *      used as the candidate. This is the closed-loop wiring that the
 *      weekly retraining + /ml/models/:id/promote endpoint flows
 *      through.
 *   2. Env `PDM_ONNX_MODEL_PATH` — operator-pinned override that
 *      bypasses the registry. Useful for benchmarking / pre-rollout.
 *   3. None — collapses to pure heuristic. Same as today.
 *
 * Selection always runs through the Wave 3.3 shadow/canary substrate
 * so a candidate failure can never propagate to user-visible writes.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import { mlModels } from "@shared/schema";
import { createLogger } from "../../../lib/structured-logger";
import { OnnxInferenceAdapter } from "../../../ml-prediction/onnx-adapter";
import { serveWithShadowOrCanary } from "../../../ml-prediction/shadow-canary";
import { HeuristicInferenceRunner } from "./heuristic-inference-runner";
import type { InferenceContext, InferenceRunnerPort, PredictionScore } from "./ports";

const logger = createLogger("ModelBackedInferenceRunner");

interface ResolvedArtifact {
  modelId: string;
  artifactPath: string;
}

export class ModelBackedInferenceRunner implements InferenceRunnerPort {
  private readonly production = new HeuristicInferenceRunner();
  private readonly mode: "shadow" | "canary";
  private readonly canaryPercent: number;
  private readonly envOverride?: string;
  /** Per-artifact ONNX adapter cache. Keyed by absolute artifact path. */
  private readonly adapters = new Map<string, OnnxInferenceAdapter>();
  /** Per-modelVersionId resolution cache. */
  private readonly resolveCache = new Map<string, Promise<ResolvedArtifact | null>>();

  constructor(envOverride?: string) {
    this.envOverride = envOverride;
    this.mode = (process.env.PDM_ONNX_MODE ?? "shadow") === "canary" ? "canary" : "shadow";
    const pct = Number(process.env.PDM_ONNX_CANARY_PERCENT ?? "0");
    this.canaryPercent = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  }

  private getAdapter(artifactPath: string): OnnxInferenceAdapter {
    let a = this.adapters.get(artifactPath);
    if (!a) {
      a = new OnnxInferenceAdapter({ modelPath: artifactPath });
      this.adapters.set(artifactPath, a);
    }
    return a;
  }

  /** Resolves the deployed ONNX artifact for a modelVersionId via the
   *  ml_models registry. Cached per (orgId, modelVersionId) for process
   *  lifetime; promotion/rollback bumps the version id, so cache
   *  invalidation happens naturally as new modelVersionIds flow
   *  through. The orgId predicate enforces strict tenancy even if a
   *  modelVersionId from an external request leaks across orgs. */
  private async resolveFromRegistry(
    orgId: string,
    modelVersionId: string
  ): Promise<ResolvedArtifact | null> {
    const cacheKey = `${orgId}::${modelVersionId}`;
    const cached = this.resolveCache.get(cacheKey);
    if (cached) return cached;
    const lookup = (async (): Promise<ResolvedArtifact | null> => {
      try {
        const [row] = await db
          .select({
            id: mlModels.id,
            status: mlModels.status,
            metrics: mlModels.trainingMetrics,
          })
          .from(mlModels)
          .where(
            and(
              eq(mlModels.id, modelVersionId),
              eq(mlModels.orgId, orgId),
              eq(mlModels.status, "deployed")
            )
          )
          .limit(1);
        if (!row) return null;
        const metrics = (row.metrics ?? {}) as { artifactPath?: string };
        if (!metrics.artifactPath) return null;
        try {
          await fs.access(metrics.artifactPath);
        } catch {
          logger.warn("Deployed model artifact missing on disk", {
            modelVersionId,
            artifactPath: metrics.artifactPath,
          });
          return null;
        }
        return { modelId: row.id, artifactPath: metrics.artifactPath };
      } catch (err) {
        logger.warn("Registry lookup failed — falling back to heuristic", {
          modelVersionId,
          err: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    })();
    this.resolveCache.set(cacheKey, lookup);
    return lookup;
  }

  /** Resolves the operator-pinned env artifact (one-time existence check). */
  private envArtifactReady?: Promise<ResolvedArtifact | null>;
  private async resolveFromEnv(): Promise<ResolvedArtifact | null> {
    if (!this.envOverride) return null;
    if (!this.envArtifactReady) {
      const p = this.envOverride;
      this.envArtifactReady = fs
        .access(p)
        .then(() => ({ modelId: `env:${path.basename(p)}`, artifactPath: p }))
        .catch((): ResolvedArtifact | null => {
          logger.warn("PDM_ONNX_MODEL_PATH artifact missing — env override disabled", {
            modelPath: p,
          });
          return null;
        });
    }
    return this.envArtifactReady;
  }

  private async resolveArtifact(context: InferenceContext): Promise<ResolvedArtifact | null> {
    if (context.modelVersionId && context.orgId) {
      const fromRegistry = await this.resolveFromRegistry(
        context.orgId,
        context.modelVersionId
      );
      if (fromRegistry) return fromRegistry;
    }
    return this.resolveFromEnv();
  }

  async scoreFeatures(context: InferenceContext): Promise<PredictionScore> {
    const artifact = await this.resolveArtifact(context);
    const candidate = artifact ? this.getAdapter(artifact.artifactPath) : undefined;
    const result = await serveWithShadowOrCanary<PredictionScore>({
      productionModelId: "heuristic-baseline",
      candidateModelId: artifact ? artifact.modelId : undefined,
      productionPredict: () => this.production.scoreFeatures(context),
      candidatePredict: candidate ? () => candidate.scoreFeatures(context) : undefined,
      canaryPercent: this.mode === "canary" ? this.canaryPercent : undefined,
      divergence: (p, c) => Math.abs(p.failureProbability - c.failureProbability),
    });
    return result.result;
  }
}

/** Always returns the registry-backed runner. The runner itself
 *  collapses to pure heuristic when no deployed artifact exists, so
 *  this is safe to wire unconditionally. */
export function resolveInferenceRunner(): InferenceRunnerPort {
  const envOverride = process.env.PDM_ONNX_MODEL_PATH?.trim() || undefined;
  if (envOverride) {
    logger.info("ONNX runner active (registry + env override)", {
      envOverride,
      mode: process.env.PDM_ONNX_MODE ?? "shadow",
      canaryPercent: process.env.PDM_ONNX_CANARY_PERCENT ?? "0",
    });
  } else {
    logger.info("ONNX runner active (registry-backed)", {
      mode: process.env.PDM_ONNX_MODE ?? "shadow",
    });
  }
  return new ModelBackedInferenceRunner(envOverride);
}
