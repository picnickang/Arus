/**
 * Error Handling Middleware
 */

import { Request, Response, NextFunction } from "express";
import { authenticatedRequest } from "../middleware/auth";
import { z } from "zod";
import { trackError } from "../logging";
import { AppError } from "./types";
import { circuitBreakers } from "./circuit-breaker";
import { ERROR_HANDLING_CONFIG } from "./types";

export function enhancedErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = authenticatedRequest(req).requestId;

  trackError(err, {
    requestId,
    operation: "request_handling",
    metadata: {
      method: req.method,
      path: req.path,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    },
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        requestId,
        timestamp: new Date().toISOString(),
        ...(process.env["NODE_ENV"] === "development" && { context: err.context }),
      },
    });
  }

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        requestId,
        timestamp: new Date().toISOString(),
        details: err.errors,
      },
    });
  }

  if (err.message.includes("database") || err.message.includes("connection")) {
    return res.status(503).json({
      error: {
        message: "Database service temporarily unavailable",
        code: "DATABASE_UNAVAILABLE",
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const isDevelopment = process.env["NODE_ENV"] === "development";
  return res.status(500).json({
    error: {
      message: isDevelopment ? err.message : "Internal server error",
      code: "INTERNAL_ERROR",
      requestId,
      timestamp: new Date().toISOString(),
      ...(isDevelopment && { stack: err.stack }),
    },
  });
}

export function getErrorHandlingHealth() {
  const circuitBreakerStates = Array.from(circuitBreakers.entries()).map(([service, state]) => ({
    service,
    state: state.state,
    failures: state.failures,
    lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime).toISOString() : null,
  }));

  return {
    circuitBreakers: circuitBreakerStates,
    configuration: ERROR_HANDLING_CONFIG,
    status: circuitBreakerStates.some((cb) => cb.state === "OPEN") ? "degraded" : "healthy",
  };
}
