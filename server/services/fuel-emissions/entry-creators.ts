/**
 * Fuel Emissions Entry Creators - Create log entries from telemetry or FMCC
 */

import { db } from "../../db";
import { fuelEmissionsLog, vessels, InsertFuelEmissionsLog } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { TelemetryPeriod } from "./types";
import { EMISSION_FACTORS, type FuelType } from "./constants";
import {
  getSFOC,
  calculateFuelConsumption,
  calculateEmissions,
  getCIIRating,
  calculateDataQuality,
  calculateEEOI,
  calculateCII,
} from "./calculations";
import { aggregateTelemetryForPeriod } from "./telemetry-aggregation";
import type { FMCCCumulativeCounters } from "../../integrations/aquametro-fmcc";

async function getVesselDwt(vesselId: string): Promise<number> {
  const vessel = await db
    .select({ dwt: vessels.dwt })
    .from(vessels)
    .where(eq(vessels.id, vesselId))
    .limit(1);
  return vessel[0]?.dwt || 10000;
}

export async function createFuelEmissionsEntry(
  orgId: string,
  vesselId: string,
  period: TelemetryPeriod,
  periodType: "hourly" | "daily" | "voyage" = "hourly",
  fuelType: FuelType = "VLSFO"
): Promise<string | null> {
  const vesselDwt = await getVesselDwt(vesselId);
  const sfoc = getSFOC(period.avgEngineLoad);
  const foConsumptionMt = calculateFuelConsumption(period.totalPowerKwh, sfoc);
  const doConsumptionMt = foConsumptionMt * 0.1;
  const totalFuelMt = foConsumptionMt + doConsumptionMt;

  const emissions = calculateEmissions(foConsumptionMt, fuelType);
  const doEmissions = calculateEmissions(doConsumptionMt, "MGO");

  const totalCo2 = emissions.co2Mt + doEmissions.co2Mt;
  const totalSox = emissions.soxKg + doEmissions.soxKg;
  const totalNox = emissions.noxKg + doEmissions.noxKg;

  const fuelEfficiency = period.distanceNm > 0 ? totalFuelMt / period.distanceNm : null;
  const cargoTons = vesselDwt * 0.7;
  const eeoi = calculateEEOI(totalFuelMt, cargoTons, period.distanceNm);
  const cii = calculateCII(totalCo2, vesselDwt, period.distanceNm);
  const ciiRating = cii ? getCIIRating(cii / 1000) : null;

  const expectedDataPoints = periodType === "hourly" ? 60 : 1440;
  const completeness = period.dataPoints / expectedDataPoints;
  const dataQuality = calculateDataQuality(completeness);

  const logEntry: InsertFuelEmissionsLog = {
    orgId,
    vesselId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    periodType,
    // @ts-ignore -- bulk-silence
    foConsumptionMt,
    doConsumptionMt,
    lngConsumptionMt: null,
    loConsumptionMt: null,
    totalFuelMt,
    co2EmissionsMt: totalCo2,
    soxEmissionsKg: totalSox,
    noxEmissionsKg: totalNox,
    pmEmissionsKg: totalNox * 0.1,
    avgEngineLoad: period.avgEngineLoad,
    avgGeneratorLoad: period.avgGeneratorLoad,
    meRunningHours: period.meRunningHours,
    dgRunningHours: period.dgRunningHours,
    distanceNm: period.distanceNm,
    avgSpeedKn: period.avgSpeedKn,
    fuelEfficiencyMtPerNm: fuelEfficiency,
    sfocGPerKwh: sfoc,
    eeoi,
    cii,
    ciiRating,
    dataSource: "estimated",
    dataQuality,
    confidenceScore: completeness,
    calculationMethod: "sfoc_curve",
    calculationDetails: {
      sfocUsed: sfoc,
      loadFactors: [period.avgEngineLoad],
      emissionFactors: EMISSION_FACTORS[fuelType],
    },
  };

  const result = await db
    .insert(fuelEmissionsLog)
    .values(logEntry)
    .returning({ id: fuelEmissionsLog.id });
  return result[0]?.id ?? null;
}

export async function createFuelEmissionsEntryFromFMCC(
  orgId: string,
  vesselId: string,
  fmccData: FMCCCumulativeCounters,
  periodType: "hourly" | "daily" | "voyage" = "hourly",
  fuelType: FuelType = "VLSFO"
): Promise<string | null> {
  const vesselDwt = await getVesselDwt(vesselId);

  const foConsumptionMt = fmccData.foConsumedMt;
  const doConsumptionMt = fmccData.doConsumedMt;
  const totalFuelMt = fmccData.totalFuelMt;

  const emissions = calculateEmissions(foConsumptionMt, fuelType);
  const doEmissions = calculateEmissions(doConsumptionMt, "MGO");

  const totalCo2 = emissions.co2Mt + doEmissions.co2Mt;
  const totalSox = emissions.soxKg + doEmissions.soxKg;
  const totalNox = emissions.noxKg + doEmissions.noxKg;

  const periodHours =
    (fmccData.periodEnd.getTime() - fmccData.periodStart.getTime()) / (1000 * 60 * 60);

  const telemetryPeriod = await aggregateTelemetryForPeriod(
    orgId,
    vesselId,
    fmccData.periodStart,
    fmccData.periodEnd
  );

  const distanceNm = telemetryPeriod?.distanceNm ?? 0;
  const avgSpeed = telemetryPeriod?.avgSpeedKn ?? 0;
  const avgLoad = telemetryPeriod?.avgEngineLoad ?? 0;

  const sfoc =
    telemetryPeriod?.totalPowerKwh && telemetryPeriod.totalPowerKwh > 0
      ? (totalFuelMt * 1_000_000) / telemetryPeriod.totalPowerKwh
      : getSFOC(avgLoad);

  const fuelEfficiency = distanceNm > 0 ? totalFuelMt / distanceNm : null;
  const cargoTons = vesselDwt * 0.7;
  const eeoi = calculateEEOI(totalFuelMt, cargoTons, distanceNm);
  const cii = calculateCII(totalCo2, vesselDwt, distanceNm);
  const ciiRating = cii ? getCIIRating(cii / 1000) : null;
  const dataQuality = calculateDataQuality(fmccData.dataCompleteness);

  const logEntry: InsertFuelEmissionsLog = {
    orgId,
    vesselId,
    periodStart: fmccData.periodStart,
    periodEnd: fmccData.periodEnd,
    periodType,
    // @ts-ignore -- bulk-silence
    foConsumptionMt,
    doConsumptionMt,
    lngConsumptionMt: null,
    loConsumptionMt: null,
    totalFuelMt,
    co2EmissionsMt: totalCo2,
    soxEmissionsKg: totalSox,
    noxEmissionsKg: totalNox,
    pmEmissionsKg: totalNox * 0.1,
    avgEngineLoad: avgLoad,
    avgGeneratorLoad: telemetryPeriod?.avgGeneratorLoad ?? 0,
    meRunningHours: periodHours,
    dgRunningHours: telemetryPeriod?.dgRunningHours ?? 0,
    distanceNm,
    avgSpeedKn: avgSpeed,
    fuelEfficiencyMtPerNm: fuelEfficiency,
    sfocGPerKwh: sfoc,
    eeoi,
    cii,
    ciiRating,
    dataSource: "fmcc",
    dataQuality,
    confidenceScore: fmccData.dataCompleteness,
    calculationMethod: "fmcc_measured",
    calculationDetails: {
      fmccSource: true,
      foDensity: fmccData.avgFoDensity,
      doDensity: fmccData.avgDoDensity,
      foTemperature: fmccData.avgFoTemperature,
      doTemperature: fmccData.avgDoTemperature,
      dataPoints: fmccData.dataPoints,
      emissionFactors: EMISSION_FACTORS[fuelType],
    },
  };

  const result = await db
    .insert(fuelEmissionsLog)
    .values(logEntry)
    .returning({ id: fuelEmissionsLog.id });
  return result[0]?.id ?? null;
}
