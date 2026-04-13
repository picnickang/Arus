/**
 * Engine Log Auto-Fill - Generator Auto-Fill
 * Populate generator entries from telemetry
 */

import { dbEquipmentStorage, engineLogStorage } from "../../repositories.js";
import { log } from "./logging.js";
import { GENERATOR_TELEMETRY_MAPPING } from "./mappings.js";
import { GENERATOR_ANOMALY_THRESHOLDS, checkAnomaly } from "./thresholds.js";
import { batchFetchTelemetry, aggregateTelemetryByHour } from "./telemetry-fetcher.js";
import type {
  LogContext,
  GeneratorAutoFillOptions,
  InsertEngineLogGenerator,
  EquipmentTelemetry,
  EngineLogDaily,
} from "./types.js";

async function getOrCreateDailyLog(
  vesselId: string,
  logDate: string,
  orgId: string
): Promise<EngineLogDaily | null> {
  let dailyLog = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
  if (dailyLog) { return dailyLog; }

  try {
    return await engineLogStorage.createEngineLogDaily({ orgId, vesselId, logDate, status: 'open' });
  } catch (error: unknown) {
    const errorCode = error instanceof Error && 'code' in error ? (error as { code: string }).code : undefined;
    if (errorCode !== '23505') { throw error; }
    dailyLog = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
    if (!dailyLog) {
      throw new Error('Failed to retrieve existing daily log after duplicate key error');
    }
    return dailyLog;
  }
}

function groupTelemetryByEquipment(telemetry: EquipmentTelemetry[]): Map<string, EquipmentTelemetry[]> {
  const telemetryByEquipment = new Map<string, EquipmentTelemetry[]>();
  for (const reading of telemetry) {
    if (!reading.equipmentId) { continue; }
    if (!telemetryByEquipment.has(reading.equipmentId)) {
      telemetryByEquipment.set(reading.equipmentId, []);
    }
    telemetryByEquipment.get(reading.equipmentId)!.push(reading);
  }
  return telemetryByEquipment;
}

function processAggregates(
  aggregates: Map<string, { avg: number; count: number }>,
  orgId: string,
  dailyLogId: string,
  hour: number,
  genNum: number
): { generatorEntry: Partial<InsertEngineLogGenerator>; hasData: boolean; anomalyCount: number } {
  const generatorEntry: Partial<InsertEngineLogGenerator> = { orgId, dailyLogId, hour, generatorNumber: genNum };
  let hasData = false;
  let anomalyCount = 0;

  for (const [sensorType, aggregate] of aggregates) {
    const targetField = GENERATOR_TELEMETRY_MAPPING[sensorType];
    if (!targetField) { continue; }

    const integerFields = ['rpm', 'hour', 'generatorNumber'];
    const value = integerFields.includes(targetField) ? Math.round(aggregate.avg) : aggregate.avg;
    (generatorEntry as Record<string, unknown>)[targetField] = value;
    hasData = true;

    const anomalyCheck = checkAnomaly(targetField, aggregate.avg, GENERATOR_ANOMALY_THRESHOLDS);
    if (anomalyCheck.isAnomaly) {
      anomalyCount++;
    }
  }

  return { generatorEntry, hasData, anomalyCount };
}

async function processGeneratorHours(
  readings: EquipmentTelemetry[],
  hoursToProcess: number[],
  dailyLog: EngineLogDaily,
  orgId: string,
  genNum: number,
  dryRun: boolean
): Promise<{ hoursProcessed: number; anomaliesFound: number }> {
  let hoursProcessed = 0;
  let anomaliesFound = 0;

  for (const hour of hoursToProcess) {
    const aggregates = aggregateTelemetryByHour(readings, hour);
    if (aggregates.size === 0) { continue; }

    const { generatorEntry, hasData, anomalyCount } = processAggregates(
      aggregates, orgId, dailyLog.id, hour, genNum
    );

    if (hasData && !dryRun) {
      await engineLogStorage.upsertEngineLogGenerator(generatorEntry as InsertEngineLogGenerator);
      hoursProcessed++;
    }
    anomaliesFound += anomalyCount;
  }

  return { hoursProcessed, anomaliesFound };
}

export async function autoFillGeneratorsFromTelemetry(
  vesselId: string,
  orgId: string,
  logDate: string,
  options: GeneratorAutoFillOptions = {}
): Promise<{ hoursProcessed: number; generatorsProcessed: number; anomalies: number }> {
  const { hours, generatorNumbers = [1, 2, 3], overwriteManual = false, dryRun = false } = options;
  const ctx: LogContext = { orgId, vesselId, logDate, operation: 'autoFillGeneratorsFromTelemetry' };

  log('info', 'Starting generator auto-fill', { ...ctx, dryRun, overwriteManual });

  const dailyLog = await getOrCreateDailyLog(vesselId, logDate, orgId);
  if (!dailyLog || dailyLog.lockedAt) {
    return { hoursProcessed: 0, generatorsProcessed: 0, anomalies: 0 };
  }

  const vesselEquipment = await dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId);
  const generators = vesselEquipment.filter(
    (e) => e.type?.toLowerCase().includes('generator') || e.type?.toLowerCase().includes('dg')
  );

  if (generators.length === 0) {
    log('info', 'No generators found for vessel', ctx);
    return { hoursProcessed: 0, generatorsProcessed: 0, anomalies: 0 };
  }

  const startDate = new Date(`${logDate}T00:00:00Z`);
  const endDate = new Date(`${logDate}T23:59:59Z`);
  const allTelemetry = await batchFetchTelemetry(generators.map((g) => g.id), startDate, endDate, orgId);
  const telemetryByEquipment = groupTelemetryByEquipment(allTelemetry);

  let hoursProcessed = 0;
  let generatorsProcessed = 0;
  let anomaliesFound = 0;
  const hoursToProcess = hours || Array.from({ length: 24 }, (_, i) => i);

  for (const generator of generators) {
    const genNumMatch = generator.name?.match(/(\d+)/);
    const genNum = genNumMatch ? Number.parseInt(genNumMatch[1]) : 1;
    if (!generatorNumbers.includes(genNum)) { continue; }

    try {
      const readings = telemetryByEquipment.get(generator.id) ?? [];
      const result = await processGeneratorHours(readings, hoursToProcess, dailyLog, orgId, genNum, dryRun);
      hoursProcessed += result.hoursProcessed;
      anomaliesFound += result.anomaliesFound;
      generatorsProcessed++;
    } catch (error) {
      log('warn', 'Failed to process generator', {
        ...ctx,
        generatorName: generator.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log('info', 'Completed generator auto-fill', { ...ctx, hoursProcessed, generatorsProcessed, anomalies: anomaliesFound });
  return { hoursProcessed, generatorsProcessed, anomalies: anomaliesFound };
}
