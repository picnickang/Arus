/**
 * Push A1 — Model-backed inference runner.
 *
 * When a deployed ONNX artifact is resolvable for the incoming
 * InferenceContext, that artifact IS the production predictor — its
 * scoring output is what the user sees. The heuristic runner is a
 * fallback only: if the ONNX call throws (missing artifact, shape
 * mismatch, runtime crash) the runner silently substitutes the
 * heuristic so user-visible predictions never go to error. When no
 * deployed artifact is resolvable at all, the heuristic remains the
 * sole production path (same behaviour as pre-A1).
 *
 * Selection priority:
 *   1. The ml_models registry — for each InferenceContext whose
 *      modelVersionId points at a `status='deployed'` row with a
 *      `training_metrics.artifactPath` on disk, that artifact is the
 *      production predictor. This is the closed-loop wiring that the
 *      weekly retraining + /ml/models/:id/promote endpoint mutates.
 *   2. Env `PDM_ONNX_MODEL_PATH` — operator-pinned override that
 *      bypasses the registry. Useful for benchmarking / pre-rollout.
 *   3. None — collapses to pure heuristic.
 *
 * `PDM_ONNX_MODE=shadow|canary` re-enables the Wave 3.3 observation
 * substrate where the deployed ONNX is the *candidate* and heuristic
 * is *production*; this is intended for operator-led rollout drills
 * BEFORE flipping the default. The default mode is `live`: deployed
 * ONNX serves user traffic directly with heuristic fallback.
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
import { getReadAdapterForUri } from "../infrastructure/artifact-storage";
import type { InferenceContext, InferenceRunnerPort, PredictionScore } from "./ports";

const logger = createLogger("ModelBackedInferenceRunner");

interface ResolvedArtifact {
  modelId: string;
  artifactPath: string;
}

export class ModelBackedInferenceRunner implements InferenceRunnerPort {
  private readonly heuristic = new HeuristicInferenceRunner();
  private readonly mode: "live" | "shadow" | "canary";
  private readonly canaryPercent: number;
  private readonly envOverride?: string | undefined;
  /** Per-artifact ONNX adapter cache. Keyed by absolute artifact path. */
  private readonly adapters = new Map<string, OnnxInferenceAdapter>();
  /** Per-(orgId,modelVersionId) resolution cache. */
  private readonly resolveCache = new Map<string, Promise<ResolvedArtifact | null>>();

  constructor(envOverride?: string) {
    this.envOverride = envOverride;
    const rawMode = (process.env['PDM_ONNX_MODE'] ?? "live").toLowerCase();
    this.mode = rawMode === "shadow" || rawMode === "canary" ? rawMode : "live";
    const pct = Number(process.env['PDM_ONNX_CANARY_PERCENT'] ?? "0");
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
        // metrics.artifactPath may be a legacy local path or a new
        // `arus-artifact://<backend>/<key>` URI. The read adapter is
        // chosen from the URI itself so flipping the admin write
        // backend never breaks resolution of already-deployed models.
        let localPath: string;
        try {
          const adapter = getReadAdapterForUri(metrics.artifactPath);
          localPath = await adapter.materializeToLocal(metrics.artifactPath);
        } catch (err) {
          logger.warn("Deployed model artifact unresolvable", {
            modelVersionId,
            artifactPath: metrics.artifactPath,
            err: err instanceof Error ? err.message : String(err),
          });
          return null;
        }
        return { modelId: row.id, artifactPath: localPath };
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

    // No deployed ONNX model resolvable — heuristic is sole production.
    // Still route through serveWithShadowOrCanary (pure-production
    // mode) so every inference passes through the Wave 3.3 contract.
    if (!artifact) {
      const result = await serveWithShadowOrCanary<PredictionScore>({
        productionModelId: "heuristic-baseline",
        productionPredict: () => this.heuristic.scoreFeatures(context),
      });
      return result.result;
    }

    const onnx = this.getAdapter(artifact.artifactPath);

    if (this.mode === "live") {
      // Deployed ONNX IS production. The wrapped productionPredict
      // calls ONNX first and falls back to heuristic ONLY on a hard
      // failure (artifact corrupt / runtime crash) so users never see
      // an exception. We still go through serveWithShadowOrCanary so
      // metrics + the candidate-failure-isolation contract apply
      // uniformly across all serving paths (Wave 3.3).
      const productionPredict = async (): Promise<PredictionScore> => {
        try {
          return await onnx.scoreFeatures(context);
        } catch (err) {
          logger.warn("Deployed ONNX scoring failed — heuristic fallback", {
            modelVersionId: context.modelVersionId,
            modelId: artifact.modelId,
            err: err instanceof Error ? err.message : String(err),
          });
          return this.heuristic.scoreFeatures(context);
        }
      };
      const result = await serveWithShadowOrCanary<PredictionScore>({
        productionModelId: artifact.modelId,
        productionPredict,
      });
      return result.result;
    }

    // Observation modes (operator-led pre-rollout): deployed ONNX is
    // the *candidate*, heuristic is *production*. This is the
    // canonical Wave 3.3 substrate used for A/B / divergence-testing
    // BEFORE flipping PDM_ONNX_MODE=live.
    const result = await serveWithShadowOrCanary<PredictionScore>({
      productionModelId: "heuristic-baseline",
      candidateModelId: artifact.modelId,
      productionPredict: () => this.heuristic.scoreFeatures(context),
      candidatePredict: () => onnx.scoreFeatures(context),
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
  const envOverride = process.env['PDM_ONNX_MODEL_PATH']?.trim() || undefined;
  const mode = process.env['PDM_ONNX_MODE'] ?? "live";
  if (envOverride) {
    logger.info("ONNX runner active (registry + env override)", {
      envOverride,
      mode,
      canaryPercent: process.env['PDM_ONNX_CANARY_PERCENT'] ?? "0",
    });
  } else {
    logger.info("ONNX runner active (registry-backed)", { mode });
  }
  return new ModelBackedInferenceRunner(envOverride);
}
