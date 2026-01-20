/**
 * Request Correlation Context
 * Provides async-local-storage based correlation ID propagation
 * for distributed tracing across the request lifecycle
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export interface RequestContext {
  correlationId: string;
  requestId: string;
  startTime: number;
  orgId?: string;
  userId?: string;
  path?: string;
  method?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 * Returns undefined if called outside of a request context
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current correlation ID
 * Falls back to "no-context" if called outside request scope
 */
export function getCorrelationId(): string {
  const context = asyncLocalStorage.getStore();
  return context?.correlationId ?? "no-context";
}

/**
 * Get the current request ID (same as correlation ID for now)
 */
export function getRequestId(): string {
  return getCorrelationId();
}

/**
 * Run a function within a specific request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Create a new request context
 */
export function createRequestContext(
  correlationId?: string,
  extras?: Partial<RequestContext>
): RequestContext {
  const id = correlationId ?? randomUUID();
  return {
    correlationId: id,
    requestId: id,
    startTime: Date.now(),
    ...extras,
  };
}

/**
 * Express middleware to establish correlation context for each request
 * 
 * Looks for correlation ID in incoming headers (for distributed tracing)
 * or generates a new one. Adds the ID to response headers.
 * 
 * Uses enterWith() to maintain context across the entire async request lifecycle,
 * avoiding context loss when next() returns before async handlers complete.
 */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingCorrelationId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string);

  const context = createRequestContext(incomingCorrelationId, {
    path: req.path,
    method: req.method,
    orgId: req.headers["x-org-id"] as string | undefined,
  });

  res.setHeader("x-correlation-id", context.correlationId);
  res.setHeader("x-request-id", context.requestId);

  // Use enterWith() to maintain context across the entire async request lifecycle
  // This ensures context persists even after next() returns
  asyncLocalStorage.enterWith(context);
  
  next();
}

/**
 * Update the current context with additional information
 * (e.g., after authentication resolves user info)
 */
export function updateContext(updates: Partial<RequestContext>): void {
  const current = asyncLocalStorage.getStore();
  if (current) {
    Object.assign(current, updates);
  }
}

/**
 * Calculate request duration from context
 */
export function getRequestDuration(): number | undefined {
  const context = asyncLocalStorage.getStore();
  if (context) {
    return Date.now() - context.startTime;
  }
  return undefined;
}
