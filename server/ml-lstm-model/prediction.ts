/**
 * LSTM Model - Prediction
 * Inference using trained LSTM model
 */

import * as tf from "@tensorflow/tfjs-node";
import type { TimeSeriesFeatures } from "../ml-training-data.js";
import type { TrainedLSTMModel, LSTMPrediction } from "./types.js";
import { normalizeFeatures } from "./normalization.js";

export async function predictWithLSTM(
  model: TrainedLSTMModel,
  recentData: TimeSeriesFeatures[],
  _preprocParams?: unknown
): Promise<LSTMPrediction> {
  if (recentData.length < model.config.sequenceLength) {
    throw new Error(`Insufficient data: need at least ${model.config.sequenceLength} time steps`);
  }

  const sorted = [...recentData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const sequence = sorted.slice(-model.config.sequenceLength);

  const featureSequence: number[][] = [];
  for (const point of sequence) {
    const features: number[] = [];
    for (const featureName of model.featureNames) {
      features.push((point as { features?: Record<string, number> }).features?.[featureName] ?? 0);
    }
    featureSequence.push(features);
  }

  const { normalized } = normalizeFeatures(
    featureSequence,
    model.normalizationParams.mean,
    model.normalizationParams.std
  );
  const inputTensor = tf.tensor3d([normalized]);

  const prediction = model.model.predict(inputTensor) as tf.Tensor;
  const failureProbability = (await prediction.data())[0];

  inputTensor.dispose();
  prediction.dispose();

  const confidence = Math.abs(failureProbability - 0.5) * 2;
  let daysToFailure: number | null = null;
  if (failureProbability > 0.5) {
    daysToFailure = Math.round(30 * (1 - failureProbability));
  }

  return { failureProbability, confidence, daysToFailure, method: "ml_lstm" };
}
