/**
 * Secure Error Handler - Safe error responses
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Security:ErrorHandler");
import { Request, Response, NextFunction } from "express";

export function secureErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error("Security Error:", undefined, {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const status = err.status || err.statusCode || 500;

  const safeMessage =
    status < 500 ? err.message || "Request validation failed" : "Internal server error";

  res.status(status).json({
    error: safeMessage,
    code: err.code || "UNKNOWN_ERROR",
    timestamp: new Date().toISOString(),
  });
}
