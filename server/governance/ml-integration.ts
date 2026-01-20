/**
 * ML Governance Integration
 * Helper functions to integrate lineage/provenance tracking with ML pipeline
 */

import { recordTraining, sha256File, sha256 } from "./lineage.js";
import { recordTraining as recordTrainingProvenance } from "./provenance.js";
import type { TrainingResult } from "../ml-training-pipeline.js";
import type { ModelFamily, DatasetMixEntry } from "./types.js";

/**
 * Record lineage after model training completes
 */
export async function recordModelLineage(params: {
  trainingResult: TrainingResult;
  orgId: string;
  profile?: string;
  vesselId?: string;
  datasetMix: DatasetMixEntry[];
  trainedBy: string;
  hyperparameters: Record<string, any>;
}): Promise<void> {
  const { trainingResult, orgId, profile, vesselId, datasetMix, trainedBy, hyperparameters } =
    params;

  try {
    // Compute artifact hashes
    let checkpointHash: string;
    try {
      checkpointHash = await sha256File(trainingResult.modelPath);
    } catch (error) {
      console.warn(`[Lineage] Could not hash model file, using modelId hash instead:`, error);
      checkpointHash = sha256(trainingResult.modelId);
    }

    // Create lineage record
    const lineageRecord = await recordTraining({
      modelId: trainingResult.modelId,
      family: trainingResult.modelType as ModelFamily,
      profile: profile || trainingResult.equipmentType || "unknown",
      vesselId,
      version: `v${Date.now()}`, // Use timestamp-based version for now
      createdAt: new Date().toISOString(),
      trainedBy,
      datasetMix,
      hyperparams: hyperparameters,
      metrics: {
        accuracy: trainingResult.metrics.accuracy ?? 0,
        precision: trainingResult.metrics.precision ?? 0,
        recall: trainingResult.metrics.recall ?? 0,
        f1Score: trainingResult.metrics.f1Score ?? 0,
        loss: trainingResult.metrics.loss ?? 0,
      },
      artifacts: {
        checkpointPath: trainingResult.modelPath,
        checkpointHash,
      },
      promotion: {
        stage: "dev", // New models start in dev
        canary: false,
      },
      predictionCount: 0,
      orgId,
    });

    // Also record in provenance chain
    const datasetHash = sha256(JSON.stringify(datasetMix, null, 0));
    await recordTrainingProvenance({
      modelId: trainingResult.modelId,
      checkpointHash,
      datasetHash,
      orgId,
      userId: trainedBy,
    });

    console.log(`[Lineage] Recorded training lineage for model ${trainingResult.modelId}`);
  } catch (error) {
    console.error("[Lineage] Failed to record model lineage:", error);
    // Don't throw - lineage recording should not break training
  }
}

/**
 * Get dataset mix from telemetry statistics
 * This is a placeholder - in production, you'd track actual data sources
 */
export function inferDatasetMix(params: {
  totalSamples: number;
  sensorTypes?: string[];
}): DatasetMixEntry[] {
  // For now, assume company telemetry is the primary source
  // In a real implementation, you'd track which datasets were used
  return [
    {
      name: "company_telemetry",
      weight: 1,
      hash: sha256(
        JSON.stringify({
          samples: params.totalSamples,
          sensors: params.sensorTypes ?? [],
        })
      ),
      rowCount: params.totalSamples,
    },
  ];
}
