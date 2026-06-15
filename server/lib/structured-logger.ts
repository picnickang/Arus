/**
 * Structured Logger
 *
 * SonarQube Fix: Replace scattered console.log/warn/error calls with structured logging
 * Provides consistent log format, levels, and context for observability
 *
 * Correlation IDs: When called inside an HTTP request, automatically enriches
 * every log entry with `correlationId` (and optionally `requestId`/`orgId`/`userId`)
 * pulled from the AsyncLocalStorage-backed request context. Outside a request
 * (boot, schedulers, CLI), no correlation fields are added.
 */

import { getRequestContext as defaultGetRequestContext } from "../utils/correlation-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Correlation provider — returns the active request context, or undefined.
 * Defaults to the AsyncLocalStorage-backed `getRequestContext` from
 * `server/utils/correlation-context`. Tests can pass a custom provider to
 * `createLogger` to avoid relying on async storage propagation.
 */
export type CorrelationProvider = () =>
  | {
      correlationId?: string | undefined;
      requestId?: string | undefined;
      orgId?: string | undefined;
      userId?: string | undefined;
    }
  | undefined;

const defaultProvider: CorrelationProvider = () => defaultGetRequestContext();

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  domain: string;
  message: string;
  correlationId?: string | undefined;
  requestId?: string | undefined;
  orgId?: string | undefined;
  userId?: string | undefined;
  context?: LogContext | undefined;
  error?:
    | {
        name: string;
        message: string;
        stack?: string | undefined;
      }
    | undefined;
}

/**
 * Pull correlation/identity fields off the active request context (if any).
 * Returns an empty object outside request scope so boot/scheduler code is unaffected.
 *
 * Wrapped in try/catch so a misconfigured AsyncLocalStorage cannot bring down
 * logging — observability must always be safer than the thing it observes.
 */
function getCorrelationFields(provider: CorrelationProvider): {
  correlationId?: string | undefined;
  requestId?: string | undefined;
  orgId?: string | undefined;
  userId?: string | undefined;
} {
  try {
    const ctx = provider();
    if (!ctx) {
      return {};
    }
    const fields: {
      correlationId?: string | undefined;
      requestId?: string | undefined;
      orgId?: string | undefined;
      userId?: string | undefined;
    } = {};
    if (ctx.correlationId) {
      fields.correlationId = ctx.correlationId;
    }
    if (ctx.requestId && ctx.requestId !== ctx.correlationId) {
      fields.requestId = ctx.requestId;
    }
    if (ctx.orgId) {
      fields.orgId = ctx.orgId;
    }
    if (ctx.userId) {
      fields.userId = ctx.userId;
    }
    return fields;
  } catch {
    return {};
  }
}

/** Log level priority for filtering */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Get minimum log level from environment */
function getMinLevel(): LogLevel {
  const envLevel = process.env["LOG_LEVEL"]?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return process.env["NODE_ENV"] === "production" ? "info" : "debug";
}

/** Check if log should be output based on level */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

/** Format timestamp in ISO format */
function getTimestamp(): string {
  return new Date().toISOString();
}

/** Format error for logging */
function formatError(error: unknown): LogEntry["error"] | undefined {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env["NODE_ENV"] === "development" ? error.stack : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

/** Get console function based on log level */
function getLogFunction(level: LogLevel): typeof console.log {
  if (level === "error") {
    return console.error;
  }
  if (level === "warn") {
    return console.warn;
  }
  return console.log;
}

/** Output log entry to console — exported for unit testing of formatting only. */
export function outputLog(entry: LogEntry): void {
  const {
    timestamp,
    level,
    domain,
    message,
    correlationId,
    requestId,
    orgId,
    userId,
    context,
    error,
  } = entry;

  const correlationTag = correlationId ? ` [${correlationId.slice(0, 8)}]` : "";
  const prefix = `[${level.toUpperCase()}] ${timestamp} [${domain}]${correlationTag}`;
  const logFn = getLogFunction(level);

  // User-provided context comes first so correlation fields and the error
  // object — which are authoritative — cannot be spoofed by a caller who
  // accidentally (or maliciously) passes e.g. `correlationId` in `context`.
  const meta: Record<string, unknown> = {};
  if (context) {
    Object.assign(meta, context);
  }
  if (correlationId) {
    meta["correlationId"] = correlationId;
  }
  if (requestId) {
    meta["requestId"] = requestId;
  }
  if (orgId) {
    meta["orgId"] = orgId;
  }
  if (userId) {
    meta["userId"] = userId;
  }
  if (error) {
    meta["error"] = error;
  }

  // Strip CR/LF in the caller-supplied message so it can't forge log lines (CWE-117).
  const safeMessage = String(message).replace(/\n/g, "").replace(/\r/g, "");
  if (Object.keys(meta).length > 0) {
    logFn(`${prefix} ${safeMessage}`, meta);
  } else {
    logFn(`${prefix} ${safeMessage}`);
  }
}

/**
 * Create a domain-specific logger.
 *
 * @param domain - The logger domain (appears in every log line)
 * @param correlationProvider - Optional override for correlation lookup. Defaults
 *   to the request-context provider. Tests pass a stub to verify enrichment
 *   without depending on AsyncLocalStorage propagation across modules.
 *
 * @example
 * const logger = createLogger("AuthService");
 * logger.info("User logged in", { userId: "123" });
 * logger.error("Login failed", { userId: "123" }, error);
 */
export function createLogger(
  domain: string,
  correlationProvider: CorrelationProvider = defaultProvider
) {
  const log = (level: LogLevel, message: string, context?: LogContext, error?: unknown): void => {
    if (!shouldLog(level)) {
      return;
    }

    const correlation = getCorrelationFields(correlationProvider);

    const entry: LogEntry = {
      timestamp: getTimestamp(),
      level,
      domain,
      message,
      ...correlation,
      context,
      error: formatError(error),
    };

    outputLog(entry);
  };

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext, error?: unknown) =>
      log("warn", message, context, error),
    error: (message: string, context?: LogContext, error?: unknown) =>
      log("error", message, context, error),

    /** Log with explicit level */
    log,

    /** Create child logger with additional context */
    child: (childContext: LogContext) => {
      const childLog = (
        level: LogLevel,
        message: string,
        context?: LogContext,
        error?: unknown
      ) => {
        log(level, message, { ...childContext, ...context }, error);
      };

      return {
        debug: (message: string, context?: LogContext) => childLog("debug", message, context),
        info: (message: string, context?: LogContext) => childLog("info", message, context),
        warn: (message: string, context?: LogContext, error?: unknown) =>
          childLog("warn", message, context, error),
        error: (message: string, context?: LogContext, error?: unknown) =>
          childLog("error", message, context, error),
      };
    },
  };
}

/** Pre-configured loggers for common domains */
export const loggers = {
  security: createLogger("Security"),
  auth: createLogger("Auth"),
  api: createLogger("API"),
  db: createLogger("Database"),
  cache: createLogger("Cache"),
  queue: createLogger("Queue"),
  ml: createLogger("ML"),
  telemetry: createLogger("Telemetry"),
} as const;

/** Convenience function for quick logging without creating a logger */
export function log(level: LogLevel, domain: string, message: string, context?: LogContext): void {
  createLogger(domain).log(level, message, context);
}
