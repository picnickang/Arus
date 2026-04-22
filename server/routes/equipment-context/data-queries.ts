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
import type { ContextQueryOptions } from "./types";

export async function runParallelQueries(
  equipmentId: string,
  orgId: string,
  timeframeStart: Date,
  options: ContextQueryOptions
): Promise<{
  telemetryData: any[];
  activeAlerts: any[];
  resolvedAlerts: any[];
  failurePrediction: any;
  pdmScores: any[];
  allWorkOrders: any[];
  schedules: any[];
  sensors: any[];
  insights: any[];
}> {
  const parallelQueries: Promise<any>[] = [];
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

  return {
    telemetryData: queryMap["telemetry"] !== undefined ? results[queryMap["telemetry"]] : [],
    activeAlerts: queryMap["activeAlerts"] !== undefined ? results[queryMap["activeAlerts"]] : [],
    resolvedAlerts:
      queryMap["resolvedAlerts"] !== undefined ? results[queryMap["resolvedAlerts"]] : [],
    failurePrediction:
      queryMap["failurePrediction"] !== undefined
        ? results[queryMap["failurePrediction"]][0]
        : null,
    pdmScores: queryMap["pdmScores"] !== undefined ? results[queryMap["pdmScores"]] : [],
    allWorkOrders:
      queryMap["openWorkOrders"] !== undefined ? results[queryMap["openWorkOrders"]] : [],
    schedules: queryMap["schedules"] !== undefined ? results[queryMap["schedules"]] : [],
    sensors: queryMap["sensors"] !== undefined ? results[queryMap["sensors"]] : [],
    insights: queryMap["insights"] !== undefined ? results[queryMap["insights"]] : [],
  };
}

export async function fetchKnowledgeData(
  equipmentId: string,
  orgId: string,
  equipmentRecord: any,
  searchKnowledgeBase: any,
  logger: any
): Promise<{ relatedDocuments: any[]; semanticMatches: any[] }> {
  const results = { relatedDocuments: [] as any[], semanticMatches: [] as any[] };

  try {
    const equipmentType = equipmentRecord.type ?? "";
    const equipmentName = equipmentRecord.name ?? "";
    const searchQuery = `${equipmentType} ${equipmentName} maintenance procedures troubleshooting`;

    const semanticResults = await searchKnowledgeBase({
      query: searchQuery,
      orgId,
      limit: 5,
    });
    results.semanticMatches = semanticResults.map((r: any) => ({
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
    logger.warn("Knowledge search failed", { error, equipmentId });
  }

  return results;
}
