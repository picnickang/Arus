/**
 * Fleet Summary Context Builder
 * 
 * Build comprehensive context for fleet summary reports.
 */

import { vesselService, dbEquipmentStorage, workOrderService, dbTelemetryStorage, dbAlertStorage } from "../repositories";
import { vesselIntelligence } from "../vessel-intelligence";
import type { ReportContext, ContextBuilderOptions } from "./types.js";
import {
  fetchKBKnowledge,
  buildCitations,
  determinePriority,
} from "./knowledge-citations.js";

export async function buildFleetSummaryContext(
  orgId: string = "default-org",
  options: ContextBuilderOptions = {}
): Promise<ReportContext> {
  const timeframeDays = options.timeframeDays || 30;
  const end = new Date();
  const start = new Date(end.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

  const [vessels, equipment, workOrders, telemetry, alerts] = await Promise.all([
    vesselService.getVessels(),
    dbEquipmentStorage.getEquipmentRegistry(),
    workOrderService.getWorkOrdersWithDetails(),
    dbTelemetryStorage.getLatestTelemetryReadings(),
    dbAlertStorage.getAlertNotifications(),
  ]);

  const filteredWorkOrders = workOrders.filter(
    (wo) => new Date(wo.createdAt) >= start && new Date(wo.createdAt) <= end
  );

  const filteredAlerts = alerts.filter(
    (alert) => new Date(alert.createdAt) >= start && new Date(alert.createdAt) <= end
  );

  let intelligence: ReportContext["intelligence"];
  if (options.includeIntelligence || options.includePredictions) {
    intelligence = {};

    if (options.includeIntelligence && vessels.length > 0) {
      const vesselIntelligencePromises = vessels
        .slice(0, 5)
        .map((v) => vesselIntelligence.getHistoricalContext(v.id).catch(() => null));
      const contexts = await Promise.all(vesselIntelligencePromises);
      intelligence.historicalContexts = contexts.filter((c) => c !== null);
    }

    if (options.includePredictions && equipment.length > 0) {
      const { predictWithHybridModel } = await import("../ml-prediction-service");

      const predictionPromises = equipment.slice(0, 20).map(async (eq) => {
        try {
          const prediction = await predictWithHybridModel(eq.id, orgId);
          if (prediction) {
            return {
              equipmentId: eq.id,
              equipmentName: eq.name,
              equipmentType: eq.type,
              mlPrediction: prediction,
            };
          }
        } catch (error) {
          console.warn(`[Context] ML prediction failed for ${eq.id}:`, error);
        }
        return null;
      });

      const predictions = (await Promise.all(predictionPromises)).filter((p) => p !== null);
      if (predictions.length > 0) {
        intelligence.predictions = predictions as any;
      }
    }
  }

  const citations = buildCitations(vessels[0], equipment, filteredWorkOrders);
  let knowledge;
  if (options.includeKnowledge) {
    knowledge = await fetchKBKnowledge(orgId, equipment, 'fleet_summary');
  }

  return {
    type: "fleet_summary",
    scope: {
      timeframe: { start, end },
      organizationId: orgId,
    },
    data: {
      vessels,
      equipment,
      workOrders: filteredWorkOrders,
      telemetry,
      alerts: filteredAlerts,
    },
    metadata: {
      generatedAt: new Date(),
      audience: options.audience || "executive",
      priority: determinePriority(filteredWorkOrders, filteredAlerts),
    },
    intelligence,
    knowledge,
    citations,
  };
}
