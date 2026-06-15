/**
 * Email Notification - Types and Configuration
 */

export interface CrewNotificationCheck {
  enabled: boolean;
  email: string | null;
  overrideEmail: string | null;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailPayload {
  to: string[];
  subject: string;
  text: string;
  html?: string | undefined;
  attachments?: EmailAttachment[] | undefined;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retriable?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

export const SEVERITY_LEVELS: Record<string, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export const SEVERITY_COLORS: Record<string, string> = {
  info: "#3b82f6",
  warning: "#f59e0b",
  critical: "#ef4444",
};
