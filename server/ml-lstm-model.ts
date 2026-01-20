/**
 * LSTM Model - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type { LSTMConfig, LSTMPrediction, TrainedLSTMModel } from "./ml-lstm-model/index.js";

export {
  normalizeFeatures,
  prepareSequences,
  createLSTMModel,
  trainLSTMModel,
  predictWithLSTM,
  saveLSTMModel,
  loadLSTMModel,
} from "./ml-lstm-model/index.js";
