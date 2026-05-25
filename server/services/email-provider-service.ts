/**
 * Multi-Provider Email Service
 *
 * Supports SendGrid, SMTP, and AWS SES for sending emails.
 * Uses per-organization settings from the database with encrypted credentials.
 */

import { createTransport, Transporter } from "nodemailer";
import { decryptSecret } from "../lib/crypto-service";

export type EmailProvider = "sendgrid" | "smtp" | "ses";

export interface EmailConfig {
  provider: EmailProvider;
  sendgridApiKey?: string | undefined;
  smtpHost?: string | undefined;
  smtpPort?: number | undefined;
  smtpUser?: string | undefined;
  smtpPassword?: string | undefined;
  smtpUseTls?: boolean | undefined;
  sesAccessKeyId?: string | undefined;
  sesSecretAccessKey?: string | undefined;
  sesRegion?: string | undefined;
  fromEmail: string;
  fromName?: string | undefined;
}

export interface EmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retriable?: boolean;
  provider?: EmailProvider;
}

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

type LogLevel = "info" | "warn" | "error";
const logOutputs: Record<LogLevel, (msg: string) => void> = {
  error: (msg) => console.error(msg),
  warn: (msg) => console.warn(msg),
  info: (msg) => console.log(msg),
};

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  const timestamp = new Date().toISOString();
  const prefix = `[EmailProvider]`;
  const contextStr = Object.entries(context)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" ");
  logOutputs[level](`${timestamp} ${prefix} ${message} ${contextStr}`);
}

class EmailProviderService {
  private smtpTransporters: Map<string, Transporter> = new Map();

  private readonly providerHandlers: Record<
    EmailProvider,
    (config: EmailConfig, payload: EmailPayload) => Promise<SendResult>
  > = {
    sendgrid: (config, payload) => this.sendViaSendGrid(config, payload),
    smtp: (config, payload) => this.sendViaSmtp(config, payload),
    ses: (config, payload) => this.sendViaSes(config, payload),
  };

  async sendEmail(config: EmailConfig, payload: EmailPayload): Promise<SendResult> {
    const handler = this.providerHandlers[config.provider];
    if (!handler) {
      return { success: false, error: `Unsupported provider: ${config.provider}` };
    }
    return handler(config, payload);
  }

  private async sendViaSendGrid(config: EmailConfig, payload: EmailPayload): Promise<SendResult> {
    const apiKey = config.sendgridApiKey;
    if (!apiKey) {
      return { success: false, error: "SendGrid API key not configured" };
    }

    const decryptedKey = decryptSecret(apiKey);

    try {
      const personalizations: {
        to: Array<{ email: string }>;
        cc?: Array<{ email: string }>;
        bcc?: Array<{ email: string }>;
        dynamic_template_data?: Record<string, unknown>;
      } = {
        to: payload.to.map((email) => ({ email })),
      };

      if (payload.cc?.length) {
        personalizations.cc = payload.cc.map((email) => ({ email }));
      }

      if (payload.bcc?.length) {
        personalizations.bcc = payload.bcc.map((email) => ({ email }));
      }

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${decryptedKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [personalizations],
          from: {
            email: config.fromEmail,
            name: config.fromName || "ARUS Marine",
          },
          reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
          subject: payload.subject,
          content: [
            { type: "text/plain", value: payload.text },
            ...(payload.html ? [{ type: "text/html", value: payload.html }] : []),
          ],
        }),
      });

      if (response.ok) {
        const messageId = response.headers.get("x-message-id") || `sg-${Date.now()}`;
        log("info", "Email sent via SendGrid", { messageId, recipients: payload.to.length });
        return { success: true, messageId, provider: "sendgrid" };
      }
      const errorText = await response.text();
      const isRetriable = RETRYABLE_STATUS_CODES.includes(response.status);
      log("warn", "SendGrid API error", { status: response.status, retriable: isRetriable });
      return {
        success: false,
        error: `SendGrid error: ${response.status} - ${errorText}`,
        retriable: isRetriable,
        provider: "sendgrid",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("network");
      log("error", "SendGrid exception", { error: errorMessage, retriable: isNetworkError });
      return {
        success: false,
        error: errorMessage,
        retriable: isNetworkError,
        provider: "sendgrid",
      };
    }
  }

  private async sendViaSmtp(config: EmailConfig, payload: EmailPayload): Promise<SendResult> {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpUseTls } = config;

    if (!smtpHost) {
      return { success: false, error: "SMTP host not configured" };
    }

    const transporterKey = `${smtpHost}:${smtpPort}:${smtpUser}`;
    let transporter = this.smtpTransporters.get(transporterKey);

    if (!transporter) {
      const decryptedPassword = smtpPassword ? decryptSecret(smtpPassword) : undefined;

      transporter = createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpUseTls !== false && smtpPort === 465,
        auth:
          smtpUser && decryptedPassword
            ? {
                user: smtpUser,
                pass: decryptedPassword,
              }
            : undefined,
        tls:
          smtpUseTls !== false
            ? {
                rejectUnauthorized: true,
              }
            : undefined,
      });

      this.smtpTransporters.set(transporterKey, transporter);
    }

    try {
      const info = await transporter.sendMail({
        from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
        to: payload.to.join(", "),
        cc: payload.cc?.join(", "),
        bcc: payload.bcc?.join(", "),
        replyTo: payload.replyTo,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      log("info", "Email sent via SMTP", {
        messageId: info.messageId,
        recipients: payload.to.length,
      });
      return { success: true, messageId: info.messageId, provider: "smtp" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isRetriable =
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ENOTFOUND");
      log("error", "SMTP error", { error: errorMessage, retriable: isRetriable });

      this.smtpTransporters.delete(transporterKey);

      return {
        success: false,
        error: errorMessage,
        retriable: isRetriable,
        provider: "smtp",
      };
    }
  }

  private async sendViaSes(config: EmailConfig, payload: EmailPayload): Promise<SendResult> {
    const { sesAccessKeyId, sesSecretAccessKey, sesRegion } = config;

    if (!sesAccessKeyId || !sesSecretAccessKey) {
      return { success: false, error: "AWS SES credentials not configured" };
    }

    const decryptedAccessKey = decryptSecret(sesAccessKeyId);
    const decryptedSecretKey = decryptSecret(sesSecretAccessKey);
    const region = sesRegion || "us-east-1";

    try {
      // NOSONAR: S5332 - secure:false is correct for port 587 (STARTTLS)
      // AWS SES SMTP uses STARTTLS which upgrades the connection after initial handshake
      const transporter = createTransport({
        host: `email-smtp.${region}.amazonaws.com`,
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: decryptedAccessKey,
          pass: decryptedSecretKey,
        },
      });

      const info = await transporter.sendMail({
        from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
        to: payload.to.join(", "),
        cc: payload.cc?.join(", "),
        bcc: payload.bcc?.join(", "),
        replyTo: payload.replyTo,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      log("info", "Email sent via SES", {
        messageId: info.messageId,
        recipients: payload.to.length,
      });
      return { success: true, messageId: info.messageId, provider: "ses" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isRetriable =
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("throttl");
      log("error", "SES error", { error: errorMessage, retriable: isRetriable });
      return {
        success: false,
        error: errorMessage,
        retriable: isRetriable,
        provider: "ses",
      };
    }
  }

  async testConnection(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
    const { provider } = config;

    switch (provider) {
      case "sendgrid": {
        const apiKey = config.sendgridApiKey;
        if (!apiKey) {
          return { success: false, error: "SendGrid API key not configured" };
        }
        const decryptedKey = decryptSecret(apiKey);
        try {
          const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
            headers: { Authorization: `Bearer ${decryptedKey}` },
          });
          if (response.ok) {
            return { success: true };
          }
          return { success: false, error: `SendGrid API error: ${response.status}` };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
          };
        }
      }

      case "smtp": {
        const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpUseTls } = config;
        if (!smtpHost) {
          return { success: false, error: "SMTP host not configured" };
        }

        const decryptedPassword = smtpPassword ? decryptSecret(smtpPassword) : undefined;

        try {
          const transporter = createTransport({
            host: smtpHost,
            port: smtpPort || 587,
            secure: smtpUseTls !== false && smtpPort === 465,
            auth:
              smtpUser && decryptedPassword
                ? {
                    user: smtpUser,
                    pass: decryptedPassword,
                  }
                : undefined,
          });

          await transporter.verify();
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
          };
        }
      }

      case "ses": {
        const { sesAccessKeyId, sesSecretAccessKey, sesRegion } = config;
        if (!sesAccessKeyId || !sesSecretAccessKey) {
          return { success: false, error: "AWS SES credentials not configured" };
        }

        const decryptedAccessKey = decryptSecret(sesAccessKeyId);
        const decryptedSecretKey = decryptSecret(sesSecretAccessKey);
        const region = sesRegion || "us-east-1";

        try {
          // NOSONAR: S5332 - secure:false is correct for port 587 (STARTTLS)
          // AWS SES SMTP uses STARTTLS which upgrades the connection after initial handshake
          const transporter = createTransport({
            host: `email-smtp.${region}.amazonaws.com`,
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
              user: decryptedAccessKey,
              pass: decryptedSecretKey,
            },
          });

          await transporter.verify();
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
          };
        }
      }

      default:
        return { success: false, error: `Unsupported provider: ${provider}` };
    }
  }
}

export const emailProviderService = new EmailProviderService();
