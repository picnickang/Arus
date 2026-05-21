/**
 * ML Ensemble Persistence
 *
 * Store predictions and emit events.
 */

import { domainEventBus, createDomainEvent } from "../lib/domain-event-bus/index.js";
import { logger } from "../utils/logger.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";
import type { ModelBreakdown, ModelWeights } from "./types.js";

export interface PersistenceInput {
  orgId: string;
  equipmentId: string;
  equipmentType: string;
  finalPrediction: number;
  confidence: number;
  agreement: number;
  daysToFailure: number | null;
  modelBreakdown: ModelBreakdown;
  weights: ModelWeights;
  recommendations: string[];
}

export async function persistPrediction(input: PersistenceInput): Promise<void> {
  const {
    orgId,
    equipmentId,
    equipmentType,
    finalPrediction,
    confidence,
    agreement,
    daysToFailure,
    modelBreakdown,
    weights,
    recommendations,
  } = input;

  await dbMlAnalyticsStorage.createFailurePrediction(
    {
      orgId,
      equipmentId,
      equipmentType,
      failureProbability: finalPrediction,
      confidence,
      modelType: "ensemble",
      predictedFailureDate: daysToFailure
        ? new Date(Date.now() + daysToFailure * 24 * 60 * 60 * 1000)
        : null,
      remainingUsefulLife: daysToFailure,
      confidenceInterval: {
        lower: Math.max(0, finalPrediction - (1 - agreement) * 0.2),
        upper: Math.min(1, finalPrediction + (1 - agreement) * 0.2),
      },
      failureMode: "predicted",
      riskLevel:
        finalPrediction >= 0.7
          ? "critical"
          : finalPrediction >= 0.4
            ? "high"
            : finalPrediction >= 0.2
              ? "medium"
              : "low",
      inputFeatures: {
        modelBreakdown,
        weights,
        agreement,
        confidence,
      },
      maintenanceRecommendations: recommendations,
      predictionTimestamp: new Date(),
    } as never,
    orgId
  );

  try {
    const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);
    if (equipment) {
      const riskLevel =
        finalPrediction >= 0.7
          ? "critical"
          : finalPrediction >= 0.4
            ? "high"
            : finalPrediction >= 0.2
              ? "medium"
              : "low";
      domainEventBus.emit(
        "pdm.rul.updated",
        createDomainEvent("pdm.rul.updated", orgId, {
          vesselId: equipment.vesselId || "unknown",
          equipmentId,
          remainingDays: daysToFailure || 30,
          riskLevel,
          operatingMode: (equipment as { operatingMode?: string }).operatingMode,
        })
      );
    }
  } catch (eventError) {
    logger.error("MlEnsemble", "Failed to emit RUL event", eventError);
  }
}
