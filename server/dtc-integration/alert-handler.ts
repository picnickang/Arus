/**
 * DTC Alert Handler
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("DtcIntegration:AlertHandler");
import {
  dbEquipmentStorage,
  dbAlertStorage,
  dbDtcStorage,
  dbTelemetryStorage,
  workOrderService,
} from "../repositories";
import type { DtcWithDefinition, DtcDashboardStats } from "./types";
import { DTC_STATS_CACHE_TTL_MS, SPN_TO_SENSOR_MAP } from "./types";

const dtcStatsCache = new Map<string, { data: DtcDashboardStats; timestamp: number }>();

export function shouldTriggerAlert(dtc: DtcWithDefinition): boolean {
  if (dtc.definition?.severity === 1) {
    return true;
  }
  if (dtc.oc === 1) {
    return true;
  }
  if (dtc.oc > 5) {
    return true;
  }
  return false;
}

export async function createDtcAlert(dtc: DtcWithDefinition, orgId: string): Promise<any | null> {
  if (!shouldTriggerAlert(dtc)) {
    return null;
  }

  const equipment = await dbEquipmentStorage.getEquipment(orgId, dtc.equipmentId);
  if (!equipment) {
    return null;
  }

  let alertLevel: "critical" | "warning" | "info" = "warning";
  if (dtc.definition?.severity === 1 || dtc.definition?.severity === 2) {
    alertLevel = "critical";
  } else if (dtc.definition?.severity === 3) {
    alertLevel = "warning";
  } else {
    alertLevel = "info";
  }

  const recentAlert = await dbAlertStorage.hasRecentAlert(
    dtc.equipmentId,
    `dtc_${dtc.spn}_${dtc.fmi}`,
    "dtc_fault",
    30
  );
  if (recentAlert) {
    logger.info(`[DTC Integration] Suppressing duplicate alert for DTC ${dtc.spn}/${dtc.fmi}`);
    return null;
  }

  const alertMessage = `DTC Fault: SPN ${dtc.spn} / FMI ${dtc.fmi} - ${dtc.definition?.description || "Unknown fault"}`;
  return dbAlertStorage.createAlertNotification({
    orgId,
    equipmentId: dtc.equipmentId,
    sensorType: `dtc_${dtc.spn}_${dtc.fmi}`,
    alertType: "dtc_fault",
    message: alertMessage,
    value: dtc.oc,
    threshold: dtc.definition?.severity || 4,
    acknowledged: false,
  });
}

export async function correlateDtcWithTelemetry(
  dtc: DtcWithDefinition,
  orgId: string,
  timeWindowMinutes: number = 60
): Promise<any[]> {
  const sensorType = SPN_TO_SENSOR_MAP[dtc.spn];
  if (!sensorType) {
    return [];
  }

  const startTime = new Date(dtc.firstSeen.getTime() - timeWindowMinutes * 60 * 1000);
  const endTime = new Date(dtc.firstSeen.getTime() + timeWindowMinutes * 60 * 1000);
  const hoursWindow = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));

  try {
    const allTelemetry = await dbTelemetryStorage.getTelemetryHistory(
      dtc.equipmentId,
      sensorType,
      hoursWindow
    );
    return allTelemetry
      .filter((t: any) => {
        const timestamp = new Date(t.timestamp);
        return timestamp >= startTime && timestamp <= endTime;
      })
      .slice(0, 100);
  } catch {
    return [];
  }
}

export async function getDtcDashboardStats(orgId: string): Promise<DtcDashboardStats> {
  const cacheKey = `dtc-stats:${orgId}`;
  const cached = dtcStatsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DTC_STATS_CACHE_TTL_MS) {
    return cached.data;
  }

  const [allEquipment, allWorkOrders] = await Promise.all([
    dbEquipmentStorage.getEquipmentRegistry(orgId),
    workOrderService.getWorkOrdersWithDetails(),
  ]);

  const allDtcsResults = await Promise.all(
    allEquipment.map((eq) => dbDtcStorage.getActiveDtcs(eq.id, orgId))
  );

  let totalActiveDtcs = 0,
    criticalDtcs = 0,
    equipmentWithDtcs = 0;
  allDtcsResults.forEach((dtcs) => {
    if (dtcs.length > 0) {
      equipmentWithDtcs++;
      totalActiveDtcs += dtcs.length;
      criticalDtcs += dtcs.filter((d) => d.definition?.severity === 1).length;
    }
  });

  const dtcWorkOrders = allWorkOrders.filter(
    (wo) => wo.orgId === orgId && wo.reason?.includes("DTC Fault") && wo.status === "open"
  );

  const result: DtcDashboardStats = {
    totalActiveDtcs,
    criticalDtcs,
    equipmentWithDtcs,
    dtcTriggeredWorkOrders: dtcWorkOrders.length,
  };

  dtcStatsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  if (dtcStatsCache.size > 20) {
    const oldestKey = Array.from(dtcStatsCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    )[0][0];
    dtcStatsCache.delete(oldestKey);
  }

  return result;
}
