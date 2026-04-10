/**
 * Alert Runner Service
 * Orchestrates crew alert evaluators and queues notifications for delivery.
 * Handles deduplication and rate limiting.
 */

import { dbUserStorage, vesselService } from "../../repositories";
import { alertSettingsService } from "./settings-service";
import { alertSettingsRepository } from "./settings-repository";
import { emailProviderService } from "../../services/email-provider-service";
import {
  runAllCrewAlertEvaluators,
  type CrewAlertResult,
  type EvaluationContext,
} from "./crew-alert-evaluators";
import { format } from "date-fns";
import { logger } from "../../utils/logger.js";

interface AlertRunResult {
  orgId: string;
  vesselId?: string;
  timestamp: Date;
  alertsTriggered: number;
  alertsQueued: number;
  alertsSkipped: number;
  errors: string[];
}

const DEFAULT_COOLDOWN_HOURS = 24;
const CRITICAL_COOLDOWN_HOURS = 12;

type LogLevel = "info" | "warn" | "error";

const logHandlers: Record<LogLevel, (ctx: string, msg: string, data?: string) => void> = {
  error: (ctx, msg, data) => logger.error(ctx, msg, data),
  warn: (ctx, msg, data) => logger.warn(ctx, msg, data),
  info: (ctx, msg, data) => logger.info(ctx, msg, data),
};

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  const contextStr = Object.entries(context)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" ");
  
  logHandlers[level]("AlertRunner", message, contextStr || undefined);
}

const severityCooldownHours: Record<string, number> = {
  critical: CRITICAL_COOLDOWN_HOURS,
  warning: DEFAULT_COOLDOWN_HOURS,
};

function getAlertCooldownHours(severity: string): number {
  return severityCooldownHours[severity] ?? DEFAULT_COOLDOWN_HOURS * 2;
}

interface ClaimSnapshot {
  lastAlertAt: Date;
  lastEmailAt: Date | null;
  alertCount: number;
  claimUpdatedAt: Date;
}

async function claimAlertSlot(
  orgId: string, 
  alertKey: string, 
  severity: string,
  alertType: string,
  title: string,
  recipients: string[],
  vesselId?: string,
  entityId?: string
): Promise<{ claimed: boolean; cooldownId?: string; logId?: string; snapshot?: ClaimSnapshot }> {
  try {
    const cooldownHours = getAlertCooldownHours(severity);
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    
    const claim = await alertSettingsRepository.atomicClaimAlertSlot(
      orgId,
      alertType,
      alertKey,
      cooldownMs,
      vesselId,
      entityId
    );
    
    if (!claim.claimed) {
      log("info", "Alert cooldown active", { alertKey, reason: claim.reason });
      return { claimed: false };
    }
    
    const logEntry = await alertSettingsRepository.logEmail({
      orgId,
      alertType,
      alertKey,
      vesselId,
      recipients: recipients.join(", "),
      subject: title,
      status: "sending",
    });
    
    return { 
      claimed: true, 
      cooldownId: claim.cooldownId,
      logId: logEntry.id,
      snapshot: claim.snapshot
    };
  } catch (err) {
    log("warn", "Failed to claim alert slot, skipping", { 
      alertKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return { claimed: false };
  }
}

async function updateAlertLogStatus(
  logId: string,
  status: "sent" | "failed",
  errorMessage?: string
): Promise<void> {
  try {
    await alertSettingsRepository.updateEmailLogStatus(
      logId,
      status,
      status === "sent" ? new Date() : null,
      errorMessage || null
    );
  } catch (err) {
    log("error", "Failed to update alert log status", { 
      logId,
      status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function getAlertRecipients(
  orgId: string,
  vesselId: string | undefined,
  _alertType: string
): Promise<string[]> {
  const recipients: string[] = [];
  
  const settings = await alertSettingsService.getCrewAlertSettings(orgId, vesselId || null);
  if (!settings) {
    return recipients;
  }
  
  const notifyRecipients = settings.notifyRecipients;
  if (!notifyRecipients || notifyRecipients.length === 0) {
    return recipients;
  }
  
  for (const recipientId of notifyRecipients) {
    try {
      const user = await dbUserStorage.getUser(recipientId);
      if (user?.email) {
        recipients.push(user.email);
      }
    } catch (err) {
      log("warn", "Failed to get user email", { userId: recipientId });
    }
  }
  
  return recipients;
}

function buildAlertEmail(alert: CrewAlertResult, vesselName?: string): { subject: string; html: string; text: string } {
  const severityColors: Record<string, string> = {
    critical: "#dc2626",
    warning: "#f59e0b",
    info: "#3b82f6",
  };
  
  const severityColor = severityColors[alert.severity] || "#6b7280";
  const vesselInfo = vesselName ? ` - ${vesselName}` : "";
  
  const subject = `[${alert.severity.toUpperCase()}] ${alert.title}${vesselInfo}`;
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${severityColor}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${alert.title}</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          ${alert.message}
        </p>
        ${vesselName ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 16px;">Vessel: ${vesselName}</p>` : ""}
        <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 12px;">
          <p style="margin: 0; color: #6b7280;">
            Alert Type: ${alert.alertType}<br>
            Severity: ${alert.severity}<br>
            Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}
          </p>
        </div>
      </div>
    </div>
  `;
  
  const text = `[${alert.severity.toUpperCase()}] ${alert.title}${vesselInfo}

${alert.message}

Alert Type: ${alert.alertType}
Severity: ${alert.severity}
Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}
`;
  
  return { subject, html, text };
}

async function logAlertToDatabase(
  orgId: string,
  alert: CrewAlertResult,
  recipients: string[],
  status: "sent" | "skipped" | "failed",
  errorMessage?: string
): Promise<void> {
  try {
    await alertSettingsRepository.logEmail({
      orgId,
      alertType: alert.alertType,
      alertKey: alert.alertKey,
      recipients: recipients.join(", "),
      subject: alert.title,
      status,
      errorMessage: errorMessage || null,
      sentAt: status === "sent" ? new Date() : null,
    });
  } catch (err) {
    log("error", "Failed to log alert to database", { 
      alertKey: alert.alertKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Process a single alert - extracted to reduce cognitive complexity
 * SonarQube: Extract Method pattern for complexity reduction
 */
async function processAlert(
  ctx: EvaluationContext,
  alert: CrewAlertResult,
  result: AlertRunResult
): Promise<void> {
  const vesselId = (alert.metadata?.vesselId as string) || ctx.vesselId;
  const recipients = await getAlertRecipients(ctx.orgId, vesselId, alert.alertType);
  
  if (recipients.length === 0) {
    log("info", "Alert skipped (no recipients)", { alertKey: alert.alertKey });
    result.alertsSkipped++;
    await logAlertToDatabase(ctx.orgId, alert, [], "skipped", "No recipients configured");
    return;
  }
  
  const entityId = (alert.metadata?.crewId as string) || 
                   (alert.metadata?.equipmentId as string) || 
                   alert.entityId;
  
  const claim = await claimAlertSlot(
    ctx.orgId,
    alert.alertKey,
    alert.severity,
    alert.alertType,
    alert.title,
    recipients,
    vesselId,
    entityId
  );
  
  if (!claim.claimed) {
    log("info", "Alert skipped (cooldown or concurrent claim)", { alertKey: alert.alertKey });
    result.alertsSkipped++;
    return;
  }
  
  const vesselName = vesselId ? await getVesselName(vesselId) : undefined;
  const email = buildAlertEmail(alert, vesselName);
  
  const sendResult = await emailProviderService.sendEmail(
    ctx.orgId,
    recipients,
    email.subject,
    email.text,
    email.html
  );
  
  await handleSendResult(sendResult, alert, claim, result, recipients.length);
}

/** Get vessel name safely - returns undefined on failure */
async function getVesselName(vesselId: string): Promise<string | undefined> {
  try {
    const vessel = await vesselService.getVessel(vesselId);
    return vessel?.name;
  } catch {
    return undefined;
  }
}

/** Handle email send result - update logs and result counters */
async function handleSendResult(
  sendResult: { success: boolean; error?: string },
  alert: CrewAlertResult,
  claim: { logId?: string; cooldownId?: string; snapshot?: ClaimSnapshot },
  result: AlertRunResult,
  recipientCount: number
): Promise<void> {
  if (sendResult.success) {
    result.alertsQueued++;
    if (claim.logId) {
      await updateAlertLogStatus(claim.logId, "sent");
    }
    if (claim.cooldownId) {
      await alertSettingsRepository.recordEmailSent(claim.cooldownId);
    }
    log("info", "Alert sent", { alertKey: alert.alertKey, recipients: recipientCount });
  } else {
    result.errors.push(`Failed to send ${alert.alertKey}: ${sendResult.error}`);
    if (claim.logId) {
      await updateAlertLogStatus(claim.logId, "failed", sendResult.error);
    }
    if (claim.cooldownId && claim.snapshot) {
      await alertSettingsRepository.revertCooldownClaim(claim.cooldownId, claim.snapshot);
    }
    log("error", "Alert send failed", { alertKey: alert.alertKey, error: sendResult.error });
  }
}

export async function runCrewAlerts(ctx: EvaluationContext): Promise<AlertRunResult> {
  const result: AlertRunResult = {
    orgId: ctx.orgId,
    vesselId: ctx.vesselId,
    timestamp: new Date(),
    alertsTriggered: 0,
    alertsQueued: 0,
    alertsSkipped: 0,
    errors: [],
  };
  
  try {
    const alerts = await runAllCrewAlertEvaluators(ctx);
    result.alertsTriggered = alerts.length;
    
    log("info", "Crew alerts evaluation complete", {
      orgId: ctx.orgId,
      vesselId: ctx.vesselId,
      alertsTriggered: alerts.length,
    });
    
    if (alerts.length === 0) {
      return result;
    }
    
    for (const alert of alerts) {
      try {
        await processAlert(ctx, alert, result);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Error processing ${alert.alertKey}: ${errorMsg}`);
        log("error", "Alert processing error", { alertKey: alert.alertKey, error: errorMsg });
      }
    }
    
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Evaluation error: ${errorMsg}`);
    log("error", "Crew alerts evaluation failed", { orgId: ctx.orgId, error: errorMsg });
    return result;
  }
}

export async function runCrewAlertsForAllOrgs(): Promise<AlertRunResult[]> {
  const results: AlertRunResult[] = [];
  
  try {
    const orgs = await dbUserStorage.getOrganizations?.() ?? [];
    
    for (const org of orgs) {
      try {
        const result = await runCrewAlerts({
          orgId: org.id,
          now: new Date(),
        });
        results.push(result);
      } catch (err) {
        log("error", "Failed to run alerts for org", { 
          orgId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    
    log("info", "Completed crew alerts run for all orgs", {
      orgCount: orgs.length,
      totalAlerts: results.reduce((sum, r) => sum + r.alertsQueued, 0),
    });
  } catch (err) {
    log("error", "Failed to get organizations for alert run", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  
  return results;
}

export const alertRunnerService = {
  runCrewAlerts,
  runCrewAlertsForAllOrgs,
};
