/**
 * Fuel Emissions Module - Service class and re-exports
 *
 * MODULARIZED: 638 lines → 7 focused modules (~30-190 lines each)
 */

export type { FuelEmissionsResult, TelemetryPeriod, FuelEmissionsSummary } from './types';
export { EMISSION_FACTORS, SFOC_CURVE, type FuelType } from './constants';
export { getSFOC, calculateFuelConsumption, calculateEmissions, getCIIRating } from './calculations';
export { aggregateTelemetryForPeriod } from './telemetry-aggregation';
export { createFuelEmissionsEntry, createFuelEmissionsEntryFromFMCC } from './entry-creators';
export { tryGetFMCCData } from './fmcc-integration';
export { autoFillFuelEmissions, getFuelEmissionsSummary } from './orchestrator';

import type { FuelEmissionsResult, TelemetryPeriod, FuelEmissionsSummary } from './types';
import type { FuelType } from './constants';
import type { FMCCCumulativeCounters } from '../../integrations/aquametro-fmcc';
import {
  getSFOC,
  calculateFuelConsumption,
  calculateEmissions,
  getCIIRating,
} from './calculations';
import { aggregateTelemetryForPeriod } from './telemetry-aggregation';
import { createFuelEmissionsEntry, createFuelEmissionsEntryFromFMCC } from './entry-creators';
import { tryGetFMCCData } from './fmcc-integration';
import { autoFillFuelEmissions, getFuelEmissionsSummary } from './orchestrator';

export class FuelEmissionsAutoFillService {
  private getSFOC = getSFOC;
  private calculateFuelConsumption = calculateFuelConsumption;
  private calculateEmissions = calculateEmissions;
  private getCIIRating = getCIIRating;

  async aggregateTelemetryForPeriod(
    orgId: string,
    vesselId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<TelemetryPeriod | null> {
    return aggregateTelemetryForPeriod(orgId, vesselId, periodStart, periodEnd);
  }

  async createFuelEmissionsEntry(
    orgId: string,
    vesselId: string,
    period: TelemetryPeriod,
    periodType: 'hourly' | 'daily' | 'voyage' = 'hourly',
    fuelType: FuelType = 'VLSFO'
  ): Promise<string | null> {
    return createFuelEmissionsEntry(orgId, vesselId, period, periodType, fuelType);
  }

  async createFuelEmissionsEntryFromFMCC(
    orgId: string,
    vesselId: string,
    fmccData: FMCCCumulativeCounters,
    periodType: 'hourly' | 'daily' | 'voyage' = 'hourly',
    fuelType: FuelType = 'VLSFO'
  ): Promise<string | null> {
    return createFuelEmissionsEntryFromFMCC(orgId, vesselId, fmccData, periodType, fuelType);
  }

  async tryGetFMCCData(
    vesselId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<FMCCCumulativeCounters | null> {
    return tryGetFMCCData(vesselId, periodStart, periodEnd);
  }

  async autoFillFuelEmissions(
    orgId: string,
    vesselId: string,
    startDate: Date,
    endDate: Date,
    periodType: 'hourly' | 'daily' = 'hourly'
  ): Promise<FuelEmissionsResult> {
    return autoFillFuelEmissions(orgId, vesselId, startDate, endDate, periodType);
  }

  async getFuelEmissionsSummary(
    orgId: string,
    vesselId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FuelEmissionsSummary> {
    return getFuelEmissionsSummary(orgId, vesselId, startDate, endDate);
  }
}

export const fuelEmissionsAutoFillService = new FuelEmissionsAutoFillService();
