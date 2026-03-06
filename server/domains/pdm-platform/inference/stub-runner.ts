import type { InferenceRunnerPort, InferenceResult } from "./ports";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db";
import {
  inferenceRuns,
  failurePredictions,
  predictionExplanations,
  equipmentFeatures,
  modelVersions,
  modelDeployments,
} from "@shared/schema";
import { logger } from "../../../utils/logger";

export class StubInferenceRunner implements InferenceRunnerPort {
  async runInference(orgId: string, equipmentId: string, modelVersionId?: string): Promise<InferenceResult> {
    const startTime = Date.now();

    let resolvedVersionId = modelVersionId;
    if (!resolvedVersionId) {
      const [deployment] = await db.select().from(modelDeployments)
        .where(and(eq(modelDeployments.orgId, orgId), eq(modelDeployments.deploymentStatus, "active")))
        .orderBy(desc(modelDeployments.deployedAt))
        .limit(1);
      resolvedVersionId = deployment?.modelVersionId ?? undefined;
    }

    const [run] = await db.insert(inferenceRuns).values({
      orgId,
      equipmentId,
      modelVersionId: resolvedVersionId ?? null,
      status: "running",
    }).returning();

    try {
      const [latestFeatures] = await db.select()
        .from(equipmentFeatures)
        .where(and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.equipmentId, equipmentId)))
        .orderBy(desc(equipmentFeatures.timestamp))
        .limit(1);

      const failureProbability = Math.round(Math.random() * 100) / 100;
      const rul = Math.floor(30 + Math.random() * 330);
      const riskLevel = failureProbability > 0.7 ? "critical" : failureProbability > 0.4 ? "high" : failureProbability > 0.2 ? "medium" : "low";

      const recommendations = [];
      if (failureProbability > 0.5) recommendations.push("Schedule preventive maintenance within 2 weeks");
      if (failureProbability > 0.3) recommendations.push("Increase monitoring frequency");
      if (latestFeatures?.rmsVibration && latestFeatures.rmsVibration > 4) recommendations.push("Inspect vibration isolation mounts");
      if (latestFeatures?.meanTemp && latestFeatures.meanTemp > 75) recommendations.push("Check cooling system efficiency");
      if (recommendations.length === 0) recommendations.push("Continue normal monitoring schedule");

      const [prediction] = await db.insert(failurePredictions).values({
        orgId,
        equipmentId,
        failureProbability,
        remainingUsefulLife: rul,
        riskLevel,
        predictedFailureDate: new Date(Date.now() + rul * 24 * 60 * 60 * 1000),
        maintenanceRecommendations: recommendations,
        inputFeatures: latestFeatures ? {
          meanTemp: latestFeatures.meanTemp,
          meanVibration: latestFeatures.meanVibration,
          rmsVibration: latestFeatures.rmsVibration,
          meanPressure: latestFeatures.meanPressure,
        } : null,
      }).returning();

      const featureContributions = [
        { featureName: "rmsVibration", importance: 0.35, featureValue: latestFeatures?.rmsVibration ?? 2.5, baselineValue: 2.0, direction: "increasing" },
        { featureName: "meanTemp", importance: 0.25, featureValue: latestFeatures?.meanTemp ?? 55, baselineValue: 50, direction: "increasing" },
        { featureName: "meanPressure", importance: 0.2, featureValue: latestFeatures?.meanPressure ?? 180, baselineValue: 200, direction: "decreasing" },
        { featureName: "kurtosis", importance: 0.12, featureValue: latestFeatures?.kurtosis ?? 3.5, baselineValue: 3.0, direction: "increasing" },
        { featureName: "peakToPeak", importance: 0.08, featureValue: latestFeatures?.peakToPeak ?? 6.0, baselineValue: 5.0, direction: "increasing" },
      ];

      const explanationRows = featureContributions.map(fc => ({
        predictionId: prediction.id,
        inferenceRunId: run.id,
        featureName: fc.featureName,
        importance: fc.importance,
        featureValue: fc.featureValue,
        baselineValue: fc.baselineValue,
        direction: fc.direction,
      }));

      await db.insert(predictionExplanations).values(explanationRows);

      const latencyMs = Date.now() - startTime;
      const [updatedRun] = await db.update(inferenceRuns)
        .set({ status: "completed", finishedAt: new Date(), latencyMs, predictionId: prediction.id })
        .where(eq(inferenceRuns.id, run.id))
        .returning();

      logger.info("[Inference] Stub inference completed", { orgId, equipmentId, latencyMs, riskLevel });

      return {
        inferenceRun: updatedRun,
        prediction: { failureProbability, riskLevel, remainingUsefulLife: rul, recommendations },
        explanations: explanationRows,
      };
    } catch (error: any) {
      await db.update(inferenceRuns)
        .set({ status: "failed", finishedAt: new Date(), latencyMs: Date.now() - startTime, errorMessage: error.message })
        .where(eq(inferenceRuns.id, run.id));
      throw error;
    }
  }
}
