/**
 * Equipment Context Builder - Assembles equipment context from query results
 */

import type { EquipmentContext, ContextQueryOptions, EquipmentRecordInput } from "./types";
import {
  runParallelQueries,
  fetchKnowledgeData,
  type KnowledgeData,
  type SearchKnowledgeBaseFn,
} from "./data-queries";
import { searchKnowledgeBase as defaultSearchKnowledgeBase } from "../../vector-search-service";
import { logger } from "../../utils/logger.js";

const searchKnowledgeBase: SearchKnowledgeBaseFn = async ({ query, limit }) => {
  const results = await defaultSearchKnowledgeBase(query, { ...(limit !== undefined && { limit }) });
  return results.map((r) => ({
    docId: r.docId,
    text: r.text ?? r.content,
    score: r.score,
  }));
};

const pickStr = (obj: object, key: string): string | null => {
  if (key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "string" ? v : v == null ? null : String(v);
  }
  return null;
};
const pickNum = (obj: object, key: string): number | null => {
  if (key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "number" ? v : null;
  }
  return null;
};
const pickDate = (obj: object, key: string): Date | null => {
  if (key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    if (v instanceof Date) {return v;}
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
};

export async function buildEquipmentContext(
  equipmentId: string,
  orgId: string,
  equipmentRecord: EquipmentRecordInput,
  timeframeStart: Date,
  options: ContextQueryOptions
): Promise<EquipmentContext> {
  const queryResults = await runParallelQueries(equipmentId, orgId, timeframeStart, options);

  let knowledgeResults: KnowledgeData = { relatedDocuments: [], semanticMatches: [] };
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

  const woStatus = (wo: object): string | undefined =>
    "status" in wo ? ((wo as { status?: string }).status ?? undefined) : undefined;
  const openWorkOrders = allWorkOrders.filter((wo) => {
    const st = woStatus(wo);
    return st === "open" || st === "in_progress" || st === "pending";
  });
  const completedWorkOrders = allWorkOrders.filter((wo) => woStatus(wo) === "completed").slice(0, 5);

  const now = new Date();
  const scheduleDate = (s: object): Date | null => {
    if (!("scheduledDate" in s)) {return null;}
    const v = (s as { scheduledDate?: unknown }).scheduledDate;
    if (v instanceof Date) {return v;}
    if (typeof v === "string" || typeof v === "number") {return new Date(v);}
    return null;
  };
  const scheduleStatus = (s: object): string | undefined =>
    "status" in s ? ((s as { status?: string }).status ?? undefined) : undefined;
  const upcomingSchedules = schedules.filter((s) => {
    const d = scheduleDate(s);
    return d != null && d >= now && scheduleStatus(s) !== "completed";
  });
  const overdueSchedules = schedules.filter((s) => {
    const d = scheduleDate(s);
    return d != null && d < now && scheduleStatus(s) !== "completed";
  });

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

  const activeSensors = sensors.filter((s) => {
    const isActive = "isActive" in s ? (s as { isActive?: boolean | null }).isActive : true;
    return isActive !== false;
  });
  const sensorTypes = [...new Set(sensors.map((s) => s.sensorType).filter(Boolean))];
  const telemetrySensorTypes = [
    ...new Set(telemetryData.map((t) => t.sensorType).filter(Boolean)),
  ];

  const severityOf = (x: object): string | undefined =>
    "severity" in x ? ((x as { severity?: string }).severity ?? undefined) : undefined;

  const criticalAlerts = activeAlerts.filter((a) => severityOf(a) === "critical").length;
  const warningAlerts = activeAlerts.filter((a) => {
    const s = severityOf(a);
    return s === "warning" || s === "high";
  }).length;
  const infoAlerts = activeAlerts.filter((a) => {
    const s = severityOf(a);
    return s === "info" || s === "low";
  }).length;

  const criticalInsights = insights.filter((i) => severityOf(i) === "critical").length;
  const highInsights = insights.filter((i) => severityOf(i) === "high").length;
  const mediumInsights = insights.filter((i) => severityOf(i) === "medium").length;
  const lowInsights = insights.filter((i) => severityOf(i) === "low").length;

  return {
    equipment: {
      id: String(equipmentRecord.id ?? ""),
      name: String(equipmentRecord.name ?? ""),
      type: String(equipmentRecord.type ?? ""),
      vesselId: pickStr(equipmentRecord, "vesselId"),
      status: pickStr(equipmentRecord, "status") ?? "",
      lastMaintenanceDate: pickDate(equipmentRecord, "lastMaintenanceDate"),
      nextMaintenanceDate: pickDate(equipmentRecord, "nextMaintenanceDate"),
      runningHours: pickNum(equipmentRecord, "runningHours"),
      manufacturer: pickStr(equipmentRecord, "manufacturer"),
      model: pickStr(equipmentRecord, "model"),
      serialNumber: pickStr(equipmentRecord, "serialNumber"),
      installationDate: pickDate(equipmentRecord, "installationDate"),
    },
    telemetry: {
      latest: telemetryData.slice(0, 20),
      summary: {
        readingsCount: telemetryData.length,
        timeRange:
          telemetryData.length > 0
            ? {
                start: telemetryData[telemetryData.length - 1]?.ts as Date,
                end: telemetryData[0]?.ts as Date,
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
            confidence:
              typeof failurePrediction.confidenceInterval === "number"
                ? failurePrediction.confidenceInterval
                : null,
            modelType: failurePrediction.modelId,
          }
        : null,
      pdmScore:
        pdmScores.length > 0
          ? {
              score: pdmScores[0]?.healthIdx ?? null,
              trend: pdmTrend,
              lastUpdated: pdmScores[0]?.ts ?? null,
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
