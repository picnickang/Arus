/**
 * Shared Route Utilities
 *
 * Common patterns extracted from domain routes to reduce duplication.
 * Per SonarQube guidance: Extract Method for repeated error handling patterns.
 */

import { createLogger } from "./structured-logger";
const logger = createLogger("Lib:RouteUtils");
import type { Request, Response } from "express";
import { z } from "zod";

/**
 * Standard error response format
 */
export interface ErrorResponse {
  message: string;
  error?: string;
  errors?: z.ZodIssue[];
}

/**
 * Error interface with optional HTTP status code for domain-aware handling.
 */
interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Handle API errors consistently across routes.
 * Extracts the repeated try/catch error handling pattern.
 * Respects domain error status codes when present.
 *
 * @param res - Express response object
 * @param error - The caught error
 * @param operation - Description of the failed operation (e.g., "fetch oil analyses")
 * @param logPrefix - Optional log prefix for console.error
 */
export function handleApiError(
  res: Response,
  error: unknown,
  operation: string,
  logPrefix?: string
): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      message: `Validation error: ${operation}`,
      errors: error.errors,
    } as ErrorResponse);
    return;
  }

  // Check for domain-specific status codes (e.g., NotFound, Conflict)
  const statusError = error as ErrorWithStatus & { code?: string };
  let statusCode = statusError?.status || statusError?.statusCode;
  const rawMessage = error instanceof Error ? error.message : String(error);

  // Infer status from common error patterns when not explicitly set.
  // This catches the 40+ `throw new Error("... not found")` sites in services/storage
  // and turns them into proper 404/409 instead of 500.
  if (!statusCode) {
    if (/\bnot found\b/i.test(rawMessage)) {
      statusCode = 404;
    } else if (
      /\balready exists\b|\bduplicate\b|unique constraint|unique_violation/i.test(rawMessage) ||
      statusError?.code === "23505"
    ) {
      statusCode = 409;
    } else if (
      /foreign key|fk constraint|foreign_key_violation/i.test(rawMessage) ||
      statusError?.code === "23503"
    ) {
      statusCode = 409;
    } else if (/\bforbidden\b|\bpermission denied\b|\bnot authorized\b/i.test(rawMessage)) {
      statusCode = 403;
    } else if (/\bunauthorized\b|\bnot authenticated\b/i.test(rawMessage)) {
      statusCode = 401;
    } else if (/version mismatch|stale version|if-match/i.test(rawMessage)) {
      statusCode = 412;
    }
  }

  if (statusCode && statusCode >= 400 && statusCode < 600) {
    if (statusCode >= 500) {
      const prefix = logPrefix ?? `Failed to ${operation}`;
      logger.error(`${prefix}:`, undefined, error);
    }
    res.status(statusCode).json({
      message: `Failed to ${operation}`,
      error: statusError.message || String(error),
    } as ErrorResponse);
    return;
  }

  const prefix = logPrefix ?? `Failed to ${operation}`;
  logger.error(`${prefix}:`, undefined, error);
  res.status(500).json({
    message: `Failed to ${operation}`,
    error: error instanceof Error ? error.message : String(error),
  } as ErrorResponse);
}

/**
 * Wrap an async route handler with standard error handling.
 * Reduces boilerplate try/catch blocks in routes.
 *
 * @param operation - Description of the operation
 * @param handler - The async handler function
 */
export function withErrorHandling<
  Req extends Request = Request,
  Res extends Response = Response,
>(
  operation: string,
  handler: (req: Req, res: Res) => Promise<void | Response>
): (req: Req, res: Res) => Promise<void> {
  return async (req: Req, res: Res) => {
    try {
      await handler(req, res);
    } catch (error) {
      handleApiError(res, error, operation);
    }
  };
}

/**
 * Standard 404 response for missing resources
 */
export function sendNotFound(res: Response, resourceType: string): void {
  res.status(404).json({ message: `${resourceType} not found` });
}

/**
 * Standard 201 response for created resources
 */
export function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

/**
 * Standard 204 response for deleted resources
 */
export function sendDeleted(res: Response): void {
  res.status(204).send();
}
