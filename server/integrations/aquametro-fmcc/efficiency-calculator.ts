/**
 * Aquametro FMCC - Efficiency Calculator
 * 
 * Engine fuel efficiency calculations.
 */

import type {
  FMCCCumulativeCounters,
  FMCCEngineEfficiency,
  FMCCServiceResult,
} from "./types.js";

/**
 * Calculate engine efficiency from cumulative fuel counters
 * 
 * @param counters Cumulative fuel counter data
 * @param countersSource Source of counters data (mock/fmcc)
 * @param vesselId Vessel identifier
 * @param from Period start
 * @param to Period end
 * @param enginePowerKw Optional engine power for SFOC calculation
 * @returns Efficiency calculation result
 */
export function calculateEngineEfficiency(
  counters: FMCCCumulativeCounters,
  countersSource: string,
  vesselId: string,
  from: Date,
  to: Date,
  enginePowerKw?: number
): FMCCServiceResult<FMCCEngineEfficiency> {
  const hoursInPeriod = (to.getTime() - from.getTime()) / (1000 * 60 * 60);
  const totalFuelKg = counters.totalFuelKg;
  let sfocGPerKwh = 0;
  let totalPowerKwh = 0;

  if (enginePowerKw && enginePowerKw > 0) {
    const nominalSfoc = 180;
    const maxFuelPerHour = (enginePowerKw * nominalSfoc) / 1000;
    const actualFuelPerHour = totalFuelKg / hoursInPeriod;
    const estimatedLoad = Math.min(100, (actualFuelPerHour / maxFuelPerHour) * 100);

    totalPowerKwh = (estimatedLoad / 100) * enginePowerKw * hoursInPeriod;
    sfocGPerKwh = totalPowerKwh > 0 ? (totalFuelKg * 1000) / totalPowerKwh : 0;
  }

  const efficiency: FMCCEngineEfficiency = {
    vesselId,
    periodStart: from,
    periodEnd: to,
    sfocGPerKwh,
    avgLoadPercent: 0,
    avgRpm: 0,
    runningHours: hoursInPeriod,
    totalPowerKwh,
    calculationMethod: "derived",
  };

  return {
    success: true,
    data: efficiency,
    source: countersSource,
    responseTimeMs: 0,
  };
}
