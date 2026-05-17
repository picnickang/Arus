// @ts-nocheck
/**
 * Vessel Health Context Builder
 *
 * Build comprehensive context for vessel health reports.
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("ReportContext:VesselHealthBuilder");
import { vesselService } from "../repositories";
import { vesselIntelligence } from "../vessel-intelligence";
import type { ReportContext, ContextBuilderOptions } from "./types.js";
import {
  getVesselEquipment,
  getVesselWorkOrders,
  getVesselTelemetry,
  getVesselMaintenanceSchedules,
  getVesselAlerts,
} from "./data-fetchers.js";
import { fetchKBKnowledge, buildCitations, determinePriority } from "./knowledge-citations.js";

export async function buildVesselHealthContext(
  vesselId: string,
  orgId: string = "default-org",
  options: ContextBuilderOptions = {}
): Promise<ReportContext> {
  const vessel = await vesselService.getVessel(vesselId);
  if (!vessel) {
    throw new Error(`Vessel not found: ${vesselId}`);
  }

  const timeframeDays = options.timeframeDays || 30;
  const end = new Date();
  const start = new Date(end.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

  const [equipment, workOrders, telemetry, schedules, alerts] = await Promise.all([
    getVesselEquipment(vesselId),
    getVesselWorkOrders(vesselId, start, end),
    getVesselTelemetry(vesselId, start, end),
    getVesselMaintenanceSchedules(vesselId),
    getVesselAlerts(vesselId, start, end),
  ]);

  let intelligence;
  if (options.includeIntelligence || options.includePredictions) {
    const tasks: Promise<any>[] = [];

    if (options.includeIntelligence) {
      tasks.push(
        vesselIntelligence.learnVesselPatterns(vesselId, timeframeDays),
        vesselIntelligence.getHistoricalContext(vesselId)
      );
    }

    const results = await Promise.all(tasks);

    intelligence = {
      ...(options.includeIntelligence && {
        vesselLearnings: results[0],
        historicalContext: results[1],
      }),
    };

    if (options.includePredictions && equipment.length > 0) {
      const { predictWithHybridModel } = await import("../ml-prediction-service");

      const predictionPromises = equipment.slice(0, 10).map(async (eq) => {
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
          logger.warn(`[Context] ML prediction failed for ${eq.id}:`, { details: error });
        }
        return null;
      });

      const predictions = (await Promise.all(predictionPromises)).filter((p) => p !== null);
      if (predictions.length > 0) {
        intelligence.predictions = predictions as any;
      }
    }
  }

  const citations = buildCitations(vessel, equipment, workOrders);
  let knowledge;
  if (options.includeKnowledge) {
    knowledge = await fetchKBKnowledge(orgId, equipment, "health");
  }

  return {
    type: "health",
    scope: {
      vesselId,
      timeframe: { start, end },
      organizationId: orgId,
    },
    data: {
      vessels: [vessel],
      equipment,
      workOrders,
      telemetry,
      maintenanceSchedules: schedules,
      alerts,
    },
    metadata: {
      generatedAt: new Date(),
      audience: options.audience || "technical",
      priority: determinePriority(workOrders, alerts),
    },
    intelligence,
    knowledge,
    citations,
  };
}
