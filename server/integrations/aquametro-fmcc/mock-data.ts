/**
 * Aquametro FMCC - Mock Data Generator
 * For testing without hardware
 */

import type { FMCCInstantFlow, FMCCCumulativeCounters } from "./types.js";
import { cryptoRandom } from "@shared/crypto-random";

export function generateMockInstantFlow(vesselId: string): FMCCInstantFlow {
  const baseFlow = 500 + cryptoRandom() * 200;
  const returnFlow = baseFlow * 0.15;

  return {
    timestamp: new Date(),
    vesselId,
    foFlowKgPerH: baseFlow,
    doFlowKgPerH: baseFlow * 0.1,
    foReturnFlowKgPerH: returnFlow,
    doReturnFlowKgPerH: returnFlow * 0.1,
    foNetFlowKgPerH: baseFlow - returnFlow,
    doNetFlowKgPerH: baseFlow * 0.1 - returnFlow * 0.1,
    foDensity: 980 + cryptoRandom() * 10,
    doDensity: 840 + cryptoRandom() * 5,
    foTemperature: 45 + cryptoRandom() * 5,
    doTemperature: 25 + cryptoRandom() * 5,
    meterStatus: "online",
  };
}

export function generateMockCumulativeCounters(
  vesselId: string,
  periodStart: Date,
  periodEnd: Date
): FMCCCumulativeCounters {
  const hoursInPeriod = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60);
  const avgFlowKgPerH = 550;
  const foConsumedKg = avgFlowKgPerH * hoursInPeriod * 0.85;
  const doConsumedKg = avgFlowKgPerH * hoursInPeriod * 0.15;

  return {
    vesselId,
    periodStart,
    periodEnd,
    foConsumedKg,
    doConsumedKg,
    foConsumedMt: foConsumedKg / 1000,
    doConsumedMt: doConsumedKg / 1000,
    totalFuelKg: foConsumedKg + doConsumedKg,
    totalFuelMt: (foConsumedKg + doConsumedKg) / 1000,
    avgFoDensity: 985,
    avgDoDensity: 842,
    avgFoTemperature: 47,
    avgDoTemperature: 27,
    dataPoints: Math.floor(hoursInPeriod * 60),
    dataCompleteness: 0.95 + cryptoRandom() * 0.05,
  };
}
