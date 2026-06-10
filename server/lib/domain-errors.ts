/**
 * Typed domain errors for route/service code.
 *
 * Throw these instead of `new Error("X not found")` so handleApiError maps
 * status codes by type instead of regex-sniffing messages (route-utils keeps
 * the regex path as a deprecated fallback for unmigrated sites).
 */

export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden", details?: unknown) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Resource conflict", details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class PreconditionFailedError extends DomainError {
  constructor(message = "Precondition failed", details?: unknown) {
    super(message, 412, "PRECONDITION_FAILED", details);
  }
}
