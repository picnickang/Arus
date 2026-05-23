/**
 * Equipment Context Data Queries - Database queries for context building
 */

import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  equipmentTelemetry,
  alertNotifications,
  failurePredictions,
  pdmScoreLogs,
  sensorConfigurations,
  workOrders,
  maintenanceSchedules,
  kbDocs,
  actionableInsights,
} from "@shared/schema-runtime";
import type {
  EquipmentTelemetry,
  FailurePrediction,
  PdmScoreLog,
  WorkOrder,
  MaintenanceSchedule,
  SensorConfiguration,
  AlertNotification,
  ActionableInsight,
} from "@shared/schema";
import type { ContextQueryOptions } from "./types";

export interface ParallelQueryResults {
  telemetryData: EquipmentTelemetry[];
  activeAlerts: AlertNotification[];
  resolvedAlerts: AlertNotification[];
  failurePrediction: FailurePrediction | null;
  pdmScores: PdmScoreLog[];
  allWorkOrders: WorkOrder[];
  schedules: MaintenanceSchedule[];
  sensors: SensorConfiguration[];
  insights: ActionableInsight[];
}

export interface KbSearchHit {
  docId?: string;
  text?: string;
  score?: number;
}

export type SearchKnowledgeBaseFn = (
  args: { query: string; orgId: string; limit?: number },
) => Promise<KbSearchHit[]>;

export interface KnowledgeQueryLogger {
  warn: (
    moduleOrMessage: string,
    message?: string,
    data?: unknown,
    suppressInEmbedded?: boolean
  ) => void;
}

export async function runParallelQueries(
  equipmentId: string,
  orgId: string,
  timeframeStart: Date,
  options: ContextQueryOptions
): Promise<ParallelQueryResults> {
  const parallelQueries: Promise<unknown>[] = [];
  const queryMap: Record<string, number> = {};
  let queryIndex = 0;

  if (options.includeTelemetry === "true") {
    queryMap["telemetry"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(equipmentTelemetry)
        .where(
          and(
            eq(equipmentTelemetry.equipmentId, equipmentId),
            eq(equipmentTelemetry.orgId, orgId),
            gte(equipmentTelemetry.ts, timeframeStart)
          )
        )
        .orderBy(sql`${equipmentTelemetry.ts} DESC`)
        .limit(options.telemetryLimit)
    );
  }

  if (options.includeAlerts === "true") {
    queryMap["activeAlerts"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(alertNotifications)
        .where(
          and(
            eq(alertNotifications.equipmentId, equipmentId),
            eq(alertNotifications.orgId, orgId),
            eq(alertNotifications.acknowledged, false)
          )
        )
        .orderBy(sql`${alertNotifications.createdAt} DESC`)
        .limit(options.alertsLimit)
    );

    queryMap["resolvedAlerts"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(alertNotifications)
        .where(
          and(
            eq(alertNotifications.equipmentId, equipmentId),
            eq(alertNotifications.orgId, orgId),
            eq(alertNotifications.acknowledged, true),
            gte(alertNotifications.createdAt, timeframeStart)
          )
        )
        .orderBy(sql`${alertNotifications.createdAt} DESC`)
        .limit(10)
    );
  }

  if (options.includePredictions === "true") {
    queryMap["failurePrediction"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(failurePredictions)
        .where(eq(failurePredictions.equipmentId, equipmentId))
        .orderBy(sql`${failurePredictions.predictionTimestamp} DESC`)
        .limit(1)
    );

    queryMap["pdmScores"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(pdmScoreLogs)
        .where(eq(pdmScoreLogs.equipmentId, equipmentId))
        .orderBy(sql`${pdmScoreLogs.ts} DESC`)
        .limit(5)
    );
  }

  if (options.includeMaintenance === "true") {
    queryMap["openWorkOrders"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.orgId, orgId)))
        .orderBy(sql`${workOrders.createdAt} DESC`)
    );

    queryMap["schedules"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(maintenanceSchedules)
        .where(
          and(
            eq(maintenanceSchedules.equipmentId, equipmentId),
            eq(maintenanceSchedules.orgId, orgId)
          )
        )
        .orderBy(sql`${maintenanceSchedules.scheduledDate} DESC`)
    );
  }

  if (options.includeSensors === "true") {
    queryMap["sensors"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(sensorConfigurations)
        .where(
          and(
            eq(sensorConfigurations.equipmentId, equipmentId),
            eq(sensorConfigurations.orgId, orgId)
          )
        )
    );
  }

  if (options.includeInsights === "true") {
    queryMap["insights"] = queryIndex++;
    parallelQueries.push(
      db
        .select()
        .from(actionableInsights)
        .where(
          and(
            eq(actionableInsights.equipmentId, equipmentId),
            eq(actionableInsights.orgId, orgId),
            eq(actionableInsights.resolved, false)
          )
        )
        .orderBy(sql`${actionableInsights.createdAt} DESC`)
    );
  }

  const results = await Promise.all(parallelQueries);

  const pick = <T>(key: string, fallback: T): T => {
    const idx = queryMap[key];
    if (idx === undefined) return fallback;
    return (results[idx] as T) ?? fallback;
  };

  const failurePredictionRows = pick<FailurePrediction[]>("failurePrediction", []);

  return {
    telemetryData: pick<EquipmentTelemetry[]>("telemetry", []),
    activeAlerts: pick<AlertNotification[]>("activeAlerts", []),
    resolvedAlerts: pick<AlertNotification[]>("resolvedAlerts", []),
    failurePrediction: failurePredictionRows[0] ?? null,
    pdmScores: pick<PdmScoreLog[]>("pdmScores", []),
    allWorkOrders: pick<WorkOrder[]>("openWorkOrders", []),
    schedules: pick<MaintenanceSchedule[]>("schedules", []),
    sensors: pick<SensorConfiguration[]>("sensors", []),
    insights: pick<ActionableInsight[]>("insights", []),
  };
}

export interface KnowledgeData {
  relatedDocuments: Array<typeof kbDocs.$inferSelect>;
  semanticMatches: Array<{ docId?: string; text?: string; score?: number }>;
}

export async function fetchKnowledgeData(
  equipmentId: string,
  orgId: string,
  equipmentRecord: { type?: unknown; name?: unknown },
  searchKnowledgeBase: SearchKnowledgeBaseFn,
  logger: KnowledgeQueryLogger
): Promise<KnowledgeData> {
  const results: KnowledgeData = { relatedDocuments: [], semanticMatches: [] };

  try {
    const equipmentType =
      typeof equipmentRecord.type === "string" ? equipmentRecord.type : "";
    const equipmentName =
      typeof equipmentRecord.name === "string" ? equipmentRecord.name : "";
    const searchQuery = `${equipmentType} ${equipmentName} maintenance procedures troubleshooting`;

    const semanticResults = await searchKnowledgeBase({
      query: searchQuery,
      orgId,
      limit: 5,
    });
    results.semanticMatches = semanticResults.map((r) => ({
      docId: r.docId,
      text: r.text,
      score: r.score,
    }));

    const linkedDocs = await db
      .select()
      .from(kbDocs)
      .where(and(eq(kbDocs.orgId, orgId), eq(kbDocs.equipmentId, equipmentId)));

    results.relatedDocuments = linkedDocs;
  } catch (error) {
    logger.warn("equipment-context", "Knowledge search failed", { error, equipmentId });
  }

  return results;
}
