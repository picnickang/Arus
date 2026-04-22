/**
 * ARUS Insights Engine - Backward Compatibility Shim
 *
 * This file re-exports all functions from the modularized insights-engine/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 *
 * @see server/insights-engine/index.ts for the modular implementation
 */

export {
  type FleetKPI,
  type InsightBundle,
  type TechnicianInsightView,
  type TriggerInfo,
  type VesselInsightGroup,
  computeInsights,
  persistSnapshot,
  getLatestSnapshot,
  generateDailySnapshot,
  llmOverview,
  generateFallbackOverview,
  generateTechnicianInsight,
  generateFleetTechnicianInsights,
} from "./insights-engine/index.js";
