/**
 * LSTM Model - Architecture
 * Model creation and compilation
 */

import * as tf from "@tensorflow/tfjs-node";
import type { LSTMConfig } from "./types.js";

export function createLSTMModel(config: LSTMConfig): tf.LayersModel {
  const model = tf.sequential();

  model.add(tf.layers.inputLayer({ inputShape: [config.sequenceLength, config.featureCount] }));

  model.add(tf.layers.lstm({ units: config.lstmUnits, returnSequences: true, kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }));
  model.add(tf.layers.dropout({ rate: config.dropoutRate }));

  model.add(tf.layers.lstm({ units: Math.floor(config.lstmUnits / 2), returnSequences: false, kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }));
  model.add(tf.layers.dropout({ rate: config.dropoutRate }));

  model.add(tf.layers.dense({ units: 32, activation: "relu", kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }));
  model.add(tf.layers.dropout({ rate: config.dropoutRate / 2 }));

  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

  model.compile({ optimizer: tf.train.adam(config.learningRate), loss: "binaryCrossentropy", metrics: ["accuracy"] });

  return model;
}
