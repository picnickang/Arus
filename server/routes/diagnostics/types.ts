/**
 * Diagnostics Routes - Type Definitions
 *
 * The health/check/service shapes are the canonical diagnostics DTOs in
 * `@shared/diagnostics-types`; re-exported here under their historical names so
 * existing imports (`./types.js`) keep working without re-declaring the types.
 */

export type {
  DiagnosticsCheckResult as CheckResult,
  DiagnosticsServiceStatus as ServiceStatus,
  DiagnosticsHealthResult as HealthCheckResult,
} from "@shared/diagnostics-types";

export interface SystemMetrics {
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    utilizationPercent: number;
  };
  uptime: number;
  nodeVersion: string;
  timestamp: string;
}

export interface SmokeSuite {
  name: string;
  description: string;
  file: string;
  category: string;
  runnable: boolean;
}
