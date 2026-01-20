/**
 * Engine Log Auto-Fill - Logging Utilities
 * Structured logging for auto-fill operations
 */

import type { LogContext } from "./types.js";

type LogLevel = 'info' | 'warn' | 'error';
const logOutputs: Record<LogLevel, (msg: string) => void> = {
  error: (msg) => console.error(msg),
  warn: (msg) => console.warn(msg),
  info: (msg) => console.log(msg),
};

export function log(
  level: LogLevel,
  message: string,
  context: Partial<LogContext> & Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const prefix = `[EngineLog:AutoFill]`;
  const contextStr = Object.entries(context)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
  logOutputs[level](`${timestamp} ${prefix} ${message} ${contextStr}`);
}
