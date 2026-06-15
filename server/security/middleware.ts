/**
 * Security Middleware - Headers and request sanitization
 */

import { Request, Response, NextFunction } from "express";
import { sanitizeInput, sanitizeRequestBody } from "./sanitization";

export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()"
  );

  if (req.path.includes("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

export function sanitizeRequestData(req: Request, res: Response, next: NextFunction) {
  const isTelemetryEndpoint =
    req.path.includes("/telemetry") ||
    req.path.includes("/import") ||
    req.path.includes("/edge/heartbeat");

  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      if (typeof value === "string") {
        req.query[key] = sanitizeInput(value, isTelemetryEndpoint);
      } else if (Array.isArray(value)) {
        req.query[key] = value.map((v) =>
          typeof v === "string" ? sanitizeInput(v, isTelemetryEndpoint) : v
        ) as object as (typeof req.query)[string];
      }
    }
  }

  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      if (typeof value === "string") {
        req.params[key] = sanitizeInput(value, isTelemetryEndpoint);
      }
    }
  }

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeRequestBody(req.body, isTelemetryEndpoint);
  }

  next();
}
