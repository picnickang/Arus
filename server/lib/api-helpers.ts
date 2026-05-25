/**
 * API Helpers - Pagination & Validation Utilities
 *
 * Provides standardized patterns for:
 * - Request pagination parsing
 * - Zod schema validation
 * - Common response formats
 *
 * Note: For error handling and tenant guards, import directly from:
 * - ./route-utils.js (handleApiError, withErrorHandling, sendNotFound, etc.)
 * - ./tenant-guards.js (createTenantExtractor, createTenantRequirement, etc.)
 */

import { createLogger } from "./structured-logger";
const logger = createLogger("Lib:ApiHelpers");
import type { Request, Response } from "express";
import { z, ZodSchema, ZodError } from "zod";

export interface PaginationParams {
  limit: number;
  offset: number;
  page: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total?: number;
    hasMore?: boolean;
  };
}

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).optional(),
});

export type PaginationResult =
  | { success: true; params: PaginationParams }
  | { success: false; error: ZodError };

export function parsePagination(query: Record<string, unknown>): PaginationResult {
  const parsed = paginationSchema.safeParse(query);

  if (!parsed.success) {
    return { success: false, error: parsed.error };
  }

  const { page, limit, offset } = parsed.data;
  return {
    success: true,
    params: {
      page,
      limit,
      offset: offset ?? (page - 1) * limit,
    },
  };
}

export function parsePaginationWithDefaults(
  query: Record<string, unknown>,
  defaults: Partial<PaginationParams> = {}
): PaginationParams {
  const parsed = paginationSchema.safeParse(query);

  if (!parsed.success) {
    return {
      page: defaults.page ?? 1,
      limit: defaults.limit ?? 50,
      offset: defaults.offset ?? 0,
    };
  }

  const { page, limit, offset } = parsed.data;
  return {
    page,
    limit,
    offset: offset ?? (page - 1) * limit,
  };
}

export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationParams,
  total?: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      hasMore: total ? pagination.offset + data.length < total : data.length === pagination.limit,
    },
  };
}

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: ZodError };

export function validateBody<T>(req: Request, schema: ZodSchema<T>): ValidationResult<T> {
  return schema.safeParse(req.body);
}

export function validateQuery<T>(req: Request, schema: ZodSchema<T>): ValidationResult<T> {
  return schema.safeParse(req.query);
}

export function validateParams<T>(req: Request, schema: ZodSchema<T>): ValidationResult<T> {
  return schema.safeParse(req.params);
}

/**
 * Validates a response payload against a Zod schema before sending it to the
 * client. In non-production builds (`NODE_ENV !== "production"`), a validation
 * failure throws so it surfaces in tests/dev. In production, the failure is
 * logged and the original payload is sent as-is to avoid breaking live traffic
 * if a contract drifts.
 *
 * Returns the parsed (and possibly stripped) data on success.
 */
export function validateResponse<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  context: string
): T {
  const result = schema.safeParse(payload);
  if (result.success) {return result.data;}

  const message = `Response contract violation in ${context}: ${result.error.issues
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ")}`;

  if (process.env['NODE_ENV'] === "production") {
    logger.error(String(message));
    return payload as T;
  }
  throw new Error(message);
}

export function sendValidationError(
  res: Response,
  error: ZodError,
  message = "Validation failed"
): void {
  res.status(400).json({
    message,
    errors: error.flatten().fieldErrors,
    issues: error.issues,
  });
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data);
}

export function sendBadRequest(
  res: Response,
  message: string,
  details?: Record<string, unknown>
): void {
  const response: { message: string; details?: Record<string, unknown> } = { message };
  if (details) {
    response.details = details;
  }
  res.status(400).json(response);
}

export function sendUnauthorized(res: Response, message = "Unauthorized"): void {
  res.status(401).json({ message });
}

export function sendForbidden(res: Response, message = "Forbidden"): void {
  res.status(403).json({ message });
}

export function sendConflict(res: Response, message: string): void {
  res.status(409).json({ message });
}

export function sendServerError(res: Response, error: unknown, operation: string): void {
  logger.error(`Failed to ${operation}:`, undefined, error);
  res.status(500).json({
    message: `Failed to ${operation}`,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function requireOrgId(req: Request, res: Response): string | null {
  const orgId = req.orgId;
  if (!orgId) {
    sendUnauthorized(res, "Organization ID required");
    return null;
  }
  return orgId;
}

export function parseIntParam(value: unknown, defaultValue: number, max?: number): number {
  let num: number;
  if (typeof value === "string") {
    num = parseInt(value, 10);
  } else if (typeof value === "number") {
    num = Math.floor(value);
  } else {
    return defaultValue;
  }
  if (isNaN(num) || num < 0) {
    return defaultValue;
  }
  return max ? Math.min(num, max) : num;
}

export function parseUUID(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : null;
}

export function parseDateRange(query: Record<string, unknown>): {
  startDate?: string;
  endDate?: string;
} {
  const startDate = typeof query['startDate'] === "string" ? query['startDate'] : undefined;
  const endDate = typeof query['endDate'] === "string" ? query['endDate'] : undefined;
  return { startDate, endDate };
}
