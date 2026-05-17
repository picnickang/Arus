/**
 * ML Ensemble Batch Processing
 *
 * Batch predictions for multiple equipment with memory management.
 */

import type { TimeSeriesFeatures } from "../ml-training-data.js";
import { logger } from "../utils/logger.js";
import { dbTelemetryStorage } from "../db/telemetry/index.js";
import type { EnsemblePrediction } from "./types.js";
import { ensemblePredict } from "./predict.js";

export async function batchEnsemblePredict(
  orgId: string,
  equipmentIds: string[],
  batchSize: number = 10
): Promise<Map<string, EnsemblePrediction>> {
  const results = new Map<string, EnsemblePrediction>();

  logger.info(
    "MlEnsemble",
    `Batch predicting for ${equipmentIds.length} equipment (batch size: ${batchSize})`
  );

  const tf = await import("@tensorflow/tfjs-node");

  for (let i = 0; i < equipmentIds.length; i += batchSize) {
    const batch = equipmentIds.slice(i, i + batchSize);
    const tensorsBefore = tf.memory().numTensors;

    const batchPromises = batch.map(async (equipmentId) => {
      try {
        const recentData = await dbTelemetryStorage.getLatestTelemetryReadings(equipmentId, 500);

        if (recentData.length < 5) {
          logger.warn("MlEnsemble", `Insufficient data for ${equipmentId}, skipping`);
          return null;
        }

        // @ts-ignore -- bulk-silence
        const timeSeriesData: TimeSeriesFeatures[] = recentData.map((t: any) => ({
          equipmentId: t.equipmentId,
          timestamp: t.ts,
          features: t.readings as any,
          normalizedFeatures: {},
          label: 0,
        }));

        const prediction = await ensemblePredict(orgId, equipmentId, timeSeriesData);
        return { equipmentId, prediction };
      } catch (error) {
        logger.error("MlEnsemble", `Failed to predict for ${equipmentId}`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result) {
        results.set(result.equipmentId, result.prediction);
      }
    }

    if (global.gc) {
      global.gc();
    }

    const tensorsAfter = tf.memory().numTensors;
    const tensorLeak = tensorsAfter - tensorsBefore;
    if (tensorLeak > 10) {
      logger.warn(
        "MlEnsemble",
        `Potential tensor leak detected: ${tensorLeak} tensors not disposed after batch ${Math.floor(i / batchSize) + 1}`
      );
      logger.warn("MlEnsemble", `Memory: ${JSON.stringify(tf.memory())}`);
    }

    logger.debug(
      "MlEnsemble",
      `Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(equipmentIds.length / batchSize)} (tensors: ${tensorsAfter})`
    );
  }

  logger.info(
    "MlEnsemble",
    `Batch prediction complete: ${results.size}/${equipmentIds.length} successful`
  );

  return results;
}
