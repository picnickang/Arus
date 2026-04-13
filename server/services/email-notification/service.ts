/**
 * Email Notification - Main Service Class
 */

import { dbNotificationsStorage } from "../../repositories.js";
import type {
  ComplianceFinding,
  NotificationSetting,
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
import { queueNotification, processQueueItem, processDigestQueue, retryFailedNotifications } from "./queue-processor.js";
import {
  sendCertificationExpiryNotification,
  sendDocumentExpiryNotification,
  sendCrewComplianceNotification,
} from "./crew-notifications.js";

class EmailNotificationService {
  private getRecipients(setting: NotificationSetting): string[] {
    const recipients: string[] = [];
    if (setting.recipientEmails) {
      recipients.push(...(setting.recipientEmails as string[]));
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
      console.log(`[EmailNotificationService] No applicable notification settings for finding ${finding.id}`);
      return;
    }

    for (const setting of applicableSettings) {
      const recipients = this.getRecipients(setting);
      if (recipients.length === 0) { continue; }

      const subject = buildComplianceSubject(finding, vesselName);
      const { text, html } = buildComplianceBody(finding, vesselName);

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
        await processQueueItem(queueItem);
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
    const applicableSettings = settings.filter((s) => s.enabled && (!s.vesselId || s.vesselId === vesselId));

    if (applicableSettings.length === 0) { return; }

    for (const setting of applicableSettings) {
      const recipients = this.getRecipients(setting);
      if (recipients.length === 0) { continue; }

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

    if (applicableSettings.length === 0) { return; }

    for (const setting of applicableSettings) {
      const recipients = this.getRecipients(setting);
      if (recipients.length === 0) { continue; }

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

  async processDigestQueue(): Promise<number> {
    return processDigestQueue();
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
}

export const emailNotificationService = new EmailNotificationService();
