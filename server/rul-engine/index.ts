/**
 * RUL Engine - Module Aggregator
 * 
 * Re-exports all RUL engine modules for convenient imports.
 * 
 * Module structure (1,093 lines → 9 modules):
 * - types.ts (~80 lines): Core types and interfaces
 * - constants.ts (~30 lines): Feature flags and configuration
 * - data-status.ts (~75 lines): Data status determination
 * - risk-assessment.ts (~70 lines): Risk level and failure probability
 * - recommendations.ts (~75 lines): Maintenance recommendations
 * - degradation-analysis.ts (~140 lines): Degradation pattern analysis
 * - health-calculation.ts (~35 lines): Health index calculation
 * - data-fetchers.ts (~240 lines): Database queries and data fetching
 * - rul-engine.ts (~280 lines): Main RulEngine class
 */

export * from "./types.js";
export * from "./constants.js";
export { determineDataStatus } from "./data-status.js";
export { determineRiskLevel, estimateFailureProbability } from "./risk-assessment.js";
export { generateRecommendations } from "./recommendations.js";
export { analyzeDegradationPattern, calculateComponentHealth } from "./degradation-analysis.js";
export { calculateHealthIndex } from "./health-calculation.js";
export {
  fetchEnhancementData,
  fetchBaseRateWithCache,
  detectOperatingMode,
  calculateDataQuality,
  getLastRepair,
  getBaseFailureRate,
} from "./data-fetchers.js";
export { RulEngine } from "./rul-engine.js";
