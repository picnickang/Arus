/**
 * STCW Dashboard - Fleet compliance monitoring and fatigue risk analysis
 *
 * MODULARIZED: 615 lines → 6 focused modules (~45-160 lines each)
 */

export type {
  VesselComplianceSummary,
  FleetSTCWSummary,
  VesselDetailedSummary,
  TrendDataPoint,
  STCWTrends,
  CrewRestData,
} from "./stcw-dashboard/types";

export { getCacheKey, getFromCache, setCache, invalidateSTCWCache } from "./stcw-dashboard/cache";
export { getDateRange, getCrewRestDataForVessel } from "./stcw-dashboard/data-fetcher";
export { getFleetSTCWSummary } from "./stcw-dashboard/fleet-summary";
export { getVesselSTCWSummary } from "./stcw-dashboard/vessel-summary";
export { getSTCWComplianceTrends } from "./stcw-dashboard/trends";
