/**
 * Shared logging utilities to prevent circular dependencies
 * between server/observability.ts and server/error-handling.ts
 * 
 * Phase 3 Enhancements:
 * - Correlation IDs for request tracing (AsyncLocalStorage for concurrency safety)
 * - Org scoping for multi-tenant isolation
 * - Sensitive field redaction for security
 */

import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

export interface LogContext {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  service: string;
  version?: string;
  requestId?: string;
  correlationId?: string;
  orgId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

// Request-scoped context using AsyncLocalStorage (concurrency-safe)
interface RequestContext {
  correlationId: string;
  orgId?: string;
  requestId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// Sensitive fields that should be redacted in logs
const SENSITIVE_FIELDS = new Set([
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "auth",
  "credential",
  "private",
  "ssn",
  "creditCard",
  "credit_card",
  "cvv",
  "pin",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "sessionId",
  "session_id",
  "cookie",
  "jwt",
  "bearer",
  "x-api-key",
  "x-auth-token",
]);

/**
 * Generate a new correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return randomUUID().substring(0, 8);
}

/**
 * Run a function within a request context (use in middleware)
 * This ensures correlation ID and org context are properly scoped to the request
 */
export function runWithContext<T>(
  context: Partial<RequestContext>,
  fn: () => T
): T {
  const fullContext: RequestContext = {
    correlationId: context.correlationId || generateCorrelationId(),
    orgId: context.orgId,
    requestId: context.requestId,
  };
  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Get the current request context (safe for concurrent requests)
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current correlation ID (safe for concurrent requests)
 */
export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

/**
 * Get the current org context (safe for concurrent requests)
 */
export function getOrgContext(): string | undefined {
  return asyncLocalStorage.getStore()?.orgId;
}

/**
 * Update the org context within the current request (safe for concurrent requests)
 * If called outside of a request context (e.g., in background jobs), starts a new context
 */
export function setOrgContext(orgId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.orgId = orgId;
  }
  // If no store exists, we're outside of runWithContext - silently ignore
  // as this is expected for background jobs/cron that may run outside HTTP requests
}

/**
 * Wrap a function in logging context - for background jobs, cron, WebSocket handlers
 * Use this when the Express middleware cannot establish context (non-HTTP entry points)
 */
export function withLoggingContext<T>(
  context: { correlationId?: string; orgId?: string; requestId?: string },
  fn: () => T | Promise<T>
): T | Promise<T> {
  const fullContext: RequestContext = {
    correlationId: context.correlationId || generateCorrelationId(),
    orgId: context.orgId,
    requestId: context.requestId,
  };
  return asyncLocalStorage.run(fullContext, fn);
}

// Thread-local fallback for non-HTTP contexts (background jobs, cron, etc.)
// This is a best-effort fallback when AsyncLocalStorage context is not established
let fallbackCorrelationId: string | undefined;
let fallbackOrgId: string | undefined;

// Legacy compatibility functions with auto-bootstrap behavior
export function setCorrelationId(id: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    // If we're already in a context, update it
    (store as any).correlationId = id;
  } else {
    // Fallback for background workers: store in module-level variable
    // This provides best-effort correlation for single-threaded background jobs
    fallbackCorrelationId = id;
  }
}

export function clearLoggingContext(): void {
  // Clear fallback context (for background jobs)
  fallbackCorrelationId = undefined;
  fallbackOrgId = undefined;
}

/**
 * Internal: Get correlation ID with fallback support for background workers
 */
export function getCorrelationIdWithFallback(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId || fallbackCorrelationId;
}

/**
 * Internal: Get org ID with fallback support for background workers  
 */
export function getOrgContextWithFallback(): string | undefined {
  return asyncLocalStorage.getStore()?.orgId || fallbackOrgId;
}

/**
 * Set org context with fallback for background workers
 */
export function setOrgContextWithFallback(orgId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.orgId = orgId;
  } else {
    fallbackOrgId = orgId;
  }
}

/**
 * Redact sensitive fields from an object (deep)
 */
export function redactSensitiveFields<T>(obj: T, depth: number = 0): T {
  if (depth > 10) {return obj;} // Prevent infinite recursion
  if (obj === null || obj === undefined) {return obj;}
  if (typeof obj !== "object") {return obj;}

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item, depth + 1)) as unknown as T;
  }

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if the key matches any sensitive field pattern
    const isSensitive = SENSITIVE_FIELDS.has(lowerKey) ||
      Array.from(SENSITIVE_FIELDS).some(field => lowerKey.includes(field.toLowerCase()));

    if (isSensitive && typeof value === "string") {
      // Redact but show length hint
      redacted[key] = `[REDACTED:${value.length}chars]`;
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveFields(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  return redacted as T;
}

/**
 * Core structured logging function
 * Used by both observability.ts and error-handling.ts
 */
export function structuredLog(
  level: LogContext["level"],
  message: string,
  context: Partial<LogContext> = {}
) {
  // Get request context from AsyncLocalStorage with fallback for background workers
  const requestContext = getRequestContext();
  
  // Auto-populate correlation ID and org context from request context if not explicitly provided
  // Falls back to module-level variables for background workers
  const enrichedContext = {
    correlationId: context.correlationId || getCorrelationIdWithFallback() || undefined,
    orgId: context.orgId || getOrgContextWithFallback() || undefined,
    requestId: context.requestId || requestContext?.requestId || undefined,
    ...context,
  };

  const logEntry: LogContext = {
    timestamp: new Date().toISOString(),
    level,
    service: "arus-api",
    version: process.env.npm_package_version || "1.0",
    ...enrichedContext,
  };

  // Redact sensitive fields from metadata
  if (logEntry.metadata) {
    logEntry.metadata = redactSensitiveFields(logEntry.metadata);
  }

  if (process.env.NODE_ENV === "production") {
    // JSON logging for production (easier to parse by log aggregators)
    console.log(JSON.stringify({ message, ...logEntry }));
  } else {
    // Human-readable logging for development
    const prefix = `[${level.toUpperCase()}] ${logEntry.timestamp}`;
    const correlationSuffix = logEntry.correlationId ? ` [${logEntry.correlationId}]` : "";
    const orgSuffix = logEntry.orgId ? ` (org:${logEntry.orgId.substring(0, 8)})` : "";
    const durationSuffix = logEntry.duration ? ` (${logEntry.duration}ms)` : "";
    console.log(
      `${prefix}${correlationSuffix}${orgSuffix} ${message}${durationSuffix}`,
      logEntry.metadata ? logEntry.metadata : ""
    );
  }
}

/**
 * Create a scoped logger for a specific operation
 */
export function createScopedLogger(scope: {
  operation: string;
  orgId?: string;
  requestId?: string;
}) {
  return {
    info: (message: string, metadata?: Record<string, any>) =>
      structuredLog("info", message, { ...scope, metadata }),
    warn: (message: string, metadata?: Record<string, any>) =>
      structuredLog("warn", message, { ...scope, metadata }),
    error: (message: string, error?: Error, metadata?: Record<string, any>) =>
      structuredLog("error", message, {
        ...scope,
        error: error ? { message: error.message, stack: error.stack, code: (error as any).code } : undefined,
        metadata,
      }),
    debug: (message: string, metadata?: Record<string, any>) =>
      structuredLog("debug", message, { ...scope, metadata }),
  };
}

/**
 * Basic error tracking (no Prometheus metrics)
 * For Prometheus metrics, use trackErrorWithMetrics in observability.ts
 */
export function trackError(error: Error, context: Partial<LogContext> = {}) {
  // Get request context from AsyncLocalStorage with fallback for background workers
  structuredLog("error", `${error.message}`, {
    correlationId: getCorrelationIdWithFallback() || undefined,
    orgId: getOrgContextWithFallback() || undefined,
    error: {
      message: error.message,
      stack: error.stack,
      code: (error as any).code || "UNKNOWN",
    },
    ...context,
  });
}

/**
 * Express middleware to establish request-scoped logging context
 * Wraps request handlers in AsyncLocalStorage context for correlation tracking
 */
export function loggingContextMiddleware() {
  return (req: any, res: any, next: any) => {
    const correlationId = (req.headers["x-correlation-id"] as string) || generateCorrelationId();
    const requestId = (req as any).requestId || `req_${Date.now()}_${randomUUID().slice(0, 7)}`;
    const orgId = (req as any).orgId;
    
    // Add correlation ID to response headers for client tracing
    res.setHeader("x-correlation-id", correlationId);
    
    // Run the rest of the request in the scoped context
    runWithContext({ correlationId, requestId, orgId }, () => {
      next();
    });
  };
}
