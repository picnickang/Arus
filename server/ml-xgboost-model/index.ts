/**
 * XGBoost Model - Main Entry Point
 * Re-exports all types and functions
 */

export type {
  XGBoostConfig,
  XGBoostPrediction,
  TreeNode,
  GradientTree,
  TrainedXGBoostModel,
} from "./types.js";
export { calculateGradients } from "./gradient.js";
export {
  findBestSplitXGBoost,
  buildGradientTree,
  predictTree,
  calculateFeatureImportances,
} from "./tree.js";
export { trainXGBoostModel } from "./train.js";
export { predictWithXGBoost } from "./predict.js";
export { saveXGBoostModel, loadXGBoostModel } from "./io.js";
