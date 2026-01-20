/**
 * ML Ensemble Orchestrator - Backward Compatibility Shim
 * 
 * This file re-exports all functions from the modularized ml-ensemble/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/ml-ensemble/index.ts for the modular implementation
 */

export {
  type EnsemblePrediction,
  type EnsembleConfig,
  type ModelWeights,
  STATIC_WEIGHTS,
  getAdaptiveWeights,
  getModelWeights,
  calculateStats,
  calculateAgreement,
  generateRecommendations,
  convertToClassificationFeatures,
  ensemblePredict,
  batchEnsemblePredict,
} from "./ml-ensemble/index.js";
