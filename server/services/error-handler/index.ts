/**
 * Unified Error Handling Service
 * 
 * Provides standardized API error responses, error classification,
 * and consistent error logging across the application.
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { ZodError } from 'zod';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  BAD_REQUEST = 'BAD_REQUEST',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
    timestamp: string;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }

  static notFound(resource: string, id?: string): AppError {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }

  static unauthorized(message: string = 'Authentication required'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
  }

  static forbidden(message: string = 'Access denied'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409, details);
  }

  static rateLimited(message: string = 'Too many requests'): AppError {
    return new AppError(ErrorCode.RATE_LIMITED, message, 429);
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, undefined, false);
  }

  static serviceUnavailable(service: string): AppError {
    return new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} is currently unavailable`,
      503
    );
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.BAD_REQUEST, message, 400, details);
  }

  static externalService(service: string, originalError?: Error): AppError {
    return new AppError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `External service error: ${service}`,
      502,
      { originalMessage: originalError?.message }
    );
  }
}

export function formatZodError(error: ZodError): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};
  
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!formattedErrors[path]) {
      formattedErrors[path] = [];
    }
    formattedErrors[path].push(issue.message);
  }
  
  return formattedErrors;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ApiSuccessResponse<T>['meta']
): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  error: AppError | Error,
  requestId?: string
): void {
  let apiError: ApiError;

  if (error instanceof AppError) {
    apiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      statusCode: error.statusCode,
    };
  } else if (error instanceof ZodError) {
    apiError = {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      details: { fields: formatZodError(error) },
      statusCode: 400,
    };
  } else {
    apiError = {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      statusCode: 500,
    };
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(apiError.statusCode).json(response);
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || req.headers['x-request-id'];

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error:', {
        error: err.message,
        stack: err.stack,
        requestId,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.warn('Operational error:', {
        code: err.code,
        message: err.message,
        requestId,
        path: req.path,
      });
    }
  } else if (err instanceof ZodError) {
    logger.info('Validation error:', {
      issues: err.issues,
      requestId,
      path: req.path,
    });
  } else {
    logger.error('Unexpected error:', {
      error: err.message,
      stack: err.stack,
      requestId,
      path: req.path,
      method: req.method,
    });
  }

  sendError(res, err, requestId as string);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function wrapHandler<T>(
  fn: (req: Request, res: Response) => Promise<T>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await fn(req, res);
      if (result !== undefined && !res.headersSent) {
        sendSuccess(res, result);
      }
    } catch (error) {
      next(error);
    }
  };
}
