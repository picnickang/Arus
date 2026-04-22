/**
 * LSTM Model - Types
 * Type definitions for LSTM training and prediction
 */

import type * as tf from "@tensorflow/tfjs-node";

export interface LSTMConfig {
  sequenceLength: number;
  featureCount: number;
  lstmUnits: number;
  dropoutRate: number;
  learningRate: number;
  epochs: number;
  batchSize: number;
  useEarlyStopping?: boolean;
  earlyStoppingPatience?: number;
  useClassWeights?: boolean;
  verbose?: boolean;
}

export interface LSTMPrediction {
  failureProbability: number;
  confidence: number;
  daysToFailure: number | null;
  method: "ml_lstm";
}

export interface TrainedLSTMModel {
  model: tf.LayersModel;
  config: LSTMConfig;
  featureNames: string[];
  normalizationParams: { mean: number[]; std: number[] };
  trainingMetrics: {
    loss: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
}
