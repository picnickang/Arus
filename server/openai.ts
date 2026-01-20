/**
 * OpenAI Integration Pod - Marine Predictive Maintenance AI
 *
 * MODULARIZED: This file now re-exports from server/openai/ directory.
 * See server/openai/index.ts for the main implementation.
 *
 * Modules:
 * - types.ts: Type definitions (MaintenanceInsight, EquipmentAnalysis, FleetAnalysis, etc.)
 * - client.ts: API key, client creation, retry logic with model fallback
 * - equipment-analysis.ts: analyzeEquipmentHealth function
 * - fleet-analysis.ts: analyzeFleetHealth function
 * - maintenance-insights.ts: generateMaintenanceRecommendations and generatePumpAnalysisExplanation
 */

export * from "./openai/index";
