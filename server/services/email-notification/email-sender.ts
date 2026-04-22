/**
 * Email Notification - Email Sending Logic
 */

import type { EmailPayload, SendResult, RetryConfig } from "./types.js";
import { RETRYABLE_STATUS_CODES, DEFAULT_RETRY_CONFIG } from "./types.js";
import { log } from "./logger.js";

export class EmailSender {
  private sendGridApiKey: string | null = null;
  private fromEmail: string = "noreply@arus-marine.com";
  private emailEnabled: boolean = false;
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.sendGridApiKey = process.env.SENDGRID_API_KEY || null;
    this.fromEmail = process.env.EMAIL_FROM || "noreply@arus-marine.com";
    this.emailEnabled = !!this.sendGridApiKey;

    if (this.emailEnabled) {
      log("info", "Initialized with SendGrid");
    } else {
      log("info", "Running in development mode (logging only)");
    }
  }

  async sendEmail(payload: EmailPayload): Promise<SendResult> {
    return this.sendEmailAttempt(payload, 0);
  }

  private async sendEmailAttempt(payload: EmailPayload, attempt: number): Promise<SendResult> {
    if (!this.emailEnabled || !this.sendGridApiKey) {
      log("info", "DEV MODE - Would send email", {
        recipients: payload.to.length,
        subject: payload.subject,
      });
      return { success: true, messageId: `dev-${Date.now()}` };
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sendGridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: payload.to.map((email) => ({ email })) }],
          from: { email: this.fromEmail },
          subject: payload.subject,
          content: [
            { type: "text/plain", value: payload.text },
            ...(payload.html ? [{ type: "text/html", value: payload.html }] : []),
          ],
        }),
      });

      if (response.ok) {
        const messageId = response.headers.get("x-message-id") || `sg-${Date.now()}`;
        log("info", "Email sent successfully", { messageId, recipients: payload.to.length });
        return { success: true, messageId };
      }
      const isRetriable = RETRYABLE_STATUS_CODES.includes(response.status);
      log("warn", "SendGrid API error", {
        status: response.status,
        retriable: isRetriable,
        attempt,
      });
      return {
        success: false,
        error: `SendGrid error: ${response.status}`,
        retriable: isRetriable,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isNetworkError =
        errorMessage.includes("fetch") ||
        errorMessage.includes("network") ||
        errorMessage.includes("ECONNREFUSED");
      log("error", "Email send exception", {
        error: errorMessage,
        retriable: isNetworkError,
        attempt,
      });
      return {
        success: false,
        error: errorMessage,
        retriable: isNetworkError,
      };
    }
  }

  async sendWithAttachment(
    to: string,
    subject: string,
    text: string,
    html: string,
    attachment: { filename: string; content: Buffer; contentType: string }
  ): Promise<SendResult> {
    if (!this.emailEnabled || !this.sendGridApiKey) {
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
          Authorization: `Bearer ${this.sendGridApiKey}`,
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
    return this.emailEnabled;
  }

  getStatus(): { enabled: boolean; provider: string } {
    return {
      enabled: this.emailEnabled,
      provider: this.emailEnabled ? "sendgrid" : "development",
    };
  }
}

export const emailSender = new EmailSender();
