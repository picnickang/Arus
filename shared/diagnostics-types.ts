/**
 * Canonical diagnostics DTOs.
 *
 * The system-diagnostics health payload (`/api/diagnostics/health`) is consumed
 * on both sides of the wire: the server route handlers build it and the client
 * settings hook reads it. Both used to declare their own identical `CheckResult`
 * / `HealthCheckResult` / `ServiceStatus` shapes, which fractured the contract
 * and tripped the duplicate-type ratchet. This module is the single source of
 * truth; server and client re-export these under their historical local names.
 */

export interface DiagnosticsCheckResult {
  status: "pass" | "warn" | "fail";
  responseTimeMs?: number;
  message?: string;
  details?: {
    bufferUtilization?: number;
    utilizationPercent?: number;
    heapUsedMB?: number;
    [key: string]: unknown;
  };
}

export interface DiagnosticsServiceStatus {
  name: string;
  status: "running" | "stopped" | "error";
  lastHealthCheck?: string;
  details?: Record<string, unknown>;
}

export interface DiagnosticsHealthResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: DiagnosticsCheckResult;
    telemetry: DiagnosticsCheckResult;
    memory: DiagnosticsCheckResult;
    services: DiagnosticsServiceStatus[];
  };
}
