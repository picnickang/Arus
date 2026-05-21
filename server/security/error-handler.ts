/**
 * Secure Error Handler - Safe error responses
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Security:ErrorHandler");
import { Request, Response, NextFunction } from "express";

interface HttpErrorLike {
  message?: string;
  stack?: string;
  status?: number;
  statusCode?: number;
  code?: string;
}

function asHttpError(err: unknown): HttpErrorLike {
  if (err && typeof err === "object") {
    return err as HttpErrorLike;
  }
  return { message: String(err) };
}

export function secureErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const e = asHttpError(err);
  logger.error("Security Error:", undefined, {
    error: e.message,
    stack: e.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const status = e.status || e.statusCode || 500;

  const safeMessage =
    status < 500 ? e.message || "Request validation failed" : "Internal server error";

  res.status(status).json({
    error: safeMessage,
    code: e.code || "UNKNOWN_ERROR",
    timestamp: new Date().toISOString(),
  });
}
