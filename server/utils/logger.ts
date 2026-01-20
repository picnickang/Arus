/**
 * Context-Aware Logger
 * Provides proper log levels and deployment-mode-aware filtering
 * to reduce noise and highlight actual errors
 * 
 * Includes correlation ID support for distributed tracing
 */

import { getCorrelationId } from "./correlation-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  level: LogLevel;
  isEmbedded: boolean;
  isLocalMode: boolean;
  includeCorrelationId: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;

  constructor() {
    const isEmbedded = process.env.DEPLOYMENT_MODE === "VESSEL" || process.env.IS_EMBEDDED === "true";
    const isLocalMode = !process.env.DATABASE_URL;
    
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "development" ? "debug" : "info"),
      isEmbedded,
      isLocalMode,
      includeCorrelationId: process.env.LOG_CORRELATION_ID !== "false",
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, module: string, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    
    if (this.config.includeCorrelationId) {
      const correlationId = getCorrelationId();
      if (correlationId && correlationId !== "no-context") {
        const shortId = correlationId.slice(0, 8);
        return `[${levelStr}] ${timestamp} [${module}] [${shortId}] ${message}`;
      }
    }
    
    return `[${levelStr}] ${timestamp} [${module}] ${message}`;
  }

  debug(module: string, message: string, data?: unknown) {
    if (!this.shouldLog("debug")) { return; }
    console.log(this.formatMessage("debug", module, message), data ?? "");
  }

  info(module: string, message: string, data?: unknown) {
    if (!this.shouldLog("info")) { return; }
    console.log(this.formatMessage("info", module, message), data ?? "");
  }

  /**
   * Warning for unexpected but non-critical issues
   * Suppresses expected warnings in embedded/offline mode
   */
  warn(module: string, message: string, data?: unknown, suppressInEmbedded = false) {
    if (!this.shouldLog("warn")) { return; }
    
    // Suppress expected warnings in embedded mode
    if (suppressInEmbedded && this.config.isEmbedded) {
      this.debug(module, `[Suppressed] ${message}`, data);
      return;
    }
    
    console.warn(this.formatMessage("warn", module, message), data ?? "");
  }

  /**
   * Error for actual failures requiring attention
   */
  error(module: string, message: string, error?: unknown) {
    if (!this.shouldLog("error")) { return; }
    console.error(this.formatMessage("error", module, message));
    if (error) {
      if (error instanceof Error) {
        console.error(`  ${error.message}`);
        if (error.stack && process.env.NODE_ENV === "development") {
          console.error(error.stack);
        }
      } else {
        console.error(error);
      }
    }
  }

  /**
   * Expected limitation notices (like missing optional features)
   * Only shown in verbose mode, not logged as errors
   */
  notice(module: string, message: string, details?: string[]) {
    // Only show in development or when explicitly requested
    if (process.env.NODE_ENV === "production" && process.env.LOG_LEVEL !== "debug") {
      return;
    }

    console.log(`ℹ️  ${module}: ${message}`);
    if (details) {
      details.forEach(detail => console.log(`   ${detail}`));
    }
  }

  /**
   * Success/completion messages
   */
  success(module: string, message: string) {
    if (!this.shouldLog("info")) { return; }
    console.log(`✓ ${module}: ${message}`);
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Helper for deployment-mode-aware logging
 * Automatically suppresses expected warnings in embedded/vessel mode
 */
export function logDeploymentInfo(module: string, message: string, isOptional = false) {
  if (isOptional) {
    logger.notice(module, message);
  } else {
    logger.info(module, message);
  }
}

/**
 * Helper for expected failures in embedded mode (like sync not available)
 */
export function logExpectedLimitation(module: string, message: string, details?: string[]) {
  const isEmbedded = process.env.DEPLOYMENT_MODE === "VESSEL" || process.env.IS_EMBEDDED === "true";
  
  if (isEmbedded) {
    // In embedded mode, this is expected - log as notice only
    logger.notice(module, message, details);
  } else {
    // In cloud mode, this might be a configuration issue - log as warning
    logger.warn(module, message, details ? details.join("\n") : undefined);
  }
}
