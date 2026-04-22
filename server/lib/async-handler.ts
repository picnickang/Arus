/**
 * Async Handler Utilities
 *
 * SonarQube Fix: Centralized async route handling to reduce try/catch duplication
 * Eliminates repeated error handling patterns across 40+ route files
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";

/** Custom error with HTTP status code */
export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Common HTTP errors */
export const HttpErrors = {
  badRequest: (message: string, code?: string) => new HttpError(message, 400, code),
  unauthorized: (message: string, code?: string) => new HttpError(message, 401, code),
  forbidden: (message: string, code?: string) => new HttpError(message, 403, code),
  notFound: (message: string, code?: string) => new HttpError(message, 404, code),
  conflict: (message: string, code?: string) => new HttpError(message, 409, code),
  unprocessable: (message: string, code?: string) => new HttpError(message, 422, code),
  internal: (message: string, code?: string) => new HttpError(message, 500, code),
} as const;

/** Standard error response format */
interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
  errors?: z.ZodIssue[];
}

/**
 * Extract status code from various error types
 */
function getErrorStatusCode(error: unknown): number {
  if (error instanceof HttpError) {
    return error.statusCode;
  }
  if (error instanceof z.ZodError) {
    return 400;
  }

  const anyError = error as { status?: number; statusCode?: number };
  return anyError?.status || anyError?.statusCode || 500;
}

/**
 * Extract error message safely
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Extract error code if available
 */
function getErrorCode(error: unknown): string | undefined {
  if (error instanceof HttpError) {
    return error.code;
  }
  const anyError = error as { code?: string };
  return anyError?.code;
}

/**
 * Format error for API response
 */
function formatErrorResponse(error: unknown, operation?: string): ErrorResponse {
  const message = operation ? `Failed to ${operation}` : getErrorMessage(error);

  if (error instanceof z.ZodError) {
    return {
      message: operation ? `Validation error: ${operation}` : "Validation error",
      errors: error.errors,
    };
  }

  return {
    message,
    error: getErrorMessage(error),
    code: getErrorCode(error),
  };
}

/**
 * Log error with context
 */
function logError(
  error: unknown,
  context: { operation?: string; path?: string; method?: string }
): void {
  const statusCode = getErrorStatusCode(error);

  if (statusCode >= 500) {
    console.error(
      `[ERROR] ${context.method || "?"} ${context.path || "?"}: ${context.operation || "Operation failed"}`,
      error
    );
  } else if (process.env.NODE_ENV === "development") {
    console.warn(
      `[WARN] ${context.method || "?"} ${context.path || "?"}: ${getErrorMessage(error)}`
    );
  }
}

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wrap async route handler with consistent error handling
 *
 * @example
 * router.get("/items", asyncHandler(async (req, res) => {
 *   const items = await service.getItems();
 *   res.json(items);
 * }));
 *
 * @example With operation name for better error messages
 * router.get("/items/:id", asyncHandler(async (req, res) => {
 *   const item = await service.getItem(req.params.id);
 *   if (!item) throw HttpErrors.notFound("Item not found");
 *   res.json(item);
 * }, "fetch item"));
 */
export function asyncHandler(handler: AsyncRouteHandler, operation?: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      logError(error, { operation, path: req.path, method: req.method });

      const statusCode = getErrorStatusCode(error);
      const response = formatErrorResponse(error, operation);

      res.status(statusCode).json(response);
    }
  };
}

/**
 * Wrap async route handler that may call next()
 * Use this when the handler might pass control to next middleware
 */
export function asyncMiddleware(handler: AsyncRouteHandler): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

type ValidationSchema<T> = z.ZodType<T>;

/**
 * Create a validated route handler that parses request body
 *
 * @example
 * const createItemSchema = z.object({ name: z.string(), price: z.number() });
 *
 * router.post("/items", validatedHandler(createItemSchema, async (req, res, data) => {
 *   const item = await service.createItem(data);
 *   res.status(201).json(item);
 * }));
 */
export function validatedHandler<T>(
  schema: ValidationSchema<T>,
  handler: (req: Request, res: Response, data: T) => Promise<void>,
  operation?: string
): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const parseResult = schema.safeParse(req.body);

    if (!parseResult.success) {
      throw parseResult.error;
    }

    await handler(req, res, parseResult.data);
  }, operation);
}

/**
 * Common response helpers
 */
export const respond = {
  ok: <T>(res: Response, data: T) => res.json(data),
  created: <T>(res: Response, data: T) => res.status(201).json(data),
  noContent: (res: Response) => res.status(204).send(),
  accepted: <T>(res: Response, data?: T) => res.status(202).json(data ?? { accepted: true }),
} as const;
