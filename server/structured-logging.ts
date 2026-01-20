// Stub file - structured logging consolidated into logging.ts
export interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
}

export function createLogEntry(level: string, message: string, context?: LogContext) {
  return { level, message, context, timestamp: new Date().toISOString() };
}

export function getCorrelationId(): string {
  return crypto.randomUUID();
}
