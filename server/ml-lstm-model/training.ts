/**
 * LSTM Model - Training
 * Model training with early stopping and class weights
 */

import * as tf from "@tensorflow/tfjs-node";
import type { TimeSeriesFeatures } from "../ml-training-data.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("MlLstmModel:Training");
import {
  trainWithEarlyStopping,
  type EarlyStoppingConfig,
} from "../ml-early-stopping.js";
const prepareClassWeightsForTF = (labels: number[]): Record<number, number> => {
  const counts: Record<number, number> = {};
  for (const l of labels) {counts[l] = (counts[l] ?? 0) + 1;}
  const total = labels.length;
  const weights: Record<number, number> = {};
  for (const k of Object.keys(counts)) {
    const c = counts[Number(k)] ?? 1;
    weights[Number(k)] = total / (c * Object.keys(counts).length);
  }
  return weights;
};
import type { LSTMConfig, TrainedLSTMModel } from "./types.js";
import { createLSTMModel } from "./architecture.js";
import { normalizeFeatures } from "./normalization.js";
import { prepareSequences } from "./sequences.js";

function validateSequences(
  trainSeqs: number[][][],
  valSeqs: number[][][],
  seqLength: number
): void {
  if (trainSeqs.length === 0) {
    throw new Error(
      `Insufficient training data: No sequences could be created. Each equipment needs at least ${seqLength + 1} data points.`
    );
  }

  if (valSeqs.length === 0) {
    throw new Error("Insufficient validation data: No sequences could be created.");
  }
}

function buildNormalizedSequences(
  sequences: number[][][],
  normalizedFlat: number[][],
  seqLength: number
): number[][][] {
  const result: number[][][] = [];
  for (let i = 0; i < sequences.length; i++) {
    result.push(normalizedFlat.slice(i * seqLength, (i + 1) * seqLength));
  }
  return result;
}

async function trainWithEarlyStoppingWrapper(
  model: tf.LayersModel,
  xTrain: tf.Tensor3D,
  yTrain: tf.Tensor2D,
  xVal: tf.Tensor3D,
  yVal: tf.Tensor2D,
  config: LSTMConfig,
  classWeights?: { [key: number]: number },
  verbose: boolean = true
): Promise<{ history: Record<string, number[]>; bestEpoch: number; finalF1: number; stoppedEarly: boolean }> {
  const earlyStoppingConfig: EarlyStoppingConfig = {
    patience: config.earlyStoppingPatience || 10,
    minDelta: 0.001,
    monitor: "val_loss",
    mode: "min",
  };

  const result = await trainWithEarlyStopping(model as tf.Sequential, xTrain, yTrain, xVal, yVal, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    classWeights,
    earlyStoppingConfig,
    verbose,
  });

  if (result.stoppedEarly) {
    logger.info(`[LSTM] Early stopping triggered. Best epoch: ${result.bestEpoch + 1}`);
  }

  return {
    history: result.history,
    bestEpoch: result.bestEpoch,
    finalF1: (result as { finalMetrics?: { valF1?: number } }).finalMetrics?.valF1 ?? 0,
    stoppedEarly: result.stoppedEarly,
  };
}

async function trainStandard(
  model: tf.LayersModel,
  xTrain: tf.Tensor3D,
  yTrain: tf.Tensor2D,
  xVal: tf.Tensor3D,
  yVal: tf.Tensor2D,
  config: LSTMConfig,
  classWeights?: { [key: number]: number },
  verbose: boolean = true
): Promise<{ history: Record<string, number[]> }> {
  const fitResult = await model.fit(xTrain, yTrain, {
    epochs: config.epochs,
    batchSize: config.batchSize,
    validationData: [xVal, yVal],
    ...(classWeights !== undefined ? { classWeight: classWeights } : {}),
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (verbose) {
          logger.info(`[LSTM] Epoch ${epoch + 1}/${config.epochs} - Loss: ${(logs?.['loss'] ?? 0).toFixed(4)}`);
        }
      },
    },
    verbose: 0,
  });

  return { history: fitResult.history as object as Record<string, number[]> };
}

function calculatePrecisionRecallF1(
  valPredData: number[][],
  valLabelsData: number[][],
  finalF1: number
): { precision: number; recall: number; f1Score: number } {
  let tp = 0,
    fp = 0,
    fn = 0;

  for (let i = 0; i < valPredData.length; i++) {
    const predRow = valPredData[i];
    const labelRow = valLabelsData[i];
    if (!predRow || !labelRow) {continue;}
    const pred = (predRow[0] ?? 0) >= 0.5 ? 1 : 0;
    const actual = labelRow[0] ?? 0;
    if (pred === 1 && actual === 1) {
      tp++;
    }
    if (pred === 1 && actual === 0) {
      fp++;
    }
    if (pred === 0 && actual === 1) {
      fn++;
    }
  }

  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1Score = finalF1 || (2 * (precision * recall)) / (precision + recall) || 0;

  return { precision, recall, f1Score };
}

export async function trainLSTMModel(
  trainingData: TimeSeriesFeatures[],
  validationData: TimeSeriesFeatures[],
  config: LSTMConfig
): Promise<TrainedLSTMModel> {
  const featureNames = Object.keys((trainingData[0] as { features?: Record<string, number> }).features ?? {});
  const updatedConfig = { ...config, featureCount: featureNames.length };

  const { sequences: trainSeqs, labels: trainLabels } = prepareSequences(
    trainingData,
    config.sequenceLength,
    featureNames
  );
  const { sequences: valSeqs, labels: valLabels } = prepareSequences(
    validationData,
    config.sequenceLength,
    featureNames
  );

  validateSequences(trainSeqs, valSeqs, config.sequenceLength);

  const flatTrainData = trainSeqs.flatMap((seq) => seq);
  const { normalized: normalizedFlat, mean, std } = normalizeFeatures(flatTrainData);
  const normalizedTrainSeqs = buildNormalizedSequences(
    trainSeqs,
    normalizedFlat,
    config.sequenceLength
  );

  const flatValData = valSeqs.flatMap((seq) => seq);
  const { normalized: normalizedValFlat } = normalizeFeatures(flatValData, mean, std);
  const normalizedValSeqs = buildNormalizedSequences(
    valSeqs,
    normalizedValFlat,
    config.sequenceLength
  );

  const xTrain = tf.tensor3d(normalizedTrainSeqs);
  const yTrain = tf.tensor2d(trainLabels.map((l) => [l]));
  const xVal = tf.tensor3d(normalizedValSeqs);
  const yVal = tf.tensor2d(valLabels.map((l) => [l]));

  const model = createLSTMModel(updatedConfig);
  const useEarlyStopping = config.useEarlyStopping !== false;
  const useClassWeights = config.useClassWeights !== false;
  const verbose = config.verbose !== false;

  logger.info("[LSTM] Starting training...");
  logger.info(`[LSTM] CPU Optimizations: Early Stopping = ${useEarlyStopping}, Class Weights = ${useClassWeights}`);

  let classWeights: { [key: number]: number } | undefined;
  if (useClassWeights) {
    classWeights = prepareClassWeightsForTF(trainLabels);
    logger.info("[LSTM] Class weights calculated:", { details: classWeights });
  }

  let history;
  let bestEpoch = config.epochs - 1;
  let finalF1 = 0;

  if (useEarlyStopping) {
    const result = await trainWithEarlyStoppingWrapper(
      model,
      xTrain,
      yTrain,
      xVal,
      yVal,
      config,
      classWeights,
      verbose
    );
    history = result.history;
    bestEpoch = result.bestEpoch;
    finalF1 = result.finalF1;
  } else {
    const result = await trainStandard(
      model,
      xTrain,
      yTrain,
      xVal,
      yVal,
      config,
      classWeights,
      verbose
    );
    history = result.history;
  }

  const lastEpoch = useEarlyStopping ? bestEpoch : config.epochs - 1;
  const lossArr = history['loss'];
  const loss = Array.isArray(lossArr) ? (lossArr[lastEpoch] ?? 0) : 0;
  const accArr = history['acc'];
  const valAccArr = history['val_acc'];
  const accuracy = Array.isArray(accArr)
    ? (accArr[lastEpoch] ?? 0)
    : Array.isArray(valAccArr)
      ? (valAccArr[lastEpoch] ?? 0)
      : 0;

  const valPred = model.predict(xVal) as tf.Tensor;
  const valPredData = (await valPred.array()) as number[][];
  const valLabelsData = (await yVal.array()) as number[][];
  valPred.dispose();

  const { precision, recall, f1Score } = calculatePrecisionRecallF1(
    valPredData,
    valLabelsData,
    finalF1
  );

  xTrain.dispose();
  yTrain.dispose();
  xVal.dispose();
  yVal.dispose();

  logger.info("[LSTM] Training completed");
  logger.info(`[LSTM] Final metrics - Loss: ${loss.toFixed(4)}, Accuracy: ${accuracy.toFixed(4)}, F1: ${f1Score.toFixed(4)}`);

  return {
    model,
    config: updatedConfig,
    featureNames,
    normalizationParams: { mean, std },
    trainingMetrics: { loss, accuracy, precision, recall, f1Score },
  };
}
