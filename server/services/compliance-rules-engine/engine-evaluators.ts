/**
 * Engine Room Logbook Rule Evaluators
 *
 * Compliance rule evaluators for engine room logbook entries.
 */

import { engineLogStorage } from "../../repositories";
import { parseISO, subDays } from "date-fns";
import type { RuleContext, RuleResult } from "./types.js";

async function getEngineLogByVesselAndDate(vesselId: string, logDate: string, orgId: string) {
  const daily = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
  if (!daily) {
    return undefined;
  }
  return engineLogStorage.getEngineLogComplete(daily.id, orgId);
}

export async function evaluateEngineMissingWatch(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const watchPeriods = (config.watchPeriods as string[]) || ["00-06", "06-12", "12-18", "18-24"];

  const engineLogComplete = await getEngineLogByVesselAndDate(vesselId, logDate, orgId);
  if (!engineLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No engine log record for this date" };
  }

  const assignedPeriods = new Set(engineLogComplete.watches.map((w) => w.watchPeriod));
  const missingPeriods = watchPeriods.filter((p) => !assignedPeriods.has(p));

  if (missingPeriods.length > 0) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_engine",
        ruleCode: "ER_MISSING_WATCH",
        ruleName: "Missing Engine Watch Assignment",
        category: "operational",
        severity: "warning",
        message: `Engine watch assignments missing for periods: ${missingPeriods.join(", ")}`,
        context: { missingPeriods, dailyLogId: engineLogComplete.daily.id },
        linkedEngineLogDayId: engineLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateEngineOvertemp(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const maxExhaustTemp = (config.maxExhaustTemp as number) || 450;

  const engineLogComplete = await getEngineLogByVesselAndDate(vesselId, logDate, orgId);
  if (!engineLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No engine log record for this date" };
  }

  const overTempEntries = engineLogComplete.hourly.filter(
    // @ts-ignore -- bulk-silence
    (h) => h.meExhaustGasTemp !== null && h.meExhaustGasTemp > maxExhaustTemp
  );

  if (overTempEntries.length > 0) {
    // @ts-ignore -- bulk-silence
    const maxTemp = Math.max(...overTempEntries.map((h) => h.meExhaustGasTemp!));
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_engine",
        ruleCode: "ER_ME_OVERTEMP",
        ruleName: "Main Engine Overtemperature",
        category: "safety",
        severity: "critical",
        message: `Main engine exhaust temperature exceeded ${maxExhaustTemp}°C (max recorded: ${maxTemp}°C)`,
        context: { maxTemp, threshold: maxExhaustTemp, occurrences: overTempEntries.length },
        linkedEngineLogDayId: engineLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateEngineOverload(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const maxLoad = (config.maxLoad as number) || 90;

  const engineLogComplete = await getEngineLogByVesselAndDate(vesselId, logDate, orgId);
  if (!engineLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No engine log record for this date" };
  }

  const overloadEntries = engineLogComplete.hourly.filter(
    (h) => h.meLoad !== null && h.meLoad > maxLoad
  );

  if (overloadEntries.length > 0) {
    const maxRecorded = Math.max(...overloadEntries.map((h) => h.meLoad!));
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_engine",
        ruleCode: "ER_ME_OVERLOAD",
        ruleName: "Main Engine Overload",
        category: "safety",
        severity: "warning",
        message: `Main engine load exceeded ${maxLoad}% MCR (max recorded: ${maxRecorded}%)`,
        context: { maxRecorded, threshold: maxLoad, occurrences: overloadEntries.length },
        linkedEngineLogDayId: engineLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateLowFuel(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const minHfoRob = (config.minHfoRob as number) || 50;
  const minMdoRob = (config.minMdoRob as number) || 20;

  const engineLogComplete = await getEngineLogByVesselAndDate(vesselId, logDate, orgId);
  if (!engineLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No engine log record for this date" };
  }

  const lowFuelTypes: string[] = [];
  if (
    engineLogComplete.daily.fuelHfoRob !== null &&
    engineLogComplete.daily.fuelHfoRob < minHfoRob
  ) {
    lowFuelTypes.push(`HFO (${engineLogComplete.daily.fuelHfoRob}MT < ${minHfoRob}MT)`);
  }

  if (
    engineLogComplete.daily.fuelMdoRob !== null &&
    engineLogComplete.daily.fuelMdoRob < minMdoRob
  ) {
    lowFuelTypes.push(`MDO (${engineLogComplete.daily.fuelMdoRob}MT < ${minMdoRob}MT)`);
  }

  if (lowFuelTypes.length > 0) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_engine",
        ruleCode: "ER_LOW_FUEL",
        ruleName: "Low Fuel ROB Warning",
        category: "operational",
        severity: "warning",
        message: `Low fuel remaining on board: ${lowFuelTypes.join(", ")}`,
        context: {
          hfoRob: engineLogComplete.daily.fuelHfoRob,
          mdoRob: engineLogComplete.daily.fuelMdoRob,
        },
        linkedEngineLogDayId: engineLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateEngineUnsigned(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;

  const engineLogComplete = await getEngineLogByVesselAndDate(vesselId, logDate, orgId);
  if (!engineLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No engine log record for this date" };
  }

  const logDateParsed = parseISO(logDate);
  const yesterday = subDays(new Date(), 1);

  if (engineLogComplete.daily.signedAt === null && logDateParsed < yesterday) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_engine",
        ruleCode: "ER_UNSIGNED",
        ruleName: "Unsigned Engine Log",
        category: "regulatory",
        severity: "critical",
        message: `Engine room logbook for ${logDate} has not been signed`,
        context: { status: engineLogComplete.daily.status },
        linkedEngineLogDayId: engineLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateEngineMissingHourly(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const minHourlyEntries = (config.minHourlyEntries as number) || 12;

  const engineLogComplete = await getEngineLogByVesselAndDate(vesselId, logDate, orgId);
  if (!engineLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No engine log record for this date" };
  }

  const validEntries = engineLogComplete.hourly.filter(
    // @ts-ignore -- bulk-silence
    (h) => h.meRpm !== null || h.meLoad !== null || h.meFoTemp !== null
  );

  if (validEntries.length < minHourlyEntries) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_engine",
        ruleCode: "ER_MISSING_HOURLY",
        ruleName: "Incomplete Hourly Engine Entries",
        category: "data_integrity",
        severity: "warning",
        message: `Only ${validEntries.length} hourly entries recorded (minimum ${minHourlyEntries} required)`,
        context: { entryCount: validEntries.length, required: minHourlyEntries },
        linkedEngineLogDayId: engineLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateBilgeHigh(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const maxBilgeLevel = (config.maxBilgeLevel as number) || 80;

  const engineLogComplete = await getEngineLogByVesselAndDate(vesselId, logDate, orgId);
  if (!engineLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No engine log record for this date" };
  }

  if (
    engineLogComplete.daily.bilgeLevel !== null &&
    engineLogComplete.daily.bilgeLevel > maxBilgeLevel
  ) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_engine",
        ruleCode: "ER_BILGE_HIGH",
        ruleName: "High Bilge Level",
        category: "safety",
        severity: "warning",
        message: `Bilge level (${engineLogComplete.daily.bilgeLevel}%) exceeds threshold (${maxBilgeLevel}%)`,
        context: { bilgeLevel: engineLogComplete.daily.bilgeLevel, threshold: maxBilgeLevel },
        linkedEngineLogDayId: engineLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}
