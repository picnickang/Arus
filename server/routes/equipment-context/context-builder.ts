/**
 * Equipment Context Builder - Assembles equipment context from query results
 */

import type { EquipmentContext, ContextQueryOptions } from "./types";
import { runParallelQueries, fetchKnowledgeData } from "./data-queries";
import { searchKnowledgeBase } from "../../vector-search-service";
import { logger } from "../../utils/logger.js";

export async function buildEquipmentContext(
  equipmentId: string,
  orgId: string,
  equipmentRecord: any,
  timeframeStart: Date,
  options: ContextQueryOptions
): Promise<EquipmentContext> {
  const queryResults = await runParallelQueries(equipmentId, orgId, timeframeStart, options);

  let knowledgeResults = { relatedDocuments: [] as object[], semanticMatches: [] as object[] };
  if (options.includeKnowledge === "true") {
    knowledgeResults = await fetchKnowledgeData(
      equipmentId,
      orgId,
      equipmentRecord,
      searchKnowledgeBase,
      logger
    );
  }

  const {
    telemetryData,
    activeAlerts,
    resolvedAlerts,
    failurePrediction,
    pdmScores,
    allWorkOrders,
    schedules,
    sensors,
    insights,
  } = queryResults;

  const openWorkOrders = allWorkOrders.filter(
    (wo: any) => wo.status === "open" || wo.status === "in_progress" || wo.status === "pending"
  );
  const completedWorkOrders = allWorkOrders
    .filter((wo: any) => wo.status === "completed")
    .slice(0, 5);

  const now = new Date();
  const upcomingSchedules = schedules.filter(
    (s: any) =>
      s.scheduledDate && new Date(s.scheduledDate) >= now && s.status !== "completed"
  );
  const overdueSchedules = schedules.filter(
    (s: any) =>
      s.scheduledDate && new Date(s.scheduledDate) < now && s.status !== "completed"
  );

  let pdmTrend: "improving" | "stable" | "declining" | null = null;
  if (pdmScores.length >= 2) {
    const recent = pdmScores[0]?.healthIdx ?? 0;
    const older = pdmScores[pdmScores.length - 1]?.healthIdx ?? 0;
    const diff = recent - older;
    if (diff > 5) {
      pdmTrend = "improving";
    } else if (diff < -5) {
      pdmTrend = "declining";
    } else {
      pdmTrend = "stable";
    }
  }

  const activeSensors = sensors.filter((s: any) => s.isActive !== false);
  const sensorTypes = [...new Set(sensors.map((s: any) => s.sensorType).filter(Boolean))];
  const telemetrySensorTypes = [
    ...new Set(telemetryData.map((t: any) => t.sensorType).filter(Boolean)),
  ];

  const criticalAlerts = activeAlerts.filter((a: any) => a.severity === "critical").length;
  const warningAlerts = activeAlerts.filter(
    (a: any) => a.severity === "warning" || a.severity === "high"
  ).length;
  const infoAlerts = activeAlerts.filter(
    (a: any) => a.severity === "info" || a.severity === "low"
  ).length;

  const criticalInsights = insights.filter((i: any) => i.severity === "critical").length;
  const highInsights = insights.filter((i: any) => i.severity === "high").length;
  const mediumInsights = insights.filter((i: any) => i.severity === "medium").length;
  const lowInsights = insights.filter((i: any) => i.severity === "low").length;

  return {
    equipment: {
      id: equipmentRecord.id,
      name: equipmentRecord.name,
      type: equipmentRecord.type,
      vesselId: equipmentRecord.vesselId,
      status: equipmentRecord.status,
      lastMaintenanceDate: equipmentRecord.lastMaintenanceDate,
      nextMaintenanceDate: equipmentRecord.nextMaintenanceDate,
      runningHours: equipmentRecord.runningHours,
      manufacturer: equipmentRecord.manufacturer,
      model: equipmentRecord.model,
      serialNumber: equipmentRecord.serialNumber,
      installationDate: equipmentRecord.installationDate,
    },
    telemetry: {
      latest: telemetryData.slice(0, 20),
      summary: {
        readingsCount: telemetryData.length,
        timeRange:
          telemetryData.length > 0
            ? {
                start: telemetryData[telemetryData.length - 1]?.ts,
                end: telemetryData[0]?.ts,
              }
            : null,
        sensorTypes: telemetrySensorTypes as string[],
      },
    },
    alerts: {
      active: activeAlerts,
      recentResolved: resolvedAlerts,
      summary: {
        criticalCount: criticalAlerts,
        warningCount: warningAlerts,
        infoCount: infoAlerts,
      },
    },
    predictions: {
      latestRul: failurePrediction
        ? {
            remainingUsefulLife: failurePrediction.remainingUsefulLife,
            failureProbability: failurePrediction.failureProbability,
            predictedFailureDate: failurePrediction.predictedFailureDate,
            confidence: failurePrediction.confidenceInterval,
            modelType: failurePrediction.modelId,
          }
        : null,
      pdmScore:
        pdmScores.length > 0
          ? {
              score: pdmScores[0]?.healthIdx,
              trend: pdmTrend,
              lastUpdated: pdmScores[0]?.ts,
            }
          : null,
    },
    maintenance: {
      openWorkOrders,
      upcomingSchedules,
      recentCompletedWorkOrders: completedWorkOrders,
      summary: {
        openCount: openWorkOrders.length,
        scheduledCount: upcomingSchedules.length,
        overdueCount: overdueSchedules.length,
      },
    },
    sensors: {
      configurations: sensors,
      summary: {
        totalSensors: sensors.length,
        activeSensors: activeSensors.length,
        sensorTypes: sensorTypes as string[],
      },
    },
    knowledge: knowledgeResults,
    insights: {
      active: insights,
      summary: {
        criticalCount: criticalInsights,
        highCount: highInsights,
        mediumCount: mediumInsights,
        lowCount: lowInsights,
      },
    },
    metadata: {
      generatedAt: new Date(),
      orgId,
      equipmentId,
      dataCompleteness: {
        hasTelemetry: telemetryData.length > 0,
        hasAlerts: activeAlerts.length > 0 || resolvedAlerts.length > 0,
        hasPredictions: !!failurePrediction || pdmScores.length > 0,
        hasMaintenance: allWorkOrders.length > 0 || schedules.length > 0,
        hasSensors: sensors.length > 0,
        hasKnowledge:
          knowledgeResults.relatedDocuments.length > 0 ||
          knowledgeResults.semanticMatches.length > 0,
      },
    },
  };
}
