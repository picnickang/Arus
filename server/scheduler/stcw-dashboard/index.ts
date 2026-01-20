/**
 * STCW Dashboard Module - Re-exports
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
} from './types';

export { getCacheKey, getFromCache, setCache, invalidateSTCWCache } from './cache';
export { getDateRange, getCrewRestDataForVessel } from './data-fetcher';
export { getFleetSTCWSummary } from './fleet-summary';
export { getVesselSTCWSummary } from './vessel-summary';
export { getSTCWComplianceTrends } from './trends';
