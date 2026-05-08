import type {
  OperationalContextInput,
  PdmDecisionRecommendation,
  PdmHealthStatus,
  StandardizedPdmDecision,
  SyntheticTelemetryScenario,
  SyntheticTelemetryResult,
} from "../domain/types";
import type {
  OperationalContextPort,
  PdmContextPort,
  RecommendationSafetyPort,
  SyntheticTelemetryPort,
} from "../domain/ports";
import {
  computeDecisionScore,
  computePerformanceIndicators,
  confidenceFromData,
  predictedRulHours,
  probabilitiesFromScore,
  shouldAlert,
  statusFromScore,
} from "../domain/scoring";

const STATUS_PRIORITY: Record<PdmHealthStatus, PdmDecisionRecommendation["priority"]> = {
  optimal: "routine",
  watch: "soon",
  degrading: "urgent",
  critical: "immediate",
};

function dueInHours(status: PdmHealthStatus, rulHours: number): number {
  if (status === "critical") {
    return Math.min(12, rulHours);
  }
  if (status === "degrading") {
    return Math.min(72, rulHours);
  }
  if (status === "watch") {
    return Math.min(168, rulHours);
  }
  return Math.min(720, rulHours);
}

function generateRecommendations(input: {
  status: PdmHealthStatus;
  rulHours: number;
  efficiencyLossPercent: number;
  minimumSequenceSatisfied: boolean;
  equipmentName?: string | null;
}): PdmDecisionRecommendation[] {
  const target = input.equipmentName ?? "equipment";
  const recommendations: PdmDecisionRecommendation[] = [];

  if (!input.minimumSequenceSatisfied) {
    recommendations.push({
      action: `Collect more telemetry for ${target} before making an irreversible maintenance decision.`,
      priority: "soon",
      dueInHours: 24,
      reason: "The sensor sequence is shorter than the required PdM window.",
      createWorkOrder: false,
    });
  }

  if (input.status === "critical") {
    recommendations.push({
      action: `Inspect ${target} before the next operating cycle and prepare a corrective work order.`,
      priority: "immediate",
      dueInHours: dueInHours(input.status, input.rulHours),
      reason: "Risk score is in the critical band after load/weather normalization.",
      createWorkOrder: true,
    });
  } else if (input.status === "degrading") {
    recommendations.push({
      action: `Schedule targeted inspection for ${target}; verify vibration, temperature, pressure, and lubrication condition.`,
      priority: "urgent",
      dueInHours: dueInHours(input.status, input.rulHours),
      reason: "Risk trend suggests degradation rather than normal operating stress.",
      createWorkOrder: true,
    });
  } else if (input.status === "watch") {
    recommendations.push({
      action: `Keep ${target} on enhanced watch and compare after the next operating window.`,
      priority: "soon",
      dueInHours: dueInHours(input.status, input.rulHours),
      reason: "Equipment is outside ideal baseline but not yet in corrective-maintenance range.",
      createWorkOrder: false,
    });
  } else {
    recommendations.push({
      action: `Keep ${target} on normal planned-maintenance interval.`,
      priority: "routine",
      dueInHours: dueInHours(input.status, input.rulHours),
      reason: "Current feature window is inside the expected health band.",
      createWorkOrder: false,
    });
  }

  if (input.efficiencyLossPercent >= 8) {
    recommendations.push({
      action: `Review fuel/performance efficiency for ${target} after maintenance or cleaning.`,
      priority: STATUS_PRIORITY[input.status],
      dueInHours: Math.min(168, dueInHours(input.status, input.rulHours)),
      reason: `Estimated efficiency loss is ${input.efficiencyLossPercent}%.`,
      createWorkOrder: input.status === "degrading" || input.status === "critical",
    });
  }

  return recommendations;
}

export class PdmDecisionSupportService {
  constructor(
    private readonly contextPort: PdmContextPort,
    private readonly operationalContextPort: OperationalContextPort,
    private readonly safetyPort: RecommendationSafetyPort,
    private readonly syntheticTelemetryPort: SyntheticTelemetryPort
  ) {}

  async evaluateEquipment(input: {
    orgId: string;
    equipmentId: string;
    previousStatus?: PdmHealthStatus | null;
    minSequenceLength?: number;
    contextOverride?: OperationalContextInput;
  }): Promise<StandardizedPdmDecision> {
    const requiredSequenceLength = Math.max(3, Math.min(input.minSequenceLength ?? 8, 96));
    const [equipment, features] = await Promise.all([
      this.contextPort.getEquipmentContext(input.orgId, input.equipmentId),
      this.contextPort.getRecentFeatureSnapshots(input.orgId, input.equipmentId, requiredSequenceLength),
    ]);

    if (!equipment) {
      throw new Error("Equipment not found");
    }

    const operatingContext = this.operationalContextPort.normalize(equipment, input.contextOverride);
    const indicators = computePerformanceIndicators(features, operatingContext, requiredSequenceLength);
    const decisionScore = computeDecisionScore(features, operatingContext, indicators);
    const predictedStatus = statusFromScore(decisionScore);
    const probabilities = probabilitiesFromScore(decisionScore);
    const rulHours = predictedRulHours(decisionScore, indicators);
    const confidence = confidenceFromData(decisionScore, indicators);
    const alertNeeded = shouldAlert(input.previousStatus, predictedStatus);
    const recommendations = generateRecommendations({
      status: predictedStatus,
      rulHours,
      efficiencyLossPercent: indicators.efficiencyLossPercent,
      minimumSequenceSatisfied: indicators.minimumSequenceSatisfied,
      equipmentName: equipment.name,
    });
    const safetyReview = this.safetyPort.reviewRecommendation({
      recommendation: recommendations[0]?.action ?? "No recommendation generated.",
      riskLevel: predictedStatus,
      equipmentId: input.equipmentId,
    });

    const newest = features[0];
    const oldest = features[features.length - 1];

    return {
      equipmentId: input.equipmentId,
      equipmentName: equipment.name,
      equipmentType: equipment.type,
      predictedStatus,
      previousStatus: input.previousStatus ?? null,
      predictedRulHours: rulHours,
      probabilities,
      confidence,
      alertNeeded,
      decisionScore,
      featureWindowStart: oldest?.timestamp ? oldest.timestamp.toISOString() : null,
      featureWindowEnd: newest?.timestamp ? newest.timestamp.toISOString() : null,
      featureSnapshotId: newest?.id ?? null,
      operatingContext,
      performanceIndicators: indicators,
      recommendations,
      safetyReview,
      lineage: {
        source: "pdm-decision-support",
        modelFamily: "heuristic-context-normalized",
        featureSetVersion: `v2.context-window-${requiredSequenceLength}`,
        contextVersion: "v1.operational-normalization",
        generatedAt: new Date().toISOString(),
      },
    };
  }

  generateSyntheticTelemetry(input: {
    equipmentId: string;
    scenario: SyntheticTelemetryScenario;
    hours: number;
    intervalMinutes: number;
    loadFactor?: number;
    weatherSeverity?: number;
    seed?: string;
  }): SyntheticTelemetryResult {
    return this.syntheticTelemetryPort.generate(input);
  }

  reviewRecommendation(input: {
    recommendation: string;
    riskLevel: string;
    equipmentId?: string;
  }) {
    return this.safetyPort.reviewRecommendation(input);
  }
}
