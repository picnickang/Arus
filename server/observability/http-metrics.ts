import { Request, Response, NextFunction } from "express";
import { authenticatedRequest } from "../middleware/auth";
import client from "prom-client";
import { structuredLog } from "../logging";
import { trackPerformance } from "./performance-tracking";
import { checkResourceUsage, PERFORMANCE_THRESHOLDS } from "./core-metrics";
import { cryptoRandomId } from "@shared/crypto-random";

// ===== HTTP METRICS =====
export const httpRequestsTotal = new client.Counter({
  name: "arus_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status_code"],
});

export const httpRequestDuration = new client.Histogram({
  name: "arus_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// ===== HoR METRICS =====
export const horImportTotal = new client.Counter({
  name: "arus_hor_import_total",
  help: "Total number of HoR rows imported",
  labelNames: ["crew_id", "format"],
});

export const horComplianceChecksTotal = new client.Counter({
  name: "arus_hor_compliance_checks_total",
  help: "Total number of STCW compliance checks performed",
  labelNames: ["crew_id", "result"],
});

export const horPdfExportsTotal = new client.Counter({
  name: "arus_hor_pdf_exports_total",
  help: "Total number of HoR PDF exports generated",
  labelNames: ["crew_id"],
});

export const idempotencyHitsTotal = new client.Counter({
  name: "arus_idempotency_hits_total",
  help: "Total number of idempotent request hits",
  labelNames: ["endpoint"],
});

// ===== HTTP MIDDLEWARE =====
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = `req_${Date.now()}_${cryptoRandomId(7)}`;

  authenticatedRequest(req).requestId = requestId;
  checkResourceUsage();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const labels = {
      method: req.method,
      path: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration / 1000);

    trackPerformance(`http_${req.method.toLowerCase()}_request`, duration, {
      requestId,
      operation: "http_request",
      statusCode: res.statusCode,
      metadata: {
        path: req.path,
        method: req.method,
        userAgent: req.headers["user-agent"],
        contentLength: res.get("content-length") || "0",
      },
    });

    if (
      process.env["NODE_ENV"] === "production" ||
      duration > PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS
    ) {
      structuredLog(
        res.statusCode >= 500
          ? "error"
          : res.statusCode >= 400
            ? "warn"
            : duration > PERFORMANCE_THRESHOLDS.SLOW_REQUEST_MS
              ? "warn"
              : "info",
        `${req.method} ${req.path} ${res.statusCode}`,
        {
          requestId,
          operation: "http_request",
          duration,
          statusCode: res.statusCode,
          metadata: {
            method: req.method,
            path: req.path,
            contentLength: res.get("content-length") || "0",
          },
        }
      );
    }
  });

  next();
}

// Helper functions
export function recordHorImport(crewId: string, format: string, count: number = 1) {
  horImportTotal.inc({ crew_id: crewId, format }, count);
}

export function recordHorComplianceCheck(crewId: string, result: "pass" | "fail") {
  horComplianceChecksTotal.inc({ crew_id: crewId, result });
}

export function recordHorPdfExport(crewId: string) {
  horPdfExportsTotal.inc({ crew_id: crewId });
}

export function recordIdempotencyHit(endpoint: string) {
  idempotencyHitsTotal.inc({ endpoint });
}

// Backward-compatible aliases
export function incrementHorImport(crewId: string, format: string, count: number = 1) {
  horImportTotal.inc({ crew_id: crewId, format }, count);
}

export function incrementHorComplianceCheck(crewId: string, result: "pass" | "fail") {
  horComplianceChecksTotal.inc({ crew_id: crewId, result });
}

export function incrementHorPdfExport(crewId: string) {
  horPdfExportsTotal.inc({ crew_id: crewId });
}

export function incrementIdempotencyHit(endpoint: string) {
  idempotencyHitsTotal.inc({ endpoint });
}
