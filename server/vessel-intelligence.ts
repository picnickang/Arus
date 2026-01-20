/**
 * Vessel Intelligence - Backward Compatibility Shim
 * 
 * This file re-exports from the modularized vessel-intelligence/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/vessel-intelligence/index.ts for the modular implementation
 */

export type {
  VesselPattern,
  VesselLearnings,
  HistoricalContext,
} from "./vessel-intelligence/index.js";

export {
  VesselIntelligenceService,
  vesselIntelligence,
} from "./vessel-intelligence/index.js";
