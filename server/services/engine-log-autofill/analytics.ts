/**
 * Engine Log Auto-Fill - Analytics
 * Anomaly summary and unsigned log tracking
 */

import { engineLogStorage, vesselService } from "../../repositories.js";
import {
  ENGINE_ANOMALY_THRESHOLDS,
  GENERATOR_ANOMALY_THRESHOLDS,
  checkAnomaly,
} from "./thresholds.js";
import type { AnomalySummary, UnsignedLogInfo } from "./types.js";

export async function getAnomalySummary(
  dailyLogId: string,
  orgId: string
): Promise<AnomalySummary> {
  const hourly = await engineLogStorage.getEngineLogHourly(dailyLogId, orgId);
  const generators = await engineLogStorage.getEngineLogGenerator(dailyLogId, orgId);

  const byField: Record<
    string,
    { count: number; severity: "warning" | "critical"; values: number[] }
  > = {};
  let criticalCount = 0;
  let warningCount = 0;

  for (const entry of hourly) {
    for (const [field] of Object.entries(ENGINE_ANOMALY_THRESHOLDS)) {
      const value = (entry as Record<string, unknown>)[field] as number | null | undefined;
      const check = checkAnomaly(field, value, ENGINE_ANOMALY_THRESHOLDS);

      if (check.isAnomaly && value !== null && value !== undefined) {
        if (!byField[field]) {
          byField[field] = { count: 0, severity: check.severity!, values: [] };
        }
        byField[field].count++;
        byField[field].values.push(value);

        if (check.severity === "critical") {
          criticalCount++;
        } else {
          warningCount++;
        }
      }
    }
  }

  for (const entry of generators) {
    for (const [field] of Object.entries(GENERATOR_ANOMALY_THRESHOLDS)) {
      const value = (entry as Record<string, unknown>)[field] as number | null | undefined;
      const check = checkAnomaly(field, value, GENERATOR_ANOMALY_THRESHOLDS);

      if (check.isAnomaly && value !== null && value !== undefined) {
        const fieldKey = `gen${entry.generatorNumber}_${field}`;
        if (!byField[fieldKey]) {
          byField[fieldKey] = { count: 0, severity: check.severity!, values: [] };
        }
        byField[fieldKey].count++;
        byField[fieldKey].values.push(value);

        if (check.severity === "critical") {
          criticalCount++;
        } else {
          warningCount++;
        }
      }
    }
  }

  return {
    totalAnomalies: criticalCount + warningCount,
    criticalCount,
    warningCount,
    byField,
  };
}

export async function getUnsignedLogs(
  orgId: string,
  options: { vesselId?: string; daysBack?: number } = {}
): Promise<UnsignedLogInfo[]> {
  const { vesselId, daysBack = 7 } = options;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split("T")[0];

  const dailyLogs = await engineLogStorage.getEngineLogDaily(orgId, {
    vesselId,
    startDate: startDateStr,
  });

  const unsignedLogs = dailyLogs.filter((log) => log.status === "open" || log.status === "draft");

  const results: UnsignedLogInfo[] = [];
  for (const log of unsignedLogs) {
    const hourly = await engineLogStorage.getEngineLogHourly(log.id, orgId);
    const anomalySummary = await getAnomalySummary(log.id, orgId);

    const vessels = await vesselService.getVessels(orgId);
    const vessel = vessels.find((v) => v.id === log.vesselId);

    results.push({
      dailyLogId: log.id,
      vesselId: log.vesselId,
      vesselName: vessel?.name,
      logDate: log.logDate,
      status: log.status,
      hoursWithData: hourly.filter((h) => h.meRpm !== null || h.meLoad !== null).length,
      anomalyCount: anomalySummary.totalAnomalies,
    });
  }

  return results;
}
