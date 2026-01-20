/**
 * Structured Logger
 * 
 * SonarQube Fix: Replace scattered console.log/warn/error calls with structured logging
 * Provides consistent log format, levels, and context for observability
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  domain: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
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
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
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
  if (!error) {return undefined;}
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
  
  return {
    name: "UnknownError",
    message: String(error),
  };
}

/** Get console function based on log level */
function getLogFunction(level: LogLevel): typeof console.log {
  if (level === "error") {return console.error;}
  if (level === "warn") {return console.warn;}
  return console.log;
}

/** Output log entry to console */
function outputLog(entry: LogEntry): void {
  const { timestamp, level, domain, message, context, error } = entry;
  
  const prefix = `[${level.toUpperCase()}] ${timestamp} [${domain}]`;
  const logFn = getLogFunction(level);
  
  if (context || error) {
    logFn(`${prefix} ${message}`, { ...(context || {}), ...(error ? { error } : {}) });
  } else {
    logFn(`${prefix} ${message}`);
  }
}

/**
 * Create a domain-specific logger
 * 
 * @example
 * const logger = createLogger("AuthService");
 * logger.info("User logged in", { userId: "123" });
 * logger.error("Login failed", { userId: "123" }, error);
 */
export function createLogger(domain: string) {
  const log = (level: LogLevel, message: string, context?: LogContext, error?: unknown): void => {
    if (!shouldLog(level)) {return;}
    
    const entry: LogEntry = {
      timestamp: getTimestamp(),
      level,
      domain,
      message,
      context,
      error: formatError(error),
    };
    
    outputLog(entry);
  };

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext, error?: unknown) => log("warn", message, context, error),
    error: (message: string, context?: LogContext, error?: unknown) => log("error", message, context, error),
    
    /** Log with explicit level */
    log,
    
    /** Create child logger with additional context */
    child: (childContext: LogContext) => {
      const childLog = (level: LogLevel, message: string, context?: LogContext, error?: unknown) => {
        log(level, message, { ...childContext, ...context }, error);
      };
      
      return {
        debug: (message: string, context?: LogContext) => childLog("debug", message, context),
        info: (message: string, context?: LogContext) => childLog("info", message, context),
        warn: (message: string, context?: LogContext, error?: unknown) => childLog("warn", message, context, error),
        error: (message: string, context?: LogContext, error?: unknown) => childLog("error", message, context, error),
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
