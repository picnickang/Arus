/**
 * Telemetry Processing Service
 * Extracted from routes.ts for modularization
 *
 * Handles telemetry-related processing including:
 * - Alert checking and creation
 * - Sensor configuration application
 * - AI insights generation
 * - Automatic maintenance scheduling
 */

import type { EquipmentTelemetry } from "@shared/schema";
import {
  dbEquipmentStorage,
  dbAlertStorage,
  dbSensorsStorage,
  dbTelemetryStorage,
  dbMaintenanceStorage,
  dbSystemAdminStorage,
  schedulingAdapter,
  analyticsInsightsAdapter,
} from "../repositories";
import { getWebSocketServer } from "../websocket-server";
import { incrementAlertGenerated } from "../observability";

const aiInsightsCache = new Map<string, number>();
const DEFAULT_AI_INSIGHTS_THROTTLE_MS = 2 * 60 * 1000;

const LOW_IS_BAD_SENSORS = new Set([
  "flow_rate",
  "flow",
  "pressure",
  "level",
  "efficiency",
  "power_output",
  "fuel_level",
  "fuel_pressure",
  "oil_pressure",
  "lube_oil_pressure",
  "coolant_level",
  "coolant_pressure",
  "hydraulic_pressure",
  "battery_level",
  "water_level",
  "tank_level",
  "vacuum",
  "suction_pressure",
  "rpm_efficiency",
  "capacity",
  "throughput",
  "output",
  "performance",
  "availability",
]);

interface ThresholdResult {
  triggered: boolean;
  alertType: string;
  threshold: number;
  isLowIsBad: boolean;
}

function evaluateThresholds(
  value: number,
  sensorType: string,
  criticalThreshold: number | null,
  warningThreshold: number | null,
  equipmentId: string
): ThresholdResult {
  let isLowIsBad = LOW_IS_BAD_SENSORS.has(sensorType.toLowerCase().trim());

  if (criticalThreshold != null && warningThreshold != null) {
    const thresholdOrderIndicatesLowIsBad = criticalThreshold < warningThreshold;
    if (isLowIsBad !== thresholdOrderIndicatesLowIsBad) {
      console.warn(
        `Threshold order mismatch for ${equipmentId} ${sensorType}: expected ${isLowIsBad ? "critical < warning" : "critical > warning"}`
      );
    }
    isLowIsBad = thresholdOrderIndicatesLowIsBad;
  }

  if (isLowIsBad) {
    if (criticalThreshold != null && value <= criticalThreshold) {
      return { triggered: true, alertType: "critical", threshold: criticalThreshold, isLowIsBad };
    }
    if (warningThreshold != null && value <= warningThreshold) {
      return { triggered: true, alertType: "warning", threshold: warningThreshold, isLowIsBad };
    }
  } else {
    if (criticalThreshold != null && value >= criticalThreshold) {
      return { triggered: true, alertType: "critical", threshold: criticalThreshold, isLowIsBad };
    }
    if (warningThreshold != null && value >= warningThreshold) {
      return { triggered: true, alertType: "warning", threshold: warningThreshold, isLowIsBad };
    }
  }
  return { triggered: false, alertType: "", threshold: 0, isLowIsBad };
}

async function createAlert(
  telemetryReading: EquipmentTelemetry,
  result: ThresholdResult
): Promise<void> {
  const equipment = await dbEquipmentStorage.getEquipmentRegistry(telemetryReading.orgId);
  const equipmentDetails = equipment.find((e) => e.id === telemetryReading.equipmentId);
  const directionWord = result.isLowIsBad ? "below" : "exceeded";

  const alertNotification = await dbAlertStorage.createAlertNotification({
    equipmentId: telemetryReading.equipmentId,
    sensorType: telemetryReading.sensorType,
    alertType: result.alertType,
    message: `${result.alertType.toUpperCase()} alert: ${telemetryReading.sensorType} value ${telemetryReading.value} ${directionWord} ${result.alertType} threshold (${result.threshold})`,
    value: telemetryReading.value,
    threshold: result.threshold,
    acknowledged: false,
    vesselId: equipmentDetails?.vesselId || null,
    orgId: telemetryReading.orgId,
  });

  incrementAlertGenerated(
    result.alertType,
    telemetryReading.equipmentId,
    telemetryReading.sensorType
  );

  const wsServer = getWebSocketServer();
  wsServer?.broadcastAlert?.({
    id: alertNotification.id,
    equipmentId: telemetryReading.equipmentId,
    sensorType: telemetryReading.sensorType,
    alertType: result.alertType,
    value: telemetryReading.value,
    threshold: result.threshold,
    timestamp: new Date().toISOString(),
  });
}

export async function checkAndCreateAlerts(telemetryReading: EquipmentTelemetry): Promise<void> {
  const alertConfigs = await dbAlertStorage.getAlertConfigurations(telemetryReading.equipmentId);

  const matchingConfigs = alertConfigs.filter(
    (config) =>
      config.enabled &&
      config.sensorType.toLowerCase().trim() === telemetryReading.sensorType.toLowerCase().trim()
  );

  for (const config of matchingConfigs) {
    const result = evaluateThresholds(
      telemetryReading.value,
      config.sensorType,
      config.criticalThreshold,
      config.warningThreshold,
      config.equipmentId
    );

    if (!result.triggered) {
      continue;
    }

    const isSuppressed = await dbAlertStorage.isAlertSuppressed(
      telemetryReading.equipmentId,
      telemetryReading.sensorType,
      result.alertType
    );
    if (isSuppressed) {
      continue;
    }

    const hasRecentAlert = await dbAlertStorage.hasRecentAlert(
      telemetryReading.equipmentId,
      telemetryReading.sensorType,
      result.alertType,
      10
    );
    if (hasRecentAlert) {
      continue;
    }

    await createAlert(telemetryReading, result);
  }
}

export async function applySensorConfiguration(
  equipmentId: string,
  sensorType: string,
  value: number | null,
  unit: string | undefined,
  orgId: string
): Promise<{
  processedValue: number | null;
  shouldKeep: boolean;
  flags: string[];
}> {
  if (value === null) {
    return { processedValue: null, shouldKeep: true, flags: [] };
  }

  const flags: string[] = [];
  let processedValue = value;

  try {
    const config = await dbSensorsStorage.getSensorConfiguration(equipmentId, sensorType, orgId);

    if (!config) {
      return { processedValue, shouldKeep: true, flags: [] };
    }

    if (config.scaleFactor && config.scaleFactor !== 1) {
      processedValue = value * config.scaleFactor;
      flags.push("scaled");
    }

    if (config.offset && config.offset !== 0) {
      processedValue = processedValue + config.offset;
      flags.push("offset_applied");
    }

    if (config.minValue !== null && processedValue < config.minValue) {
      flags.push("below_min");
    }

    if (config.maxValue !== null && processedValue > config.maxValue) {
      flags.push("above_max");
    }

    if (config.enabled === false) {
      return { processedValue, shouldKeep: false, flags: [...flags, "sensor_disabled"] };
    }

    return { processedValue, shouldKeep: true, flags };
  } catch (error) {
    console.error(`Failed to apply sensor configuration for ${equipmentId}/${sensorType}:`, error);
    return { processedValue, shouldKeep: true, flags: ["config_error"] };
  }
}

export async function generateAIInsights(telemetryReading: EquipmentTelemetry): Promise<void> {
  const cacheKey = `${telemetryReading.equipmentId}:${telemetryReading.sensorType}`;
  const lastRun = aiInsightsCache.get(cacheKey) ?? 0;
  const now = Date.now();

  const settings = await dbSystemAdminStorage.getSettings();
  const throttleMs = (settings.aiInsightsThrottleMinutes || 2) * 60 * 1000;

  if (now - lastRun < throttleMs) {
    return;
  }

  aiInsightsCache.set(cacheKey, now);

  try {
    const { analyzeEquipmentHealth } = await import("../openai");

    const equipment = await dbEquipmentStorage.getEquipmentRegistry(telemetryReading.orgId);
    const equipmentDetails = equipment.find((e) => e.id === telemetryReading.equipmentId);

    if (!equipmentDetails) {
      return;
    }

    const recentTelemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
      telemetryReading.equipmentId,
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date(),
      telemetryReading.orgId
    );

    if (recentTelemetry.length < 5) {
      return;
    }

    const analysis = await analyzeEquipmentHealth({
      equipmentId: telemetryReading.equipmentId,
      equipmentName: equipmentDetails.name,
      equipmentType: equipmentDetails.type,
      sensorType: telemetryReading.sensorType,
      currentValue: telemetryReading.value,
      recentReadings: recentTelemetry.slice(-10).map((t) => ({
        value: t.value,
        timestamp: t.ts?.toISOString() || new Date().toISOString(),
      })),
    });

    if (analysis?.riskLevel !== "low") {
      await analyticsInsightsAdapter.createInsightSnapshot({
        orgId: telemetryReading.orgId,
        equipmentId: telemetryReading.equipmentId,
        sensorType: telemetryReading.sensorType,
        snapshotType: "ai_analysis",
        data: analysis,
        generatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error(`AI insights generation failed for ${cacheKey}:`, error);
  }
}

export async function checkAndScheduleAutomaticMaintenance(
  telemetryReading: EquipmentTelemetry
): Promise<void> {
  const settings = await dbSystemAdminStorage.getSettings();

  if (!settings.autoScheduleMaintenance) {
    return;
  }

  const healthScore = telemetryReading.pdmScore;
  if (healthScore === null || healthScore === undefined) {
    return;
  }

  const autoScheduleThreshold = settings.autoScheduleThreshold || 60;
  if (healthScore >= autoScheduleThreshold) {
    return;
  }

  const existingSchedules = await dbMaintenanceStorage.getMaintenanceSchedules(
    telemetryReading.equipmentId
  );
  const hasUpcoming = existingSchedules.some(
    (s) =>
      s.status === "pending" && s.scheduledDate && new Date(s.scheduledDate) > new Date()
  );

  if (!hasUpcoming) {
    const newSchedule = await schedulingAdapter.autoScheduleMaintenance(
      telemetryReading.equipmentId,
      healthScore
    );

    if (newSchedule) {
      const wsServer = getWebSocketServer();
      wsServer?.broadcastAlert?.({
        type: "maintenance_scheduled",
        equipmentId: telemetryReading.equipmentId,
        scheduleId: newSchedule.id,
        priority: newSchedule.priority,
        scheduledDate: newSchedule.scheduledDate,
        message: `Automatic maintenance scheduled for ${telemetryReading.equipmentId}`,
      });
    }
  }
}
