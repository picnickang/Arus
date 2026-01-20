/**
 * Fuel & Emissions Auto-Fill Service
 *
 * Calculates fuel consumption and emissions from:
 * 1. Flow meters (if available) - highest accuracy
 * 2. Engine load × SFOC curves - estimation method
 * 3. Running hours × typical consumption - fallback
 *
 * MODULARIZED: 638 lines → 7 focused modules (~30-190 lines each)
 */

export type { FuelEmissionsResult, TelemetryPeriod, FuelEmissionsSummary } from './fuel-emissions/types';
export { EMISSION_FACTORS, SFOC_CURVE, type FuelType } from './fuel-emissions/constants';
export { getSFOC, calculateFuelConsumption, calculateEmissions, getCIIRating } from './fuel-emissions/calculations';
export { aggregateTelemetryForPeriod } from './fuel-emissions/telemetry-aggregation';
export { createFuelEmissionsEntry, createFuelEmissionsEntryFromFMCC } from './fuel-emissions/entry-creators';
export { tryGetFMCCData } from './fuel-emissions/fmcc-integration';
export { autoFillFuelEmissions, getFuelEmissionsSummary } from './fuel-emissions/orchestrator';
export { FuelEmissionsAutoFillService, fuelEmissionsAutoFillService } from './fuel-emissions';
