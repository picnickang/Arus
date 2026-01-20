/**
 * Weibull RUL Analysis - Backward Compatibility Shim
 * 
 * This file re-exports all functions from the modularized weibull-rul/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/weibull-rul/index.ts for the modular implementation
 */

export {
  type WeibullParameters,
  type RULPrediction,
  type EquipmentLifeData,
  estimateWeibullParameters,
  estimateInitialShape,
  calculateFisherInformation,
  calculateWeibullGoodnessOfFit,
  gammaFunction,
  calculateReliability,
  predictRUL,
  calculateConfidenceInterval,
  calculateFailureProbability,
  calculateRULDerivativeShape,
  calculateRULDerivativeScale,
  generateMaintenanceRecommendation,
  getEquipmentLifeData,
  extractDegradationFromWorkOrder,
  groupTelemetryByDay,
  calculateDegradationMetric,
  getCurrentEquipmentAge,
  WeibullRULAnalyzer,
} from "./weibull-rul/index.js";
