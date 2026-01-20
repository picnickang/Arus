/**
 * OpenAI Integration Pod - Marine Predictive Maintenance AI
 *
 * Provides AI-powered analysis capabilities for maritime equipment:
 * - Equipment health analysis
 * - Fleet-wide maintenance recommendations
 * - Pump condition monitoring
 * - Risk matrix generation
 *
 * Integration note: Using OpenAI blueprint for marine predictive maintenance
 * - the newest OpenAI model is "gpt-5" which was released August 7, 2025
 * - Using response_format: { type: "json_object" } for structured outputs
 */

// Re-export all types
export * from "./types";

// Re-export client utilities for advanced usage
export {
  getOpenAIApiKey,
  createOpenAIClient,
  calculateDynamicTokens,
  analyzeErrorType,
  retryWithBackoff,
  callWithModelFallback,
} from "./client";

// Re-export analysis functions
export { analyzeEquipmentHealth } from "./equipment-analysis";
export { analyzeFleetHealth } from "./fleet-analysis";
export {
  generateMaintenanceRecommendations,
  generatePumpAnalysisExplanation,
} from "./maintenance-insights";

// Re-export helper modules for advanced usage
export { buildEquipmentDossiers, type EquipmentDossier } from "./dossier-builder";
export { parseRecommendations, type ParsedRecommendations } from "./risk-parser";
export { calculateFleetBenchmarks, type FleetBenchmarkResult } from "./fleet-benchmarks";
