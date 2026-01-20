/**
 * Crew Alert Evaluators - Missing Signatures
 * Evaluates missing signature alerts for logbooks
 */

import { alertSettingsService } from "../settings-service.js";
import type { CrewAlertResult, EvaluationContext } from "./types.js";
import { getUnsignedLogbooks } from "./helpers.js";

export async function evaluateMissingSignatureAlerts(ctx: EvaluationContext): Promise<CrewAlertResult[]> {
  const results: CrewAlertResult[] = [];
  const now = ctx.now || new Date();

  const settings = await alertSettingsService.getCrewAlertSettings(ctx.orgId, ctx.vesselId || null);
  if (!settings?.signatureRemindersEnabled) { return results; }

  const signatureGraceHours = settings.signatureReminderHours || 24;
  const { deck, engine } = await getUnsignedLogbooks(ctx.orgId, ctx.vesselId, signatureGraceHours, now);

  for (const log of deck) {
    results.push({ triggered: true, alertType: "missing_signature_deck", alertKey: `missing_signature_deck_${log.id}`, severity: "warning", title: "Deck Log Missing Signature", message: `Deck log for ${log.logDate} requires signature`, entityId: log.id, entityType: "vessel", metadata: { vesselId: log.vesselId, logDate: log.logDate, logType: "deck", hoursOverdue: Math.floor((now.getTime() - new Date(log.logDate).getTime()) / (60 * 60 * 1000)) - signatureGraceHours } });
  }

  for (const log of engine) {
    results.push({ triggered: true, alertType: "missing_signature_engine", alertKey: `missing_signature_engine_${log.id}`, severity: "warning", title: "Engine Log Missing Signature", message: `Engine log for ${log.logDate} requires signature`, entityId: log.id, entityType: "vessel", metadata: { vesselId: log.vesselId, logDate: log.logDate, logType: "engine", hoursOverdue: Math.floor((now.getTime() - new Date(log.logDate).getTime()) / (60 * 60 * 1000)) - signatureGraceHours } });
  }

  return results;
}
