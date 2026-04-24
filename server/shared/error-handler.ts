import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Shared:ErrorHandler");
import type { Response, Request, NextFunction, RequestHandler } from "express";
import { z } from "zod";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id ${id} not found` : `${resource} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "AuthorizationError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = "Forbidden") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFLICT", 409, details);
    this.name = "ConflictError";
  }
}

export class TenantIsolationError extends DomainError {
  constructor(message: string = "Tenant isolation violation") {
    super(message, "TENANT_ISOLATION", 403);
    this.name = "TenantIsolationError";
  }
}

export class IdempotencyError extends DomainError {
  constructor(idempotencyKey: string) {
    super(
      `Request with idempotency key ${idempotencyKey} has already been processed`,
      "IDEMPOTENCY_CONFLICT",
      409
    );
    this.name = "IdempotencyError";
  }
}

export class UniqueConstraintError extends DomainError {
  constructor(field: string, value?: string) {
    super(
      value ? `${field} '${value}' already exists` : `${field} already exists`,
      "UNIQUE_CONSTRAINT",
      409
    );
    this.name = "UniqueConstraintError";
  }
}

export class StorageError extends DomainError {
  constructor(operation: string, details?: unknown) {
    super(`Storage operation failed: ${operation}`, "STORAGE_ERROR", 500, details);
    this.name = "StorageError";
  }
}

export class RateLimitError extends DomainError {
  constructor(message: string = "Too many requests") {
    super(message, "RATE_LIMIT", 429);
    this.name = "RateLimitError";
  }
}

export function mapStorageError(error: unknown, context: string): DomainError {
  if (error instanceof DomainError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("unique constraint") || message.includes("duplicate key")) {
      const match = message.match(/key \((\w+)\)/);
      return new UniqueConstraintError(match?.[1] || "field");
    }

    if (message.includes("foreign key") || message.includes("violates foreign key")) {
      return new ValidationError("Referenced resource does not exist");
    }

    if (message.includes("not found") || message.includes("no rows")) {
      return new NotFoundError(context);
    }

    if (message.includes("permission denied") || message.includes("access denied")) {
      return new ForbiddenError();
    }

    return new StorageError(context, { originalMessage: error.message });
  }

  return new StorageError(context);
}

export interface ErrorResponse {
  message: string;
  code?: string;
  errors?: unknown;
}

export function handleRouteError(error: unknown, res: Response, context: string): void {
  logger.error(`[${context}] Error:`, undefined, error);

  if (error instanceof z.ZodError) {
    res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: error.errors,
    } satisfies ErrorResponse);
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
      errors: error.details,
    } satisfies ErrorResponse);
    return;
  }

  if (error instanceof Error) {
    res.status(500).json({
      message: error.message || "Internal server error",
      code: "INTERNAL_ERROR",
    } satisfies ErrorResponse);
    return;
  }

  res.status(500).json({
    message: "An unexpected error occurred",
    code: "UNKNOWN_ERROR",
  } satisfies ErrorResponse);
}

export function wrapAsyncHandler<T>(
  handler: (req: T, res: Response) => Promise<void>,
  context: string
) {
  return async (req: T, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      handleRouteError(error, res, context);
    }
  };
}

export function requireOrgIdFromRequest(req: Request & { orgId?: string }): string {
  const orgId = req.orgId;
  if (!orgId) {
    throw new AuthorizationError("Organization ID not found in request");
  }
  return orgId;
}

export function createTenantMiddleware(): RequestHandler {
  return (req: Request & { orgId?: string }, res: Response, next: NextFunction) => {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) {
      handleRouteError(
        new AuthorizationError("Missing organization context"),
        res,
        "TenantMiddleware"
      );
      return;
    }
    req.orgId = orgId;
    next();
  };
}

export function createRateLimitBundle() {
  return {
    general: { windowMs: 60000, max: 100 },
    write: { windowMs: 60000, max: 30 },
    critical: { windowMs: 60000, max: 10 },
    report: { windowMs: 60000, max: 5 },
    crew: { windowMs: 60000, max: 20 },
  };
}

export function logDomainError(error: DomainError, context: string): void {
  logger.error(`[${context}] ${error.name}: ${error.message}`, undefined, {
    code: error.code,
    statusCode: error.statusCode,
    details: error.details,
  });
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof DomainError) {
    return error.code === "STORAGE_ERROR" || error.statusCode >= 500;
  }
  return false;
}
