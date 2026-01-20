/**
 * Standardized API Response Utilities
 *
 * Provides consistent response formats and error codes across all API endpoints.
 * Ensures frontend can reliably parse responses and handle errors uniformly.
 */

import type { Request, Response } from "express";
import { ZodError, type ZodIssue } from "zod";

// ============================================================================
// ERROR DETAILS TYPES (S4204 compliant - no 'any' types)
// ============================================================================

/** Structured error details for validation failures */
export interface ValidationErrorDetails {
  errors?: Array<{ field: string; message: string; code: string }>;
  missingFields?: string[];
}

/** Generic error details - use Record<string, unknown> instead of any */
export type ErrorDetails = ValidationErrorDetails | Record<string, unknown> | string | string[];

/** Meta information for paginated responses */
export interface ResponseMeta {
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  [key: string]: unknown;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
    timestamp: string;
  };
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
  meta?: ResponseMeta;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ApiErrorCodes = {
  // Validation Errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Authentication Errors (401)
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  // Authorization Errors (403)
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  ACCESS_DENIED: "ACCESS_DENIED",

  // Resource Errors (404)
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  ENDPOINT_NOT_FOUND: "ENDPOINT_NOT_FOUND",

  // Conflict Errors (409)
  CONFLICT: "CONFLICT",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",

  // Server Errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",

  // Service Availability (503)
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  CIRCUIT_BREAKER_OPEN: "CIRCUIT_BREAKER_OPEN",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // Business Logic Errors (422)
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  INVALID_STATE: "INVALID_STATE",
  OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED",

  // AI/ML Specific
  AI_SERVICE_UNAVAILABLE: "AI_SERVICE_UNAVAILABLE",
  ML_MODEL_NOT_FOUND: "ML_MODEL_NOT_FOUND",
  TRAINING_IN_PROGRESS: "TRAINING_IN_PROGRESS",
} as const;

export type ErrorCode = (typeof ApiErrorCodes)[keyof typeof ApiErrorCodes];

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Create a success response
 */
export function successResponse<T>(data: T, meta?: ResponseMeta): ApiSuccess<T> {
  const response: ApiSuccess<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    response.meta = meta;
  }

  return response;
}

/**
 * Create an error response
 */
export function errorResponse(code: ErrorCode, message: string, details?: ErrorDetails): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a paginated success response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  }
): ApiSuccess<T[]> {
  return successResponse(data, {
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  });
}

// ============================================================================
// EXPRESS RESPONSE HELPERS
// ============================================================================

/**
 * Send a success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ResponseMeta
) {
  res.status(statusCode).json(successResponse(data, meta));
}

/**
 * Async error wrapper for route handlers
 * Catches errors and sends standardized responses
 */
export function asyncHandler(operation: string, handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      handleError(error, res, operation);
    }
  };
}

/**
 * Handle common error patterns
 */
export function handleError(error: unknown, res: Response, operation: string): void {
  console.error(`[${operation}] Error:`, error);

  if (error instanceof ZodError) {
    sendZodError(res, error);
    return;
  }

  if (error instanceof Error) {
    if (error.message.includes("not found")) {
      sendNotFound(res, operation);
      return;
    }

    if (error.message.includes("already exists") || error.message.includes("duplicate")) {
      sendConflict(res, error.message);
      return;
    }

    if (error.message.includes("unauthorized") || error.message.includes("authentication")) {
      sendUnauthorized(res, error.message);
      return;
    }

    if (error.message.includes("forbidden") || error.message.includes("permission")) {
      sendForbidden(res, error.message);
      return;
    }
  }

  sendInternalError(
    res,
    `Failed to ${operation}`,
    error instanceof Error ? error.message : String(error)
  );
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: ErrorDetails
) {
  res.status(statusCode).json(errorResponse(code, message, details));
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  },
  statusCode: number = 200
) {
  res.status(statusCode).json(paginatedResponse(data, pagination));
}

// ============================================================================
// COMMON ERROR RESPONSES
// ============================================================================

/**
 * Send a 400 Bad Request error
 */
export function sendBadRequest(res: Response, message: string, details?: ErrorDetails) {
  sendError(res, ApiErrorCodes.VALIDATION_ERROR, message, 400, details);
}

/**
 * Send a 401 Unauthorized error
 */
export function sendUnauthorized(res: Response, message: string = "Unauthorized") {
  sendError(res, ApiErrorCodes.UNAUTHORIZED, message, 401);
}

/**
 * Send a 403 Forbidden error
 */
export function sendForbidden(res: Response, message: string = "Forbidden") {
  sendError(res, ApiErrorCodes.FORBIDDEN, message, 403);
}

/**
 * Send a 404 Not Found error
 */
export function sendNotFound(res: Response, resource: string = "Resource") {
  sendError(res, ApiErrorCodes.NOT_FOUND, `${resource} not found`, 404);
}

/**
 * Send a 409 Conflict error
 */
export function sendConflict(res: Response, message: string, details?: ErrorDetails) {
  sendError(res, ApiErrorCodes.CONFLICT, message, 409, details);
}

/**
 * Send a 422 Unprocessable Entity error
 */
export function sendUnprocessableEntity(res: Response, message: string, details?: ErrorDetails) {
  sendError(res, ApiErrorCodes.BUSINESS_RULE_VIOLATION, message, 422, details);
}

/**
 * Send a 429 Too Many Requests error
 */
export function sendTooManyRequests(res: Response, message: string = "Too many requests") {
  sendError(res, ApiErrorCodes.RATE_LIMIT_EXCEEDED, message, 429);
}

/**
 * Send a 500 Internal Server Error
 */
export function sendInternalError(
  res: Response,
  message: string = "Internal server error",
  details?: ErrorDetails
) {
  sendError(res, ApiErrorCodes.INTERNAL_ERROR, message, 500, details);
}

/**
 * Send a 503 Service Unavailable error
 */
export function sendServiceUnavailable(
  res: Response,
  message: string = "Service temporarily unavailable"
) {
  sendError(res, ApiErrorCodes.SERVICE_UNAVAILABLE, message, 503);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Send Zod validation error response (S4204 compliant - properly typed)
 */
export function sendZodError(res: Response, zodError: ZodError) {
  const errors = zodError.errors.map((err: ZodIssue) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
  }));

  sendError(res, ApiErrorCodes.VALIDATION_ERROR, "Validation failed", 400, { errors });
}

/**
 * Check required fields and send error if missing
 */
export function validateRequiredFields(res: Response, data: Record<string, unknown>, fields: string[]): boolean {
  const missing = fields.filter((field) => !data[field]);

  if (missing.length > 0) {
    sendError(res, ApiErrorCodes.MISSING_FIELD, "Required fields are missing", 400, {
      missingFields: missing,
    });
    return false;
  }

  return true;
}

// ============================================================================
// HTTP STATUS CODE MAPPINGS
// ============================================================================

/**
 * Map error codes to HTTP status codes
 */
export const ErrorCodeToStatusCode: Record<ErrorCode, number> = {
  // 400
  [ApiErrorCodes.VALIDATION_ERROR]: 400,
  [ApiErrorCodes.INVALID_INPUT]: 400,
  [ApiErrorCodes.MISSING_FIELD]: 400,
  [ApiErrorCodes.INVALID_FORMAT]: 400,

  // 401
  [ApiErrorCodes.UNAUTHORIZED]: 401,
  [ApiErrorCodes.INVALID_TOKEN]: 401,
  [ApiErrorCodes.TOKEN_EXPIRED]: 401,
  [ApiErrorCodes.INVALID_CREDENTIALS]: 401,

  // 403
  [ApiErrorCodes.FORBIDDEN]: 403,
  [ApiErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,
  [ApiErrorCodes.ACCESS_DENIED]: 403,

  // 404
  [ApiErrorCodes.NOT_FOUND]: 404,
  [ApiErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ApiErrorCodes.ENDPOINT_NOT_FOUND]: 404,

  // 409
  [ApiErrorCodes.CONFLICT]: 409,
  [ApiErrorCodes.DUPLICATE_ENTRY]: 409,
  [ApiErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,

  // 422
  [ApiErrorCodes.BUSINESS_RULE_VIOLATION]: 422,
  [ApiErrorCodes.INVALID_STATE]: 422,
  [ApiErrorCodes.OPERATION_NOT_ALLOWED]: 422,

  // 429
  [ApiErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ApiErrorCodes.QUOTA_EXCEEDED]: 429,

  // 500
  [ApiErrorCodes.INTERNAL_ERROR]: 500,
  [ApiErrorCodes.DATABASE_ERROR]: 500,
  [ApiErrorCodes.EXTERNAL_SERVICE_ERROR]: 500,
  [ApiErrorCodes.CONFIGURATION_ERROR]: 500,

  // 503
  [ApiErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ApiErrorCodes.CIRCUIT_BREAKER_OPEN]: 503,
  [ApiErrorCodes.MAINTENANCE_MODE]: 503,

  // AI/ML
  [ApiErrorCodes.AI_SERVICE_UNAVAILABLE]: 503,
  [ApiErrorCodes.ML_MODEL_NOT_FOUND]: 404,
  [ApiErrorCodes.TRAINING_IN_PROGRESS]: 409,
};

/**
 * Send error with automatic status code mapping
 */
export function sendErrorAuto(res: Response, code: ErrorCode, message: string, details?: ErrorDetails) {
  const statusCode = ErrorCodeToStatusCode[code] || 500;
  sendError(res, code, message, statusCode, details);
}
