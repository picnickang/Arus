/**
 * Early stopping helper for LSTM training — minimal stub.
 *
 * The original implementation was removed when LSTM training was disabled
 * in this environment; the signature is preserved so server/ml-lstm-model
 * still type-checks.
 */

import type * as tf from "@tensorflow/tfjs-node";

export interface EarlyStoppingConfig {
  patience: number;
  minDelta?: number;
  monitor?: "val_loss" | "val_accuracy" | "loss" | "accuracy";
  mode?: "min" | "max";
}

export interface EarlyStoppingResult {
  stoppedEarly: boolean;
  bestEpoch: number;
  history: Record<string, number[]>;
}

export async function trainWithEarlyStopping(
  _model: tf.Sequential,
  _xTrain: tf.Tensor,
  _yTrain: tf.Tensor,
  _xVal: tf.Tensor,
  _yVal: tf.Tensor,
  _options: {
    epochs?: number;
    batchSize?: number;
    earlyStoppingConfig?: EarlyStoppingConfig;
    [k: string]: unknown;
  }
): Promise<EarlyStoppingResult> {
  return { stoppedEarly: false, bestEpoch: 0, history: {} };
}
