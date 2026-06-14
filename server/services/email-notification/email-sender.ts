/**
 * Email Notification - Email Sending Logic
 *
 * Orchestrates the notification_queue / crew / scheduler send path on top of the
 * multi-provider emailProviderService:
 *   1. Per-org provider from alert_settings (SendGrid/SMTP/SES) when configured.
 *   2. Global env SendGrid (SENDGRID_API_KEY) as the default.
 *   3. Dev mode (log only) when neither is configured.
 *
 * sendWithAttachment stays on the env SendGrid path because emailProviderService
 * has no attachment support yet.
 */

import type { EmailPayload, SendResult, RetryConfig } from "./types.js";
import { DEFAULT_RETRY_CONFIG } from "./types.js";
import { log } from "./logger.js";
import {
  emailProviderService,
  type EmailConfig,
  type EmailPayload as ProviderEmailPayload,
} from "../email-provider-service.js";
import { alertSettingsService } from "../../domains/alerts/settings-service.js";

export class EmailSender {
  private envSendGridKey: string | null = null;
  private fromEmail: string = "noreply@arus.io";
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

  constructor() {
    this.envSendGridKey = process.env["SENDGRID_API_KEY"] || null;
    this.fromEmail = process.env["EMAIL_FROM"] || "noreply@arus.io";

    if (this.envSendGridKey) {
      log("info", "Initialized with SendGrid (env key)");
    } else {
      log("info", "No SENDGRID_API_KEY; using per-org providers or dev mode");
    }
  }

  /**
   * Send a notification email. When `orgId` is supplied and that org has a
   * configured provider, it is used; otherwise we fall back to the global env
   * SendGrid key, and finally to dev mode (log only).
   */
  async sendEmail(payload: EmailPayload, orgId?: string): Promise<SendResult> {
    if (orgId) {
      const viaOrg = await this.trySendViaOrgProvider(orgId, payload);
      if (viaOrg) {
        return viaOrg;
      }
    }

    if (this.envSendGridKey) {
      return emailProviderService.sendEmail(
        this.envSendGridConfig(),
        this.toProviderPayload(payload)
      );
    }

    log("info", "DEV MODE - Would send email", {
      recipients: payload.to.length,
      subject: payload.subject,
    });
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  private async trySendViaOrgProvider(
    orgId: string,
    payload: EmailPayload
  ): Promise<SendResult | null> {
    try {
      const config = await alertSettingsService.resolveOrgEmailConfig(orgId);
      if (!config) {
        return null;
      }
      return await emailProviderService.sendEmail(config, this.toProviderPayload(payload));
    } catch (error) {
      log("warn", "Org email provider failed; falling back to env/dev", {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private envSendGridConfig(): EmailConfig {
    return {
      provider: "sendgrid",
      sendgridApiKey: this.envSendGridKey ?? undefined,
      fromEmail: this.fromEmail,
      fromName: "ARUS Marine",
    };
  }

  private toProviderPayload(payload: EmailPayload): ProviderEmailPayload {
    // Build conditionally so `html` is omitted (not set to undefined) when
    // absent — required under exactOptionalPropertyTypes.
    const out: ProviderEmailPayload = {
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    };
    if (payload.html !== undefined) {
      out.html = payload.html;
    }
    return out;
  }

  async sendWithAttachment(
    to: string,
    subject: string,
    text: string,
    html: string,
    attachment: { filename: string; content: Buffer; contentType: string }
  ): Promise<SendResult> {
    if (!this.envSendGridKey) {
      log("info", "DEV MODE - Would send email with attachment", {
        to,
        subject,
        filename: attachment.filename,
        size: attachment.content.length,
      });
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.envSendGridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: this.fromEmail },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ],
          attachments: [
            {
              content: attachment.content.toString("base64"),
              filename: attachment.filename,
              type: attachment.contentType,
              disposition: "attachment",
            },
          ],
        }),
      });

      if (response.ok) {
        const messageId = response.headers.get("x-message-id") || `sg-${Date.now()}`;
        log("info", "Email with attachment sent successfully", { messageId, to });
        return { success: true, messageId };
      }

      log("warn", "SendGrid API error (attachment)", { status: response.status });
      return { success: false, error: `SendGrid error: ${response.status}`, retriable: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log("error", "Email send with attachment exception", { error: errorMessage });
      return { success: false, error: errorMessage, retriable: false };
    }
  }

  getRetryConfig(): RetryConfig {
    return this.retryConfig;
  }

  isEnabled(): boolean {
    return !!this.envSendGridKey;
  }

  /**
   * Coarse, org-agnostic status: reflects the global env SendGrid key only.
   * Used as the fallback for getStatusForOrg.
   */
  getStatus(): { enabled: boolean; provider: string } {
    return {
      enabled: !!this.envSendGridKey,
      provider: this.envSendGridKey ? "sendgrid" : "development",
    };
  }

  /**
   * Org-aware status for the /email/status endpoint. Mirrors the send
   * resolution: reports the org's configured provider when available, otherwise
   * the global env SendGrid key, otherwise dev-mode. Falls back to the env/dev
   * status when org config resolution fails (e.g. settings unavailable).
   */
  async getStatusForOrg(orgId: string): Promise<{ enabled: boolean; provider: string }> {
    try {
      const orgConfig = await alertSettingsService.resolveOrgEmailConfig(orgId);
      if (orgConfig) {
        return { enabled: true, provider: orgConfig.provider };
      }
    } catch (error) {
      log("warn", "Org email status resolution failed; using env/dev status", {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return this.getStatus();
  }
}

export const emailSender = new EmailSender();
