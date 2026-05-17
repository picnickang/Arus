/**
 * Engine Log Auto-Fill - Main Engine Auto-Fill
 * Populate engine log hourly entries from telemetry
 */

import { dbEquipmentStorage, engineLogStorage } from "../../repositories.js";
import { log } from "./logging.js";
import { DEFAULT_TELEMETRY_MAPPING } from "./mappings.js";
import { ENGINE_ANOMALY_THRESHOLDS, checkAnomaly } from "./thresholds.js";
import { batchFetchTelemetry, aggregateTelemetryByHour } from "./telemetry-fetcher.js";
import { fetchFMCCFuelForDay, updateDailyLogWithFMCCFuel } from "./fmcc-integration.js";
import type {
  LogContext,
  AutoFillOptions,
  AutoFillResult,
  AutoFillSummary,
  FMCCFuelResult,
  InsertEngineLogHourly,
  EngineLogDaily,
} from "./types.js";
import { AutoFillServiceError as AutoFillError } from "./types.js";

async function getOrCreateDailyLog(
  vesselId: string,
  logDate: string,
  orgId: string,
  ctx: LogContext
): Promise<EngineLogDaily | null> {
  let dailyLog = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
  if (dailyLog) {
    return dailyLog;
  }

  try {
    dailyLog = await engineLogStorage.createEngineLogDaily({
      orgId,
      vesselId,
      logDate,
      status: "open",
    });
    log("info", "Created new daily log", { ...ctx, dailyLogId: dailyLog.id });
    return dailyLog;
  } catch (error: unknown) {
    const errorCode =
      error instanceof Error && "code" in error ? (error as { code: string }).code : undefined;
    if (errorCode !== "23505") {
      throw error;
    }
    // @ts-ignore -- bulk-silence
    log("info", "Daily log already exists, fetching...", ctx);
    dailyLog = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
    if (!dailyLog) {
      throw new AutoFillError(
        "Failed to retrieve existing daily log after duplicate key error",
        "getOrCreateDailyLog",
        // @ts-ignore -- bulk-silence
        ctx,
        error
      );
    }
    return dailyLog;
  }
}

function createEmptySummary(vesselId: string, logDate: string): AutoFillSummary {
  return {
    vesselId,
    logDate,
    hoursProcessed: 0,
    totalFieldsPopulated: 0,
    dataSource: "telemetry",
    totalAnomalies: 0,
    results: [],
  };
}

function processHourlyAggregates(
  aggregates: Map<string, { avg: number; count: number }>,
  existing: any,
  overwriteManual: boolean,
  dailyLogId: string,
  hour: number,
  orgId: string
): {
  hourlyEntry: Partial<InsertEngineLogHourly>;
  fieldsPopulated: string[];
  fieldsSkipped: string[];
  anomalies: AutoFillResult["anomalies"];
} {
  const fieldsPopulated: string[] = [];
  const fieldsSkipped: string[] = [];
  const anomalies: AutoFillResult["anomalies"] = [];
  const hourlyEntry: Partial<InsertEngineLogHourly> = { orgId, dailyLogId, hour };

  for (const [sensorType, aggregate] of aggregates) {
    const targetField = DEFAULT_TELEMETRY_MAPPING[sensorType];
    if (!targetField) {
      continue;
    }

    if (existing && !overwriteManual) {
      const existingValue = (existing as Record<string, unknown>)[targetField];
      if (existingValue !== null && existingValue !== undefined) {
        fieldsSkipped.push(targetField);
        continue;
      }
    }

    const integerFields = ["meRpm", "meTurbochargerRpm", "hour"];
    const value = integerFields.includes(targetField) ? Math.round(aggregate.avg) : aggregate.avg;
    (hourlyEntry as Record<string, unknown>)[targetField] = value;
    fieldsPopulated.push(targetField);

    const anomalyCheck = checkAnomaly(targetField, aggregate.avg, ENGINE_ANOMALY_THRESHOLDS);
    if (anomalyCheck.isAnomaly) {
      anomalies.push({
        field: targetField,
        value: aggregate.avg,
        threshold: ENGINE_ANOMALY_THRESHOLDS[targetField],
        severity: anomalyCheck.severity!,
      });
    }
  }

  return { hourlyEntry, fieldsPopulated, fieldsSkipped, anomalies };
}

async function processHours(
  hoursToProcess: number[],
  allTelemetry: any[],
  existingByHour: Map<number, any>,
  dailyLog: EngineLogDaily,
  orgId: string,
  overwriteManual: boolean,
  dryRun: boolean
): Promise<AutoFillResult[]> {
  const results: AutoFillResult[] = [];

  for (const hour of hoursToProcess) {
    const aggregates = aggregateTelemetryByHour(allTelemetry, hour);
    if (aggregates.size === 0) {
      continue;
    }

    const existing = existingByHour.get(hour);
    const { hourlyEntry, fieldsPopulated, fieldsSkipped, anomalies } = processHourlyAggregates(
      aggregates,
      existing,
      overwriteManual,
      dailyLog.id,
      hour,
      orgId
    );

    if (fieldsPopulated.length === 0) {
      continue;
    }

    const avgReadingCount =
      Array.from(aggregates.values()).reduce((sum, a) => sum + a.count, 0) / aggregates.size;
    const confidence = Math.min(100, Math.round((avgReadingCount / 12) * 100));

    results.push({
      hour,
      fieldsPopulated,
      fieldsSkipped,
      anomalies,
      source: "telemetry",
      confidence,
    });

    if (!dryRun) {
      await engineLogStorage.upsertEngineLogHourly(hourlyEntry as InsertEngineLogHourly);
    }
  }

  return results;
}

async function handleFMCCData(
  dailyLog: EngineLogDaily,
  vesselId: string,
  logDate: string,
  orgId: string,
  dryRun: boolean,
  results: AutoFillResult[]
): Promise<{
  fmccFuelData: FMCCFuelResult | undefined;
  dataSource: "telemetry" | "fmcc" | "mixed";
}> {
  let fmccFuelData: FMCCFuelResult | undefined;
  let dataSource: "telemetry" | "fmcc" | "mixed" = "telemetry";

  if (dryRun) {
    return { fmccFuelData, dataSource };
  }

  fmccFuelData = await fetchFMCCFuelForDay(vesselId, logDate, orgId);
  if (fmccFuelData.success && fmccFuelData.source === "fmcc") {
    const fmccUpdated = await updateDailyLogWithFMCCFuel(dailyLog.id, fmccFuelData, orgId);
    if (fmccUpdated) {
      dataSource = results.length > 0 ? "mixed" : "fmcc";
    }
  }

  return { fmccFuelData, dataSource };
}

export async function autoFillFromTelemetry(
  vesselId: string,
  orgId: string,
  logDate: string,
  options: AutoFillOptions = {}
): Promise<AutoFillSummary> {
  const { hours, overwriteManual = false, dryRun = false } = options;
  const ctx: LogContext = { orgId, vesselId, logDate, operation: "autoFillFromTelemetry" };

  log("info", "Starting auto-fill", { ...ctx, dryRun, overwriteManual });

  try {
    const dailyLog = await getOrCreateDailyLog(vesselId, logDate, orgId, ctx);
    if (!dailyLog) {
      return createEmptySummary(vesselId, logDate);
    }

    if (dailyLog.lockedAt) {
      // @ts-ignore -- bulk-silence
      log("info", "Daily log is locked, skipping auto-fill", ctx);
      return createEmptySummary(vesselId, logDate);
    }

    const vesselEquipment = await dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId);
    const equipmentIds = vesselEquipment.map((e) => e.id);

    if (equipmentIds.length === 0) {
      // @ts-ignore -- bulk-silence
      log("info", "No equipment found for vessel", ctx);
      return createEmptySummary(vesselId, logDate);
    }

    const startDate = new Date(`${logDate}T00:00:00Z`);
    const endDate = new Date(`${logDate}T23:59:59Z`);
    const allTelemetry = await batchFetchTelemetry(equipmentIds, startDate, endDate, orgId);
    log("info", "Fetched telemetry", {
      ...ctx,
      readingsCount: allTelemetry.length,
      equipmentCount: equipmentIds.length,
    });

    const existingHourly = await engineLogStorage.getEngineLogHourly(dailyLog.id, orgId);
    const existingByHour = new Map(existingHourly.map((h) => [h.hour, h]));
    const hoursToProcess = hours || Array.from({ length: 24 }, (_, i) => i);

    const results = await processHours(
      hoursToProcess,
      allTelemetry,
      existingByHour,
      dailyLog,
      orgId,
      overwriteManual,
      dryRun
    );
    const { fmccFuelData, dataSource } = await handleFMCCData(
      dailyLog,
      vesselId,
      logDate,
      orgId,
      dryRun,
      results
    );

    const summary: AutoFillSummary = {
      vesselId,
      logDate,
      hoursProcessed: results.length,
      totalFieldsPopulated: results.reduce((sum, r) => sum + r.fieldsPopulated.length, 0),
      totalAnomalies: results.reduce((sum, r) => sum + r.anomalies.length, 0),
      results,
      fmccFuelData,
      dataSource,
    };

    log("info", "Completed auto-fill", {
      ...ctx,
      hoursProcessed: summary.hoursProcessed,
      fieldsPopulated: summary.totalFieldsPopulated,
      anomalies: summary.totalAnomalies,
    });
    return summary;
  } catch (error) {
    log("error", "Auto-fill failed", {
      ...ctx,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
