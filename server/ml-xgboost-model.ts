/**
 * XGBoost Model - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type {
  XGBoostConfig,
  XGBoostPrediction,
  TreeNode,
  GradientTree,
  TrainedXGBoostModel,
} from "./ml-xgboost-model/index.js";

export {
  calculateGradients,
  findBestSplitXGBoost,
  buildGradientTree,
  predictTree,
  calculateFeatureImportances,
  trainXGBoostModel,
  predictWithXGBoost,
  saveXGBoostModel,
  loadXGBoostModel,
} from "./ml-xgboost-model/index.js";
