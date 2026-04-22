/**
 * Email Notification - Logger Utilities
 */

import type { RetryConfig } from "./types.js";
import { cryptoRandom } from "@shared/crypto-random";

type LogLevel = "info" | "warn" | "error";
const logOutputs: Record<LogLevel, (msg: string) => void> = {
  error: (msg) => console.error(msg),
  warn: (msg) => console.warn(msg),
  info: (msg) => console.log(msg),
};

export function log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
  const timestamp = new Date().toISOString();
  const prefix = `[EmailNotification]`;
  const contextStr = Object.entries(context)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" ");
  logOutputs[level](`${timestamp} ${prefix} ${message} ${contextStr}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
  const jitter = cryptoRandom() * 0.3 * delay;
  return Math.round(delay + jitter);
}
