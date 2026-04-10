/**
 * Crew Alert Evaluators - Crew Change Reminders
 * Evaluates upcoming crew change alerts based on assignments
 */

import { dbCrewStorage, vesselService } from "../../../repositories";
import { alertSettingsService } from "../settings-service.js";
import type { CrewAlertResult, EvaluationContext } from "./types.js";

type Assignment = Awaited<ReturnType<typeof dbCrewStorage.getCrewAssignments>>[number];

function isAssignmentActive(assignment: Assignment): boolean {
  return assignment.status === "active" || assignment.status === "onboard";
}

function hasStartedAssignment(assignment: Assignment, now: Date): boolean {
  const startDate = assignment.start ? new Date(assignment.start) : null;
  return !startDate || startDate <= now;
}

function calculateDaysUntilEnd(endDate: Date, now: Date): number {
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endDateUTC = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  return Math.floor((endDateUTC - todayUTC) / 86400000);
}

function getSeverityAndTitle(daysUntilEnd: number): { severity: "info" | "warning" | "critical"; title: string } {
  if (daysUntilEnd === 0) {return { severity: "critical", title: "Crew Assignment Ends Today" };}
  if (daysUntilEnd <= 3) {return { severity: "critical", title: "Urgent Crew Change Reminder" };}
  if (daysUntilEnd <= 7) {return { severity: "warning", title: "Upcoming Crew Change" };}
  return { severity: "info", title: "Upcoming Crew Change" };
}

function buildAlertResult(assignment: Assignment, vesselId: string, daysUntilEnd: number): CrewAlertResult {
  const { severity, title } = getSeverityAndTitle(daysUntilEnd);
  const message = daysUntilEnd === 0 ? "Crew member assignment ends today" : `Crew member assignment ends in ${daysUntilEnd} days`;
  return {
    triggered: true, alertType: "crew_change_reminder", alertKey: `crew_change_${assignment.id}`, severity, title, message,
    entityId: assignment.crewId, entityType: "crew",
    metadata: { vesselId, crewId: assignment.crewId, assignmentId: assignment.id, endDate: assignment.end, daysRemaining: daysUntilEnd, role: assignment.role }
  };
}

function processAssignment(assignment: Assignment, vesselId: string, now: Date, reminderDays: number): CrewAlertResult | null {
  if (!isAssignmentActive(assignment)) {return null;}
  if (!hasStartedAssignment(assignment, now)) {return null;}
  if (!assignment.end) {return null;}

  const endDate = new Date(assignment.end);
  const daysUntilEnd = calculateDaysUntilEnd(endDate, now);
  if (daysUntilEnd < 0 || daysUntilEnd > reminderDays) {return null;}

  return buildAlertResult(assignment, vesselId, daysUntilEnd);
}

export async function evaluateCrewChangeReminders(ctx: EvaluationContext): Promise<CrewAlertResult[]> {
  const now = ctx.now || new Date();
  const settings = await alertSettingsService.getCrewAlertSettings(ctx.orgId, ctx.vesselId || null);
  if (!settings?.crewChangeRemindersEnabled) {return [];}

  const reminderDays = settings.crewChangeReminderDays || 14;
  const vessels = ctx.vesselId ? [{ id: ctx.vesselId }] : await vesselService.getVessels(ctx.orgId);
  const results: CrewAlertResult[] = [];

  for (const vessel of vessels) {
    const assignments = await dbCrewStorage.getCrewAssignments(ctx.orgId, { vesselId: vessel.id });
    for (const assignment of assignments) {
      const alert = processAssignment(assignment, vessel.id, now, reminderDays);
      if (alert) {results.push(alert);}
    }
  }

  return results;
}

export { evaluateCrewChangeReminders as evaluateCrewChangeAlerts };
