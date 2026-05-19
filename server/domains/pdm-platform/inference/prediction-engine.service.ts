import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import {
  inferenceRuns,
  failurePredictions,
  predictionExplanations,
  equipmentFeatures,
  mlModels,
  equipment,
} from "@shared/schema";
import type { FeatureVector, InferenceRunnerPort, InferenceResult, PredictionScore } from "./ports";
import { logger } from "../../../utils/logger";

/**
 * Push A1 — Typed coercer: turns a permutation-driver's generic
 * numeric record into the canonical FeatureVector used by every
 * downstream runner. Only known feature names are forwarded; any
 * extra keys land on the `[key: string]: unknown` index signature
 * declared on FeatureVector, with no `as unknown` escape needed.
 */
function recordToFeatureVector(record: Record<string, number>): FeatureVector {
  const fv: FeatureVector = {};
  const known: ReadonlyArray<keyof FeatureVector> = [
    "meanTemp",
    "meanVibration",
    "rmsVibration",
    "meanPressure",
    "kurtosis",
    "peakToPeak",
  ];
  for (const k of known) {
    const v = record[k as string];
    if (typeof v === "number" && Number.isFinite(v)) {
      (fv as Record<string, unknown>)[k as string] = v;
    }
  }
  return fv;
}

export interface PredictionExplanationQuery {
  getExplanations(orgId: string, predictionId: number): Promise<any[]>;
}

export class PredictionEngineService implements PredictionExplanationQuery {
  constructor(private runner: InferenceRunnerPort) {}

  async predict(
    orgId: string,
    equipmentId: string,
    modelVersionId?: string
  ): Promise<InferenceResult> {
    const startTime = Date.now();

    const resolvedVersionId =
      modelVersionId ?? (await this.resolveActiveVersion(orgId, equipmentId));

    const [run] = await db
      .insert(inferenceRuns)
      .values({
        orgId,
        equipmentId,
        modelVersionId: resolvedVersionId ?? null,
        status: "running",
      })
      .returning();

    try {
      const features = await this.fetchLatestFeatures(orgId, equipmentId);
      const prediction = this.normalizePrediction(
        await this.runner.scoreFeatures({
          orgId,
          equipmentId,
          modelVersionId: resolvedVersionId,
          features,
        })
      );
      const recommendations = this.generateRecommendations(prediction.failureProbability, features);

      const [predictionRecord] = await db
        .insert(failurePredictions)
        .values({
          orgId,
          equipmentId,
          failureProbability: prediction.failureProbability,
          remainingUsefulLife: prediction.remainingUsefulLife,
          riskLevel: prediction.riskLevel,
          predictedFailureDate: new Date(Date.now() + prediction.remainingUsefulLife * 24 * 60 * 60 * 1000),
          maintenanceRecommendations: recommendations,
          inputFeatures: features
            ? {
                meanTemp: features.meanTemp,
                meanVibration: features.meanVibration,
                rmsVibration: features.rmsVibration,
                meanPressure: features.meanPressure,
                kurtosis: features.kurtosis,
              }
            : null,
          modelVersionId: resolvedVersionId ?? null,
          featureSetVersion: features?.windowMinutes ? `v1.window${features.windowMinutes}m` : "v1",
          featureSnapshotId: features?.id ?? null,
        })
        .returning();

      const explanationRows = await this.generateExplanations(
        predictionRecord.id,
        run.id,
        features,
        orgId,
        resolvedVersionId
      );
      if (explanationRows.length > 0) {
        await db.insert(predictionExplanations).values(explanationRows);
      }

      const latencyMs = Date.now() - startTime;
      const [updatedRun] = await db
        .update(inferenceRuns)
        .set({
          status: "completed",
          finishedAt: new Date(),
          latencyMs,
          predictionId: predictionRecord.id,
        })
        .where(eq(inferenceRuns.id, run.id))
        .returning();

      logger.info("[PredictionEngine] Inference completed", undefined, {
        orgId,
        equipmentId,
        latencyMs,
        riskLevel: prediction.riskLevel,
        hasFeatures: !!features,
      });

      return {
        inferenceRun: updatedRun,
        prediction: {
          failureProbability: prediction.failureProbability,
          riskLevel: prediction.riskLevel,
          remainingUsefulLife: prediction.remainingUsefulLife,
          recommendations,
          method: prediction.method ?? "heuristic-baseline",
          caveat:
            prediction.caveat ??
            "Baseline deterministic risk scoring; not a trained PdM model.",
        },
        explanations: explanationRows,
      };
    } catch (error: any) {
      await db
        .update(inferenceRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          latencyMs: Date.now() - startTime,
          errorMessage: error.message,
        })
        .where(eq(inferenceRuns.id, run.id));
      throw error;
    }
  }

  async getExplanations(orgId: string, predictionId: number): Promise<any[]> {
    const [prediction] = await db
      .select({ orgId: failurePredictions.orgId })
      .from(failurePredictions)
      .where(and(eq(failurePredictions.id, predictionId), eq(failurePredictions.orgId, orgId)))
      .limit(1);

    if (!prediction) {
      return [];
    }

    return db
      .select()
      .from(predictionExplanations)
      .where(eq(predictionExplanations.predictionId, predictionId))
      .orderBy(desc(predictionExplanations.importance));
  }

  /**
   * Full prediction lineage: links a prediction back to the exact feature snapshot
   * and model version used to produce it. Enables reproducibility and audit.
   */
  async getLineage(
    orgId: string,
    predictionId: number
  ): Promise<{
    prediction: {
      id: number;
      predictionTimestamp: Date | null;
      failureProbability: number;
      riskLevel: string;
      remainingUsefulLife: number | null;
    };
    modelVersion: { id: string } | null;
    featureSetVersion: string | null;
    featureSnapshot: {
      id: string;
      timestamp: Date;
      windowMinutes: number | null;
      values: Record<string, number | null>;
    } | null;
  } | null> {
    const [prediction] = await db
      .select()
      .from(failurePredictions)
      .where(and(eq(failurePredictions.id, predictionId), eq(failurePredictions.orgId, orgId)))
      .limit(1);

    if (!prediction) {
      return null;
    }

    let featureSnapshot = null;
    if (prediction.featureSnapshotId) {
      const [snap] = await db
        .select()
        .from(equipmentFeatures)
        .where(
          and(
            eq(equipmentFeatures.id, prediction.featureSnapshotId),
            eq(equipmentFeatures.orgId, orgId)
          )
        )
        .limit(1);
      if (snap) {
        featureSnapshot = {
          id: snap.id,
          timestamp: snap.timestamp,
          windowMinutes: snap.windowMinutes,
          values: {
            meanTemp: snap.meanTemp,
            stdTemp: snap.stdTemp,
            meanVibration: snap.meanVibration,
            stdVibration: snap.stdVibration,
            rmsVibration: snap.rmsVibration,
            peakToPeak: snap.peakToPeak,
            meanPressure: snap.meanPressure,
            stdPressure: snap.stdPressure,
            kurtosis: snap.kurtosis,
            skewness: snap.skewness,
          },
        };
      }
    }

    return {
      prediction: {
        id: prediction.id,
        predictionTimestamp: prediction.predictionTimestamp,
        failureProbability: prediction.failureProbability,
        riskLevel: prediction.riskLevel,
        remainingUsefulLife: prediction.remainingUsefulLife,
      },
      modelVersion: prediction.modelVersionId ? { id: prediction.modelVersionId } : null,
      featureSetVersion: prediction.featureSetVersion ?? null,
      featureSnapshot,
    };
  }

  /**
   * Push A1 — Single source of truth: ml_models. Resolves the
   * currently-deployed model id for the equipment's type. This is the
   * exact row the /ml/models/:id/promote and /rollback endpoints
   * mutate, so promotion now directly takes effect at runtime. Falls
   * back to org-wide deployed model when no equipmentType-specific
   * row exists, then to undefined (=> heuristic).
   */
  private async resolveActiveVersion(
    orgId: string,
    equipmentId: string
  ): Promise<string | undefined> {
    const [equip] = await db
      .select({ type: equipment.type })
      .from(equipment)
      .where(and(eq(equipment.orgId, orgId), eq(equipment.id, equipmentId)))
      .limit(1);
    if (equip?.type) {
      const [deployed] = await db
        .select({ id: mlModels.id })
        .from(mlModels)
        .where(
          and(
            eq(mlModels.orgId, orgId),
            eq(mlModels.status, "deployed"),
            eq(mlModels.equipmentType, equip.type)
          )
        )
        .orderBy(desc(mlModels.deployedOn))
        .limit(1);
      if (deployed?.id) return deployed.id;
    }
    const [anyDeployed] = await db
      .select({ id: mlModels.id })
      .from(mlModels)
      .where(and(eq(mlModels.orgId, orgId), eq(mlModels.status, "deployed")))
      .orderBy(desc(mlModels.deployedOn))
      .limit(1);
    return anyDeployed?.id ?? undefined;
  }

  private async fetchLatestFeatures(orgId: string, equipmentId: string) {
    const [features] = await db
      .select()
      .from(equipmentFeatures)
      .where(
        and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.equipmentId, equipmentId))
      )
      .orderBy(desc(equipmentFeatures.timestamp))
      .limit(1);
    return features ?? null;
  }

  private normalizePrediction(prediction: PredictionScore): PredictionScore {
    const failureProbability = Number.isFinite(prediction.failureProbability)
      ? Math.min(Math.max(Math.round(prediction.failureProbability * 100) / 100, 0), 0.99)
      : 0.1;

    const remainingUsefulLife = Number.isFinite(prediction.remainingUsefulLife)
      ? Math.max(Math.floor(prediction.remainingUsefulLife), 1)
      : Math.max(Math.floor(365 * (1 - failureProbability)), 7);

    const riskLevel =
      prediction.riskLevel ??
      (failureProbability > 0.7
        ? "critical"
        : failureProbability > 0.4
          ? "high"
          : failureProbability > 0.2
            ? "medium"
            : "low");

    return {
      failureProbability,
      remainingUsefulLife,
      riskLevel,
      method: prediction.method ?? "heuristic-baseline",
      caveat:
        prediction.caveat ??
        "Baseline deterministic risk scoring; not a trained PdM model.",
    };
  }

  private generateRecommendations(failureProbability: number, features: FeatureVector | null): string[] {
    const recs: string[] = [];
    if (failureProbability > 0.5) {
      recs.push("Schedule preventive maintenance within 2 weeks");
    }
    if (failureProbability > 0.3) {
      recs.push("Increase monitoring frequency");
    }
    if (features?.rmsVibration && features.rmsVibration > 4) {
      recs.push("Inspect vibration isolation mounts");
    }
    if (features?.meanTemp && features.meanTemp > 75) {
      recs.push("Check cooling system efficiency");
    }
    if (features?.meanPressure && (features.meanPressure < 100 || features.meanPressure > 260)) {
      recs.push("Investigate pressure anomaly");
    }
    if (features?.kurtosis && features.kurtosis > 5) {
      recs.push("Vibration pattern suggests bearing wear — schedule ultrasonic inspection");
    }
    if (recs.length === 0) {
      recs.push("Continue normal monitoring schedule");
    }
    return recs;
  }

  /**
   * Push A1 — Per-instance attributions via permutation importance against
   * the bound inference runner. Replaces the previous hardcoded-weight
   * explanation with a model-agnostic signal that actually reflects how
   * each feature moved this specific prediction. Falls through to an
   * empty list if the runner is non-deterministic or features are null.
   */
  private async generateExplanations(
    predictionId: number,
    inferenceRunId: string,
    features: FeatureVector | null,
    orgId?: string,
    modelVersionId?: string
  ) {
    if (!features) {
      return [];
    }
    const featureMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(features)) {
      if (typeof v === "number" && Number.isFinite(v)) featureMap[k] = v;
    }
    if (Object.keys(featureMap).length === 0) return [];

    // Prefer real TreeSHAP via the Python sidecar when enabled and the
    // deployed model is an xgboost tree ensemble. Falls back silently
    // to the TS permutation-importance path on any failure.
    if (orgId && modelVersionId) {
      try {
        const { isPythonShapEnabled, shapAttribute } = await import("../../../ml-explainability-python-shap");
        if (isPythonShapEnabled()) {
          const shap = await shapAttribute(modelVersionId, orgId, featureMap);
          if (shap && Object.keys(shap.shapValues).length > 0) {
            const entries = Object.entries(shap.shapValues)
              .filter(([, v]) => Number.isFinite(v) && Math.abs(v) > 1e-9)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 8);
            const totalMag = entries.reduce((s, [, v]) => s + Math.abs(v), 0) || 1;
            return entries.map(([feature, shapValue]) => ({
              predictionId,
              inferenceRunId,
              featureName: feature,
              importance: Math.round((Math.abs(shapValue) / totalMag) * 1000) / 1000,
              featureValue: featureMap[feature] ?? null,
              baselineValue: null,
              direction: shapValue > 0 ? "increasing" : "decreasing",
            }));
          }
        }
      } catch (err) {
        // Hard failure of the SHAP path is rare but recoverable —
        // emit telemetry and fall through to the permutation path.
        logger.warn(
          "[PredictionEngine] Python TreeSHAP failed, using permutation fallback",
          undefined,
          {
            modelVersionId,
            err: err instanceof Error ? err.message : String(err),
          }
        );
      }
    }

    const { explainXGBoostPrediction } = await import("../../../ml-explainability-service");
    const explanation = await explainXGBoostPrediction(
      {
        predict: async (f: Record<string, number>) => {
          // Push A1 — use the real prediction context so permutation
          // attribution is scored against the SAME deployed model the
          // original prediction used. Falling back to a synthetic
          // context here would silently route to heuristic via the
          // registry resolver and detach the explanation from the
          // model that produced the prediction.
          const score = await this.runner.scoreFeatures({
            orgId: orgId ?? "_perm",
            equipmentId: "_perm",
            modelVersionId,
            features: recordToFeatureVector(f),
          });
          return score.failureProbability;
        },
      },
      { features: featureMap }
    );

    return explanation.topFeatures.map((f) => ({
      predictionId,
      inferenceRunId,
      featureName: f.feature,
      importance: f.importance,
      featureValue: (featureMap[f.feature] as number | undefined) ?? null,
      baselineValue: null,
      direction:
        f.direction === "positive"
          ? "increasing"
          : f.direction === "negative"
            ? "decreasing"
            : "stable",
    }));
  }
}
