/**
 * ML Training Pipeline
 * Orchestrates model training, evaluation, and deployment
 *
 * MODULARIZED: 659 lines → 6 focused modules (~60-170 lines each)
 */

export type {
  TrainingJobConfig,
  LSTMTrainingConfig,
  RFTrainingConfig,
  XGBoostTrainingConfig,
  TrainingResult,
} from "./ml-training-pipeline/types";

export { trainLSTMForFailurePrediction } from "./ml-training-pipeline/lstm-trainer";

export { trainRFForHealthClassification } from "./ml-training-pipeline/rf-trainer";

export { trainXGBoostForHealthClassification } from "./ml-training-pipeline/xgboost-trainer";

export { retrainAllModels, getBestModel } from "./ml-training-pipeline/orchestrator";
