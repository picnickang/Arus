/**
 * Crew Alert Evaluators - Hours of Rest
 * Evaluates hours of rest violation alerts
 */

import { format } from "date-fns";
import { vesselService, dbStcwStorage } from "../../../repositories";
import { alertSettingsService } from "../settings-service.js";
import { checkMonthCompliance, normalizeRestDays } from "../../../stcw-compliance.js";
import type { CrewAlertResult, EvaluationContext } from "./types.js";
import { getSeverityFromMinSeverity } from "./helpers.js";
import { logger } from "../../../utils/logger.js";

function hasValidRestData(restData: any): boolean {
  return restData?.sheet && restData?.days && restData.days.length > 0;
}

function createDailyViolationAlert(
  crewId: string,
  vesselId: string,
  now: Date,
  failedDays: any[],
  settings: any
): CrewAlertResult {
  return {
    triggered: true,
    alertType: "hor_violation_daily",
    alertKey: `hor_violation_daily_${crewId}_${format(now, "yyyy-MM")}`,
    severity: getSeverityFromMinSeverity(settings.horViolationMinSeverity),
    title: "Hours of Rest Violation - Daily",
    message: `Crew member has ${failedDays.length} daily rest violations this month`,
    entityId: crewId,
    entityType: "crew",
    metadata: {
      vesselId,
      crewId,
      violationCount: failedDays.length,
      failedDates: failedDays.map((d) => d.date),
      notifyMaster: settings.horViolationNotifyMaster,
      notifyDpa: settings.horViolationNotifyDpa,
    },
  };
}

function createWeeklyViolationAlert(
  crewId: string,
  vesselId: string,
  now: Date,
  failed7d: any[],
  settings: any
): CrewAlertResult {
  return {
    triggered: true,
    alertType: "hor_violation_weekly",
    alertKey: `hor_violation_weekly_${crewId}_${format(now, "yyyy-MM")}`,
    severity: getSeverityFromMinSeverity(settings.horViolationMinSeverity),
    title: "Hours of Rest Violation - 7-Day Rolling",
    message: `Crew member has ${failed7d.length} rolling 7-day rest violations`,
    entityId: crewId,
    entityType: "crew",
    metadata: {
      vesselId,
      crewId,
      violationCount: failed7d.length,
      failedPeriods: failed7d.map((r) => ({ endDate: r.end_date, restHours: r.rest_7d })),
      notifyMaster: settings.horViolationNotifyMaster,
      notifyDpa: settings.horViolationNotifyDpa,
    },
  };
}

function processCrewRestData(
  crewId: string,
  restData: any,
  vesselId: string,
  now: Date,
  settings: any,
  results: CrewAlertResult[]
): void {
  if (!hasValidRestData(restData)) {return;}

  const normalizedDays = normalizeRestDays(restData.days);
  const compliance = checkMonthCompliance(normalizedDays);

  if (compliance.ok) {return;}

  const failedDays = compliance.days.filter((d) => !d.day_ok);
  const failed7d = compliance.rolling7d.filter((r) => !r.ok);

  if (failedDays.length > 0) {
    results.push(createDailyViolationAlert(crewId, vesselId, now, failedDays, settings));
  }

  if (failed7d.length > 0) {
    results.push(createWeeklyViolationAlert(crewId, vesselId, now, failed7d, settings));
  }
}

export async function evaluateHoRViolationAlerts(ctx: EvaluationContext): Promise<CrewAlertResult[]> {
  const results: CrewAlertResult[] = [];
  const now = ctx.now || new Date();

  const settings = await alertSettingsService.getCrewAlertSettings(ctx.orgId, ctx.vesselId || null);
  if (!settings?.horViolationAlertsEnabled) {return results;}

  const vessels = ctx.vesselId ? [{ id: ctx.vesselId }] : await vesselService.getVessels(ctx.orgId);
  const currentYear = now.getFullYear();
  const currentMonth = format(now, "MMMM").toUpperCase();

  for (const vessel of vessels) {
    try {
      const vesselCrewRest = await dbStcwStorage.getVesselCrewRest(vessel.id, currentYear, currentMonth);

      for (const [crewId, restData] of Object.entries(vesselCrewRest)) {
        processCrewRestData(crewId, restData, vessel.id, now, settings, results);
      }
    } catch (error) {
      logger.error("CrewAlertEvaluators", `Error evaluating HoR for vessel ${vessel.id}`, error);
    }
  }

  return results;
}
