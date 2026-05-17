/**
 * Fuel Emissions Orchestrator - Main autofill and summary methods
 */

import { db } from "../../db";
import { fuelEmissionsLog } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { FuelEmissionsResult, FuelEmissionsSummary } from "./types";
import { getCIIRating } from "./calculations";
import { aggregateTelemetryForPeriod } from "./telemetry-aggregation";
import { createFuelEmissionsEntry, createFuelEmissionsEntryFromFMCC } from "./entry-creators";
import { tryGetFMCCData } from "./fmcc-integration";

export async function autoFillFuelEmissions(
  orgId: string,
  vesselId: string,
  startDate: Date,
  endDate: Date,
  periodType: "hourly" | "daily" = "hourly"
): Promise<FuelEmissionsResult> {
  const result: FuelEmissionsResult = {
    success: true,
    recordsCreated: 0,
    recordsUpdated: 0,
    errors: [],
    dataSource: "telemetry",
    fmccRecords: 0,
    telemetryRecords: 0,
  };

  try {
    const periodMs = periodType === "hourly" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    let currentStart = new Date(startDate);

    while (currentStart < endDate) {
      const currentEnd = new Date(currentStart.getTime() + periodMs);
      const effectiveEnd = currentEnd > endDate ? endDate : currentEnd;

      const fmccData = await tryGetFMCCData(vesselId, currentStart, effectiveEnd);

      if (fmccData) {
        const logId = await createFuelEmissionsEntryFromFMCC(orgId, vesselId, fmccData, periodType);

        if (logId) {
          result.recordsCreated++;
          result.fmccRecords = (result.fmccRecords ?? 0) + 1;
        }
      } else {
        const period = await aggregateTelemetryForPeriod(
          orgId,
          vesselId,
          currentStart,
          effectiveEnd
        );

        if (period && (period.dataPoints ?? 0) > 0) {
          const logId = await createFuelEmissionsEntry(orgId, vesselId, period, periodType);

          if (logId) {
            result.recordsCreated++;
            result.telemetryRecords = (result.telemetryRecords ?? 0) + 1;
          }
        }
      }

      currentStart = currentEnd;
    }

    if (result.fmccRecords && result.telemetryRecords) {
      result.dataSource = "mixed";
    } else if (result.fmccRecords) {
      result.dataSource = "fmcc";
    } else {
      result.dataSource = "telemetry";
    }
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

export async function getFuelEmissionsSummary(
  orgId: string,
  vesselId: string,
  startDate: Date,
  endDate: Date
): Promise<FuelEmissionsSummary> {
  const summary = await db
    .select({
      totalFuelMt: sql<number>`sum(${(fuelEmissionsLog as any).totalFuelMt})`,
      totalCo2Mt: sql<number>`sum(${fuelEmissionsLog.co2EmissionsMt})`,
      avgCii: sql<number>`avg(${(fuelEmissionsLog as any).cii})`,
      distanceNm: sql<number>`sum(${fuelEmissionsLog.distanceNm})`,
      runningHours: sql<number>`sum(${(fuelEmissionsLog as any).meRunningHours})`,
    })
    .from(fuelEmissionsLog)
    .where(
      and(
        eq(fuelEmissionsLog.orgId, orgId),
        eq(fuelEmissionsLog.vesselId, vesselId),
        gte(fuelEmissionsLog.periodStart, startDate),
        lte(fuelEmissionsLog.periodEnd, endDate)
      )
    );

  const data = summary[0];
  const avgCii = data?.avgCii ?? 0;

  return {
    totalFuelMt: data?.totalFuelMt ?? 0,
    totalCo2Mt: data?.totalCo2Mt ?? 0,
    avgCii,
    ciiRating: getCIIRating(avgCii / 1000),
    distanceNm: data?.distanceNm ?? 0,
    runningHours: data?.runningHours ?? 0,
  };
}
