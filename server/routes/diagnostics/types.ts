/**
 * Diagnostics Routes - Type Definitions
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: CheckResult;
    telemetry: CheckResult;
    memory: CheckResult;
    services: ServiceStatus[];
  };
}

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  responseTimeMs?: number;
  message?: string;
  details?: Record<string, any>;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastHealthCheck?: string;
  details?: Record<string, any>;
}

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
