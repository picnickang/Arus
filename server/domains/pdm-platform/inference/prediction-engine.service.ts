import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import {
  inferenceRuns,
  failurePredictions,
  predictionExplanations,
  equipmentFeatures,
  modelDeployments,
} from "@shared/schema";
import type { FeatureVector, InferenceRunnerPort, InferenceResult, PredictionScore } from "./ports";
import { logger } from "../../../utils/logger";

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

    const resolvedVersionId = modelVersionId ?? (await this.resolveActiveVersion(orgId));

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

      const explanationRows = this.generateExplanations(predictionRecord.id, run.id, features);
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

      logger.info("[PredictionEngine] Inference completed", {
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

  private async resolveActiveVersion(orgId: string): Promise<string | undefined> {
    const [deployment] = await db
      .select()
      .from(modelDeployments)
      .where(
        and(eq(modelDeployments.orgId, orgId), eq(modelDeployments.deploymentStatus, "active"))
      )
      .orderBy(desc(modelDeployments.deployedOn))
      .limit(1);
    return deployment?.modelVersionId ?? undefined;
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

    return { failureProbability, remainingUsefulLife, riskLevel };
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

  private generateExplanations(predictionId: number, inferenceRunId: string, features: FeatureVector | null) {
    if (!features) {
      return [];
    }

    const contributions = [
      { featureName: "rmsVibration", value: features.rmsVibration, baseline: 2.0, weight: 0.3 },
      { featureName: "meanTemp", value: features.meanTemp, baseline: 55, weight: 0.25 },
      { featureName: "meanPressure", value: features.meanPressure, baseline: 200, weight: 0.2 },
      { featureName: "kurtosis", value: features.kurtosis, baseline: 3.0, weight: 0.15 },
      { featureName: "peakToPeak", value: features.peakToPeak, baseline: 5.0, weight: 0.1 },
    ];

    const valid = contributions.filter((c) => c.value != null);
    const totalWeight = valid.reduce((sum, c) => sum + c.weight, 0);

    return valid.map((c) => {
      const normalizedImportance = totalWeight > 0 ? c.weight / totalWeight : 0;
      const deviation = c.value - c.baseline;
      return {
        predictionId,
        inferenceRunId,
        featureName: c.featureName,
        importance: Math.round(normalizedImportance * 100) / 100,
        featureValue: c.value,
        baselineValue: c.baseline,
        direction: deviation > 0.5 ? "increasing" : deviation < -0.5 ? "decreasing" : "stable",
      };
    });
  }
}
