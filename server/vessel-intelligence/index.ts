/**
 * Vessel Intelligence Module
 * 
 * Re-exports public API for vessel intelligence functionality.
 * Internal helpers are not exported to preserve encapsulation.
 */

export type { VesselPattern, VesselLearnings, HistoricalContext } from "./types.js";

export { VesselIntelligenceService, vesselIntelligence } from "./service.js";
