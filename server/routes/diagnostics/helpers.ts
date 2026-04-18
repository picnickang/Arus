/**
 * Diagnostics Routes - Helper Functions
 */

import { dbUserStorage } from "../../repositories";
import type { CheckResult, ServiceStatus } from "./types.js";

export const startTime = Date.now();

export async function runHealthChecks() {
  const [database, telemetry, memory] = await Promise.all([checkDatabase(), checkTelemetry(), checkMemory()]);
  const services = await checkServices();
  return { database, telemetry, memory, services };
}

export async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const orgs = await dbUserStorage.getOrganizations();
    return { status: 'pass', responseTimeMs: Date.now() - start, details: { organizationCount: orgs.length } };
  } catch (error) {
    return { status: 'fail', responseTimeMs: Date.now() - start, message: error instanceof Error ? error.message : 'Database check failed' };
  }
}

export async function checkTelemetry(): Promise<CheckResult> {
  try {
    const { telemetryBatchWriter } = await import("../../telemetry-batch-writer.js");
    const stats = telemetryBatchWriter.getStats();
    const bufferUtilization = stats.bufferSize > 0 ? (stats.currentBufferSize / stats.bufferSize) * 100 : 0;
    if (bufferUtilization > 90) { return { status: 'warn', message: 'Telemetry buffer near capacity', details: { bufferUtilization: Math.round(bufferUtilization) } }; }
    return { status: 'pass', details: { bufferUtilization: Math.round(bufferUtilization), totalWritten: stats.totalWritten } };
  } catch { return { status: 'warn', message: 'Telemetry service not available' }; }
}

export async function checkMemory(): Promise<CheckResult> {
  const memoryUsage = process.memoryUsage();
  const utilizationPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const details = { heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024), utilizationPercent: Math.round(utilizationPercent) };
  if (utilizationPercent > 90) { return { status: 'fail', message: 'Critical memory pressure', details }; }
  if (utilizationPercent > 70) { return { status: 'warn', message: 'Elevated memory usage', details }; }
  return { status: 'pass', details };
}

export async function checkServices(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [];
  try {
    await import("../../telemetry-batch-writer.js");
    services.push({ name: 'telemetry-batch-writer', status: 'running', lastHealthCheck: new Date().toISOString() });
  } catch { services.push({ name: 'telemetry-batch-writer', status: 'stopped' }); }
  return services;
}

export function determineOverallStatus(checks: { database: CheckResult; telemetry: CheckResult; memory: CheckResult; services: ServiceStatus[] }): 'healthy' | 'degraded' | 'unhealthy' {
  if (checks.database.status === 'fail' || checks.memory.status === 'fail') { return 'unhealthy'; }
  if (checks.database.status === 'warn' || checks.telemetry.status === 'warn' || checks.memory.status === 'warn') { return 'degraded'; }
  return 'healthy';
}
