/**
 * Email Notification - Main Service Class
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:EmailNotification:Service");
import { dbNotificationsStorage } from "../../repositories.js";
import type {
  ComplianceFinding,
  OrgNotificationSettings as NotificationSetting,
  Crew,
  CrewCertification,
  CrewDocument,
} from "@shared/schema";
import { SEVERITY_LEVELS } from "./types.js";
import { emailSender } from "./email-sender.js";
import {
  buildComplianceSubject,
  buildComplianceBody,
  buildAlertBody,
  buildLogbookReminderBody,
} from "./templates.js";
import {
  queueNotification,
  processQueueItem,
  processDigestQueue,
  processPendingNotifications,
  retryFailedNotifications,
} from "./queue-processor.js";
import {
  sendCertificationExpiryNotification,
  sendDocumentExpiryNotification,
  sendCrewComplianceNotification,
} from "./crew-notifications.js";
import { alertSettingsService } from "../../domains/alerts/settings-service.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class EmailNotificationService {
  private getRecipients(setting: NotificationSetting): string[] {
    const recipients: string[] = [];
    const emails = setting.recipientEmails;
    if (emails) {
      recipients.push(...emails);
    }
    return [...new Set(recipients)];
  }

  private severityMeetsThreshold(severity: string, threshold: string): boolean {
    return (SEVERITY_LEVELS[severity] ?? 0) >= (SEVERITY_LEVELS[threshold] ?? 0);
  }

  private getNextDigestTime(_cronSchedule: string | null): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow;
  }

  async sendComplianceNotification(
    finding: ComplianceFinding,
    vesselName: string,
    orgId: string
  ): Promise<void> {
    const settings = await dbNotificationsStorage.getNotificationSettings(orgId);

    const applicableSettings = settings.filter(
      (s) =>
        s.enabled &&
        (!s.vesselId || s.vesselId === finding.vesselId) &&
        this.severityMeetsThreshold(finding.severity, s.minSeverity || "warning")
    );

    if (applicableSettings.length === 0) {
      logger.info(
        `[EmailNotificationService] No applicable notification settings for finding ${finding.id}`
      );
      return;
    }

    const subject = buildComplianceSubject(finding, vesselName);
    const { text, html } = buildComplianceBody(finding, vesselName);

    // Digest-mode settings defer (and dedup by batching); immediate settings are
    // gated by a per-finding cooldown so a repeated finding doesn't re-email.
    const immediateRecipients: string[][] = [];
    for (const setting of applicableSettings) {
      const recipients = this.getRecipients(setting);
      if (recipients.length === 0) {
        continue;
      }
      if (setting.digestMode) {
        await queueNotification({
          orgId,
          notificationType: "compliance",
          subject,
          body: text,
          bodyHtml: html,
          recipients,
          relatedEntityType: "compliance_finding",
          relatedEntityId: finding.id,
          status: "pending",
          scheduledFor: this.getNextDigestTime(setting.digestSchedule),
        });
      } else {
        immediateRecipients.push(recipients);
      }
    }

    if (immediateRecipients.length === 0) {
      return;
    }

    const orgSettings = await alertSettingsService.getSettings(orgId);
    const cooldownMs = (orgSettings.alertCooldownMinutes ?? 30) * 60_000;
    const claim = await alertSettingsService.claimAlertSlot(
      orgId,
      "compliance",
      finding.id,
      cooldownMs,
      finding.vesselId ?? undefined,
      finding.id
    );
    if (!claim.claimed) {
      logger.info(
        `[EmailNotificationService] Compliance finding ${finding.id} suppressed by cooldown: ${claim.reason ?? "active"}`
      );
      return;
    }

    let anySuccess = false;
    try {
      for (const recipients of immediateRecipients) {
        const queueItem = await queueNotification({
          orgId,
          notificationType: "compliance",
          subject,
          body: text,
          bodyHtml: html,
          recipients,
          relatedEntityType: "compliance_finding",
          relatedEntityId: finding.id,
          status: "pending",
        });
        const result = await processQueueItem(queueItem);
        if (result.success) {
          anySuccess = true;
        }
      }
    } finally {
      if (claim.cooldownId) {
        if (anySuccess) {
          await alertSettingsService.recordAlertEmailSent(claim.cooldownId);
        } else if (claim.snapshot) {
          await alertSettingsService.revertAlertSlot(claim.cooldownId, claim.snapshot);
        }
      }
    }
  }

  async sendLogbookReminderNotification(
    logType: "deck" | "engine",
    vesselId: string,
    vesselName: string,
    logDate: string,
    orgId: string
  ): Promise<void> {
    const settings = await dbNotificationsStorage.getNotificationSettings(orgId);
    const applicableSettings = settings.filter(
      (s) => s.enabled && (!s.vesselId || s.vesselId === vesselId)
    );

    if (applicableSettings.length === 0) {
      return;
    }

    for (const setting of applicableSettings) {
      const recipients = this.getRecipients(setting);
      if (recipients.length === 0) {
        continue;
      }

      const { subject, text, html } = buildLogbookReminderBody(logType, vesselName, logDate);

      const queueItem = await queueNotification({
        orgId,
        notificationType: "logbook",
        subject,
        body: text,
        bodyHtml: html,
        recipients,
        relatedEntityType: `logbook_${logType}`,
        relatedEntityId: `${vesselId}_${logDate}`,
        status: "pending",
      });

      await processQueueItem(queueItem);
    }
  }

  async sendAlertNotification(
    alert: { id: string; type: string; message: string; severity: string },
    vesselName: string,
    equipmentName: string,
    orgId: string
  ): Promise<void> {
    const settings = await dbNotificationsStorage.getNotificationSettings(orgId);
    const applicableSettings = settings.filter(
      (s) => s.enabled && this.severityMeetsThreshold(alert.severity, s.minSeverity || "warning")
    );

    if (applicableSettings.length === 0) {
      return;
    }

    for (const setting of applicableSettings) {
      const recipients = this.getRecipients(setting);
      if (recipients.length === 0) {
        continue;
      }

      const subject = `[${alert.severity.toUpperCase()}] Alert - ${equipmentName} on ${vesselName}`;
      const { text, html } = buildAlertBody(alert, vesselName, equipmentName);

      const queueItem = await queueNotification({
        orgId,
        notificationType: "alert",
        subject,
        body: text,
        bodyHtml: html,
        recipients,
        relatedEntityType: "alert",
        relatedEntityId: alert.id,
        status: "pending",
      });

      await processQueueItem(queueItem);
    }
  }

  /**
   * Queue a one-off test notification AND attempt delivery immediately.
   *
   * Mirrors the non-digest send paths (queue then processQueueItem on the same
   * row). This exists because the HTTP test endpoint previously queued a
   * "pending" row and then called retryFailedNotifications(1), which only ever
   * reprocesses rows already in "failed" status — so the freshly-queued test
   * row was never attempted. Returns the queue row id so callers can inspect
   * the outcome.
   */
  async sendTestNotification(input: {
    orgId: string;
    email: string;
    subject?: string | undefined;
    message?: string | undefined;
  }): Promise<{ id: string; queued: true }> {
    const subject = input.subject || "ARUS Marine Test Notification";
    const body = input.message || "This is a test notification from ARUS Marine.";
    const item = await queueNotification({
      orgId: input.orgId,
      notificationType: "test",
      subject,
      body,
      bodyHtml: `<div style="font-family: Arial, sans-serif;"><h2>Test Notification</h2><p>${escapeHtml(body)}</p></div>`,
      recipients: [input.email],
      status: "pending",
    });
    await processQueueItem(item);
    return { id: item.id, queued: true };
  }

  async processDigestQueue(): Promise<number> {
    return processDigestQueue();
  }

  /**
   * Drain immediate pending notifications (e.g. RMS alerts queued directly with
   * no scheduledFor). Without this they are never sent — processDigestQueue only
   * handles rows whose scheduledFor has elapsed.
   */
  async processPendingNotifications(): Promise<number> {
    return processPendingNotifications();
  }

  async retryFailedNotifications(maxAttempts: number = 3): Promise<number> {
    return retryFailedNotifications(maxAttempts);
  }

  async sendCertificationExpiryNotification(
    crew: Crew,
    certification: CrewCertification,
    daysUntilExpiry: number,
    orgId: string
  ): Promise<boolean> {
    return sendCertificationExpiryNotification(crew, certification, daysUntilExpiry, orgId);
  }

  async sendDocumentExpiryNotification(
    crew: Crew,
    document: CrewDocument,
    daysUntilExpiry: number,
    orgId: string
  ): Promise<boolean> {
    return sendDocumentExpiryNotification(crew, document, daysUntilExpiry, orgId);
  }

  async sendCrewComplianceNotification(
    crew: Crew,
    complianceType: string,
    message: string,
    severity: "info" | "warning" | "critical",
    orgId: string
  ): Promise<boolean> {
    return sendCrewComplianceNotification(crew, complianceType, message, severity, orgId);
  }

  isEnabled(): boolean {
    return emailSender.isEnabled();
  }

  getStatus(): { enabled: boolean; provider: string } {
    return emailSender.getStatus();
  }

  async getStatusForOrg(orgId: string): Promise<{ enabled: boolean; provider: string }> {
    return emailSender.getStatusForOrg(orgId);
  }
}

export const emailNotificationService = new EmailNotificationService();
