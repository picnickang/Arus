/**
 * Deck Logbook Rule Evaluators
 * 
 * Compliance rule evaluators for deck logbook entries.
 */

import { deckLogStorage } from "../../repositories";
import { parseISO, subDays } from "date-fns";
import type { RuleContext, RuleResult } from "./types.js";

async function getDeckLogByVesselAndDate(vesselId: string, logDate: string, orgId: string) {
  const daily = await deckLogStorage.getDeckLogDailyByDate(vesselId, logDate, orgId);
  if (!daily) return undefined;
  return deckLogStorage.getDeckLogComplete(daily.id, orgId);
}

export async function evaluateDeckMissingWatch(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const watchPeriods = (config.watchPeriods as string[]) || ["00-06", "06-12", "12-18", "18-24"];

  const deckLogComplete = await getDeckLogByVesselAndDate(vesselId, logDate, orgId);
  if (!deckLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No deck log record for this date" };
  }

  const assignedPeriods = new Set(deckLogComplete.watches.map((w) => w.watchPeriod));
  const missingPeriods = watchPeriods.filter((p) => !assignedPeriods.has(p));

  if (missingPeriods.length > 0) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_deck",
        ruleCode: "DLB_MISSING_WATCH",
        ruleName: "Missing Watch Officer Assignment",
        category: "operational",
        severity: "warning",
        message: `Watch officer assignments missing for periods: ${missingPeriods.join(", ")}`,
        context: { missingPeriods, dailyLogId: deckLogComplete.daily.id },
        linkedDeckLogDayId: deckLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateDeckMissingHourly(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;
  const minHourlyEntries = (config.minHourlyEntries as number) || 12;

  const deckLogComplete = await getDeckLogByVesselAndDate(vesselId, logDate, orgId);
  if (!deckLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No deck log record for this date" };
  }

  const validEntries = deckLogComplete.hourly.filter(
    (h) => h.course !== null || h.windDirection !== null || h.seaState !== null
  );

  if (validEntries.length < minHourlyEntries) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_deck",
        ruleCode: "DLB_MISSING_HOURLY",
        ruleName: "Incomplete Hourly Entries",
        category: "data_integrity",
        severity: "warning",
        message: `Only ${validEntries.length} hourly entries recorded (minimum ${minHourlyEntries} required)`,
        context: { entryCount: validEntries.length, required: minHourlyEntries },
        linkedDeckLogDayId: deckLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateDeckUnsigned(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;

  const deckLogComplete = await getDeckLogByVesselAndDate(vesselId, logDate, orgId);
  if (!deckLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No deck log record for this date" };
  }

  const logDateParsed = parseISO(logDate);
  const yesterday = subDays(new Date(), 1);

  if (deckLogComplete.daily.signedAt === null && logDateParsed < yesterday) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_deck",
        ruleCode: "DLB_UNSIGNED",
        ruleName: "Unsigned Daily Record",
        category: "regulatory",
        severity: "critical",
        message: `Deck logbook for ${logDate} has not been signed`,
        context: { status: deckLogComplete.daily.status },
        linkedDeckLogDayId: deckLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}

export async function evaluateDeckMissingPosition(
  ctx: RuleContext,
  config: Record<string, unknown>
): Promise<RuleResult> {
  const { vesselId, logDate, orgId } = ctx;

  const deckLogComplete = await getDeckLogByVesselAndDate(vesselId, logDate, orgId);
  if (!deckLogComplete?.daily) {
    return { triggered: false, skipped: true, skipReason: "No deck log record for this date" };
  }

  if (deckLogComplete.daily.noonLatitude === null || deckLogComplete.daily.noonLongitude === null) {
    return {
      triggered: true,
      finding: {
        sourceType: "logbook_deck",
        ruleCode: "DLB_MISSING_POSITION",
        ruleName: "Missing Noon Position",
        category: "operational",
        severity: "info",
        message: `Noon position not recorded for ${logDate}`,
        context: {},
        linkedDeckLogDayId: deckLogComplete.daily.id,
        status: "open",
      },
    };
  }

  return { triggered: false };
}
