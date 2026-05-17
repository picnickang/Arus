/**
 * Alert Settings Service
 * Business logic for email and alert configuration
 */

import { alertSettingsRepository } from "./settings-repository";
import {
  emailProviderService,
  type EmailConfig,
  type EmailPayload,
} from "../../services/email-provider-service";
import { encryptSecret } from "../../lib/crypto-service";
import { logger } from "../../utils/logger.js";
import type {
  AlertSettings,
  InsertAlertSettings,
  AlertSettingsVessel,
  InsertAlertSettingsVessel,
  AlertThreshold,
  InsertAlertThreshold,
  AlertEmailLog,
  CrewAlertSettings,
  InsertCrewAlertSettings,
} from "@shared/schema";

// Alias kept for callsite readability after the 2026-05-17 schema
// reconciliation: AlertSettings now natively contains every email/SMTP/test
// column the service used to bridge via Partial<…>.
type AlertSettingsRaw = AlertSettings;

export interface AlertSettingsPublic {
  id: string;
  orgId: string;
  emailEnabled: boolean;
  defaultToEmail: string | null;
  ccEmails: string[] | null;
  bccEmails: string[] | null;
  timezone: string;
  provider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpUseTls: boolean;
  fromEmail: string;
  fromName: string;
  alertCooldownMinutes: number;
  dailyDigestEnabled: boolean;
  dailyDigestTime: string | null;
  lastTestStatus: string | null;
  lastTestAt: Date | null;
  lastTestError: string | null;
  hasApiKey: boolean;
  hasSmtpPassword: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

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

  logHandlers[level]("AlertSettings", message, contextStr || undefined);
}

export class AlertSettingsService {
  async getSettings(orgId: string): Promise<AlertSettingsPublic> {
    const settings = await alertSettingsRepository.getOrgSettings(orgId);

    if (!settings) {
      return this.getDefaultSettings(orgId);
    }

    return this.toPublicSettings(settings);
  }

  private getDefaultSettings(orgId: string): AlertSettingsPublic {
    return {
      id: "",
      orgId,
      emailEnabled: false,
      defaultToEmail: null,
      ccEmails: null,
      bccEmails: null,
      timezone: "Asia/Singapore",
      provider: "sendgrid",
      smtpHost: null,
      smtpPort: 587,
      smtpUser: null,
      smtpUseTls: true,
      fromEmail: "noreply@arus-marine.com",
      fromName: "ARUS Marine",
      alertCooldownMinutes: 30,
      dailyDigestEnabled: false,
      dailyDigestTime: "08:00",
      lastTestStatus: null,
      lastTestAt: null,
      lastTestError: null,
      hasApiKey: false,
      hasSmtpPassword: false,
      createdAt: null,
      updatedAt: null,
    };
  }

  private toPublicSettings(settings: AlertSettingsRaw): AlertSettingsPublic {
    return {
      id: settings.id,
      orgId: settings.orgId,
      emailEnabled: settings.emailEnabled ?? false,
      defaultToEmail: settings.defaultToEmail ?? null,
      ccEmails: settings.ccEmails as string[] | null,
      bccEmails: settings.bccEmails as string[] | null,
      timezone: settings.timezone || "Asia/Singapore",
      provider: settings.provider || "sendgrid",
      smtpHost: settings.smtpHost ?? null,
      smtpPort: settings.smtpPort ?? null,
      smtpUser: settings.smtpUser ?? null,
      smtpUseTls: settings.smtpUseTls ?? true,
      fromEmail: settings.fromEmail || "noreply@arus-marine.com",
      fromName: settings.fromName || "ARUS Marine",
      alertCooldownMinutes: settings.alertCooldownMinutes ?? 30,
      dailyDigestEnabled: settings.dailyDigestEnabled ?? false,
      dailyDigestTime: settings.dailyDigestTime ?? null,
      lastTestStatus: settings.lastTestStatus ?? null,
      lastTestAt: settings.lastTestAt ?? null,
      lastTestError: settings.lastTestError ?? null,
      hasApiKey: !!settings.apiKeyEncrypted,
      hasSmtpPassword: !!settings.smtpEncryptedPassword,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  async updateSettings(
    orgId: string,
    data: Partial<InsertAlertSettings> & {
      apiKey?: string;
      smtpPassword?: string;
    }
  ): Promise<AlertSettingsPublic> {
    const { apiKey, smtpPassword, ...rest } = data;
    const updateData: Partial<InsertAlertSettings> & Record<string, unknown> = { ...rest };

    if (apiKey) {
      (updateData as any).apiKeyEncrypted = encryptSecret(apiKey);
    }

    if (smtpPassword) {
      (updateData as any).smtpEncryptedPassword = encryptSecret(smtpPassword);
    }

    const settings = await alertSettingsRepository.upsertOrgSettings(orgId, updateData);
    log("info", "Alert settings updated", { orgId });

    return this.toPublicSettings(settings);
  }

  async testEmailConnection(orgId: string): Promise<{ success: boolean; error?: string }> {
    const settings = await alertSettingsRepository.getOrgSettings(orgId);

    if (!settings) {
      return { success: false, error: "Email settings not configured" };
    }

    const config = this.buildEmailConfig(settings);
    const result = await emailProviderService.testConnection(config);

    await alertSettingsRepository.upsertOrgSettings(orgId, {
      lastTestStatus: result.success ? "success" : "failed",
      lastTestAt: new Date(),
      lastTestError: result.error || null,
    } as any);

    log(result.success ? "info" : "warn", "Email connection test", {
      orgId,
      success: result.success,
      error: result.error,
    });

    return result;
  }

  async sendTestEmail(
    orgId: string,
    recipientEmail: string
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const settings = await alertSettingsRepository.getOrgSettings(orgId);

    if (!settings) {
      return { success: false, error: "Email settings not configured" };
    }

    const config = this.buildEmailConfig(settings);

    const payload: EmailPayload = {
      to: [recipientEmail],
      subject: "ARUS Marine - Test Email",
      text: "This is a test email from ARUS Marine alert system. If you received this, your email configuration is working correctly.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">ARUS Marine - Test Email</h1>
          <p>This is a test email from the ARUS Marine alert system.</p>
          <p>If you received this, your email configuration is working correctly.</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br/>
            Provider: ${config.provider}
          </p>
        </div>
      `,
    };

    const result = await emailProviderService.sendEmail(config, payload);

    await alertSettingsRepository.logEmail({
      orgId,
      alertType: "test",
      severity: "info",
      recipients: [recipientEmail],
      subject: payload.subject,
      status: result.success ? "sent" : "failed",
      messageId: result.messageId,
      errorMessage: result.error,
    });

    await alertSettingsRepository.upsertOrgSettings(orgId, {
      lastTestStatus: result.success ? "success" : "failed",
      lastTestAt: new Date(),
      lastTestError: result.error || null,
    } as any);

    log(result.success ? "info" : "warn", "Test email sent", {
      orgId,
      recipient: recipientEmail,
      success: result.success,
    });

    return result;
  }

  private buildEmailConfig(settings: AlertSettingsRaw): EmailConfig {
    return {
      provider: (settings.provider || "sendgrid") as "sendgrid" | "smtp" | "ses",
      sendgridApiKey: settings.apiKeyEncrypted || undefined,
      smtpHost: settings.smtpHost || undefined,
      smtpPort: settings.smtpPort || 587,
      smtpUser: settings.smtpUser || undefined,
      smtpPassword: settings.smtpEncryptedPassword || undefined,
      smtpUseTls: settings.smtpUseTls ?? true,
      fromEmail: settings.fromEmail || "noreply@arus-marine.com",
      fromName: settings.fromName || "ARUS Marine",
    };
  }

  async getVesselSettings(orgId: string, vesselId: string): Promise<AlertSettingsVessel | null> {
    const settings = await alertSettingsRepository.getVesselSettings(orgId, vesselId);
    return settings || null;
  }

  async getAllVesselSettings(orgId: string): Promise<AlertSettingsVessel[]> {
    return alertSettingsRepository.getAllVesselSettings(orgId);
  }

  async updateVesselSettings(
    orgId: string,
    vesselId: string,
    data: Partial<InsertAlertSettingsVessel>
  ): Promise<AlertSettingsVessel> {
    const settings = await alertSettingsRepository.upsertVesselSettings(orgId, vesselId, data);
    log("info", "Vessel alert settings updated", { orgId, vesselId });
    return settings;
  }

  async deleteVesselSettings(orgId: string, vesselId: string): Promise<void> {
    await alertSettingsRepository.deleteVesselSettings(orgId, vesselId);
    log("info", "Vessel alert settings deleted", { orgId, vesselId });
  }

  async getThresholds(orgId: string, category?: string): Promise<AlertThreshold[]> {
    return alertSettingsRepository.getThresholds(orgId, category);
  }

  async updateThreshold(
    orgId: string,
    key: string,
    data: Partial<InsertAlertThreshold>
  ): Promise<AlertThreshold> {
    const threshold = await alertSettingsRepository.upsertThreshold(orgId, key, data);
    log("info", "Alert threshold updated", { orgId, key });
    return threshold;
  }

  async deleteThreshold(orgId: string, key: string): Promise<void> {
    await alertSettingsRepository.deleteThreshold(orgId, key);
    log("info", "Alert threshold deleted", { orgId, key });
  }

  async getEmailLogs(
    orgId: string,
    options?: {
      vesselId?: string;
      alertType?: string;
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<AlertEmailLog[]> {
    return alertSettingsRepository.getEmailLogs(orgId, options);
  }

  async getCrewAlertSettings(orgId: string, vesselId?: string): Promise<CrewAlertSettings | null> {
    const settings = await alertSettingsRepository.getCrewAlertSettings(orgId, vesselId);
    return settings || null;
  }

  async getAllCrewAlertSettings(orgId: string): Promise<CrewAlertSettings[]> {
    return alertSettingsRepository.getAllCrewAlertSettings(orgId);
  }

  async updateCrewAlertSettings(
    orgId: string,
    vesselId: string | null,
    data: Partial<InsertCrewAlertSettings>
  ): Promise<CrewAlertSettings> {
    const settings = await alertSettingsRepository.upsertCrewAlertSettings(orgId, vesselId, data);
    log("info", "Crew alert settings updated", { orgId, vesselId: vesselId || "global" });
    return settings;
  }

  async shouldSendAlert(
    orgId: string,
    alertType: string,
    alertKey: string,
    vesselId?: string,
    entityId?: string
  ): Promise<{ shouldSend: boolean; cooldownId?: string; minutesRemaining?: number }> {
    const settings = await alertSettingsRepository.getOrgSettings(orgId);
    const cooldownMinutes = settings?.alertCooldownMinutes ?? 30;

    const existing: any = await (alertSettingsRepository as any).checkCooldown(
      orgId,
      alertType,
      alertKey,
      vesselId,
      entityId
    );

    if (!existing) {
      return { shouldSend: true };
    }

    const now = new Date();
    const lastAlert = new Date(existing.lastAlertAt);
    const elapsedMinutes = (now.getTime() - lastAlert.getTime()) / (1000 * 60);

    if (elapsedMinutes >= cooldownMinutes) {
      return { shouldSend: true, cooldownId: existing.id };
    }

    return {
      shouldSend: false,
      cooldownId: existing.id,
      minutesRemaining: Math.ceil(cooldownMinutes - elapsedMinutes),
    };
  }

  async recordAlertSent(
    orgId: string,
    alertType: string,
    alertKey: string,
    vesselId?: string,
    entityId?: string,
    emailSent: boolean = false
  ): Promise<void> {
    const cooldown: any = await (alertSettingsRepository as any).getCooldown(
      orgId,
      alertType,
      alertKey,
      vesselId,
      entityId
    );

    if (emailSent && cooldown) {
      await alertSettingsRepository.recordEmailSent(cooldown.id);
    }
  }

  async cleanupCooldowns(hoursOld: number = 24): Promise<number> {
    return alertSettingsRepository.cleanupExpiredCooldowns(hoursOld);
  }
}

export const alertSettingsService = new AlertSettingsService();
