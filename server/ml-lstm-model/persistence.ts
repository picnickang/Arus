/**
 * LSTM Model - Persistence
 * Save and load trained models
 */

import * as tf from "@tensorflow/tfjs-node";
import type { TrainedLSTMModel } from "./types.js";

export async function saveLSTMModel(trainedModel: TrainedLSTMModel, path: string): Promise<void> {
  await trainedModel.model.save(`file://${path}`);

  const metadata = {
    config: trainedModel.config,
    featureNames: trainedModel.featureNames,
    normalizationParams: trainedModel.normalizationParams,
    trainingMetrics: trainedModel.trainingMetrics,
  };

  const fs = await import("fs/promises");
  await fs.writeFile(`${path}/metadata.json`, JSON.stringify(metadata, null, 2));

  const { savePreprocessingParams } = await import("../ml-preprocessing-params.js");
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};
  trainedModel.featureNames.forEach((name, idx) => {
    means[name] = trainedModel.normalizationParams.mean[idx];
    stds[name] = trainedModel.normalizationParams.std[idx];
  });

  await savePreprocessingParams(path, {
    normalization: { means, stds },
    features: {
      sensorTypes: trainedModel.featureNames,
      sequenceLength: trainedModel.config.sequenceLength,
      lookbackDays: undefined,
    },
  });
}

export async function loadLSTMModel(path: string): Promise<TrainedLSTMModel> {
  const model = await tf.loadLayersModel(`file://${path}/model.json`);

  const fs = await import("fs/promises");
  const metadataJson = await fs.readFile(`${path}/metadata.json`, "utf-8");
  const metadata = JSON.parse(metadataJson);

  return {
    model,
    config: metadata.config,
    featureNames: metadata.featureNames,
    normalizationParams: metadata.normalizationParams,
    trainingMetrics: metadata.trainingMetrics,
  };
}
