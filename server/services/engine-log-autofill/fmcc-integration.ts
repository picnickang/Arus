/**
 * Engine Log Auto-Fill - FMCC Integration
 * Aquametro FMCC fuel data integration
 */

import { storage } from "../../storage.js";
import { getFMCCService } from "../../integrations/aquametro-fmcc.js";
import { log } from "./logging.js";
import type { FMCCFuelResult } from "./types.js";

export async function fetchFMCCFuelForDay(
  vesselId: string,
  logDate: string,
  orgId: string
): Promise<FMCCFuelResult> {
  try {
    const fmccService = getFMCCService();

    if (!fmccService.isEnabled() || !fmccService.isReady()) {
      log('info', 'FMCC not available, skipping fuel fetch', {
        vesselId,
        logDate,
        orgId,
        operation: 'fetchFMCCFuel',
      });
      return { success: false, source: 'none', error: 'FMCC integration not enabled or not ready' };
    }

    const dateParts = logDate.split('-');
    const year = Number.parseInt(dateParts[0], 10);
    const month = Number.parseInt(dateParts[1], 10) - 1;
    const day = Number.parseInt(dateParts[2], 10);

    const periodStart = new Date(year, month, day, 0, 0, 0, 0);
    const periodEnd = new Date(year, month, day, 23, 59, 59, 999);

    log('info', 'Fetching FMCC fuel data for day', {
      vesselId,
      logDate,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      operation: 'fetchFMCCFuel',
      orgId,
    });

    const result = await fmccService.getCumulativeFuelCounters(vesselId, periodStart, periodEnd);

    if (!result.success || !result.data) {
      log('warn', 'FMCC fuel fetch failed', {
        vesselId,
        logDate,
        error: result.error,
        operation: 'fetchFMCCFuel',
        orgId,
      });
      return {
        success: false,
        source: 'none',
        error: result.error || 'Failed to retrieve FMCC data',
      };
    }

    const fmccData = result.data;

    log('info', 'FMCC fuel data retrieved successfully', {
      vesselId,
      logDate,
      source: result.source,
      foConsumedMt: fmccData.foConsumedMt,
      doConsumedMt: fmccData.doConsumedMt,
      totalFuelMt: fmccData.totalFuelMt,
      dataPoints: fmccData.dataPoints,
      operation: 'fetchFMCCFuel',
      orgId,
    });

    return {
      success: true,
      source: 'fmcc',
      fuelMeConsumption: fmccData.foConsumedMt,
      fuelDgConsumption: fmccData.doConsumedMt,
      fuelTotalConsumption: fmccData.totalFuelMt,
      foDensity: fmccData.avgFoDensity,
      doTemperature: fmccData.avgDoTemperature,
      dataPoints: fmccData.dataPoints,
      dataCompleteness: fmccData.dataCompleteness,
    };
  } catch (error) {
    log('error', 'Exception in FMCC fuel fetch', {
      vesselId,
      logDate,
      error: error instanceof Error ? error.message : String(error),
      operation: 'fetchFMCCFuel',
      orgId,
    });
    return {
      success: false,
      source: 'none',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateDailyLogWithFMCCFuel(
  dailyLogId: string,
  fmccData: FMCCFuelResult,
  orgId: string
): Promise<boolean> {
  if (!fmccData.success || fmccData.source !== 'fmcc') {
    return false;
  }

  try {
    await storage.updateEngineLogDaily(
      dailyLogId,
      {
        fuelMeConsumption: fmccData.fuelMeConsumption,
        fuelDgConsumption: fmccData.fuelDgConsumption,
        fuelTotalConsumption: fmccData.fuelTotalConsumption,
      },
      orgId
    );

    log('info', 'Daily log updated with FMCC fuel data', {
      dailyLogId,
      fuelMeConsumption: fmccData.fuelMeConsumption,
      fuelDgConsumption: fmccData.fuelDgConsumption,
      fuelTotalConsumption: fmccData.fuelTotalConsumption,
      operation: 'updateDailyLogWithFMCCFuel',
      orgId,
      vesselId: '',
      logDate: '',
    });

    return true;
  } catch (error) {
    log('error', 'Failed to update daily log with FMCC data', {
      dailyLogId,
      error: error instanceof Error ? error.message : String(error),
      operation: 'updateDailyLogWithFMCCFuel',
      orgId,
      vesselId: '',
      logDate: '',
    });
    return false;
  }
}
