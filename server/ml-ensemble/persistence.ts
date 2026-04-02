/**
 * ML Ensemble Persistence
 * 
 * Store predictions and emit events.
 */

import type { IStorage } from "../storage.js";
import { domainEventBus, createDomainEvent } from "../lib/domain-event-bus/index.js";
import { logger } from "../utils/logger.js";
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

/**
 * Store prediction in database and emit scheduler event
 */
export async function persistPrediction(
  storage: IStorage,
  input: PersistenceInput
): Promise<void> {
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

  await storage.createFailurePrediction(
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
    },
    orgId
  );

  try {
    const equipment = await storage.getEquipment(orgId, equipmentId);
    if (equipment) {
      const riskLevel =
        finalPrediction >= 0.7
          ? "critical"
          : finalPrediction >= 0.4
            ? "high"
            : finalPrediction >= 0.2
              ? "medium"
              : "low";
      domainEventBus.emit("pdm.rul.updated", createDomainEvent("pdm.rul.updated", orgId, {
        vesselId: equipment.vesselId || "unknown",
        equipmentId,
        remainingDays: daysToFailure || 30,
        riskLevel,
        operatingMode: equipment.operatingMode,
      }));
    }
  } catch (eventError) {
    logger.error("MlEnsemble", "Failed to emit RUL event", eventError);
  }
}
