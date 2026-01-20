/**
 * ML Training Data Collection and Preparation - Backward Compatibility Shim
 * 
 * This file re-exports from the modularized ml-training-data/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/ml-training-data/index.ts for the modular implementation
 */

export type {
  FailureEvent,
  TimeSeriesFeatures,
  TrainingDataset,
  ClassificationFeatures,
} from "./ml-training-data/index.js";

export {
  extractFailureEvents,
  collectPreFailureTelemetry,
  prepareTimeSeriesDataset,
  prepareClassificationDataset,
  splitDataset,
  chronoSplit,
  stratifiedSplit,
} from "./ml-training-data/index.js";
