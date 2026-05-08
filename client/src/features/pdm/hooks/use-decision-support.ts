import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type PdmHealthStatus = "optimal" | "watch" | "degrading" | "critical";

export type SyntheticTelemetryScenario =
  | "normal"
  | "heavy_weather"
  | "cooling_degradation"
  | "bearing_wear"
  | "fuel_inefficiency"
  | "sensor_drift"
  | "sensor_dropout"
  | "progressive_failure"
  | "post_maintenance_recovery";

export interface OperationalContextOverride {
  operatingMode?: "harbour" | "transit" | "maneuvering" | "heavy_weather" | "unknown";
  loadFactor?: number;
  weatherSeverity?: number;
  seaState?: number;
  fuelBurnRate?: number;
  shaftPower?: number;
  speedOverGround?: number;
  cargoLoadPercent?: number;
  routeSegment?: string;
}

export interface PdmDecisionSupportRequest {
  equipmentId: string;
  previousStatus?: PdmHealthStatus | null;
  minSequenceLength?: number;
  contextOverride?: OperationalContextOverride;
}

export interface PdmDecisionSupportResult {
  equipmentId: string;
  equipmentName?: string | null;
  equipmentType?: string | null;
  predictedStatus: PdmHealthStatus;
  previousStatus?: PdmHealthStatus | null;
  predictedRulHours: number;
  probabilities: Record<PdmHealthStatus, number>;
  confidence: number;
  alertNeeded: boolean;
  decisionScore: number;
  featureWindowStart: string | null;
  featureWindowEnd: string | null;
  featureSnapshotId: string | null;
  operatingContext: {
    operatingMode: string;
    loadFactor: number;
    weatherSeverity: number;
    seaState: number;
    speedOverGround: number | null;
    fuelBurnRate: number | null;
    shaftPower: number | null;
    cargoLoadPercent: number | null;
    routeSegment: string | null;
    contextConfidence: number;
    notes: string[];
  };
  performanceIndicators: {
    efficiencyLossPercent: number;
    loadNormalizedVibration: number | null;
    loadNormalizedTemperature: number | null;
    fuelPenaltyScore: number;
    dataQualityScore: number;
    minimumSequenceSatisfied: boolean;
    sequenceLength: number;
    requiredSequenceLength: number;
  };
  recommendations: Array<{
    action: string;
    priority: "routine" | "soon" | "urgent" | "immediate";
    dueInHours: number;
    reason: string;
    createWorkOrder: boolean;
  }>;
  safetyReview: {
    decision: "approved" | "needs_engineer_review" | "blocked";
    reasons: string[];
    sanitizedRecommendation: string;
  };
  lineage: {
    source: string;
    modelFamily: string;
    featureSetVersion: string;
    contextVersion: string;
    generatedAt: string;
  };
}

export interface SyntheticTelemetryRequest {
  equipmentId: string;
  scenario: SyntheticTelemetryScenario;
  hours?: number;
  intervalMinutes?: number;
  loadFactor?: number;
  weatherSeverity?: number;
  seed?: string;
}

export interface SyntheticTelemetryResult {
  equipmentId: string;
  scenario: SyntheticTelemetryScenario;
  hours: number;
  intervalMinutes: number;
  samples: Array<{
    timestamp: string;
    rpm: number;
    loadFactor: number;
    oilTemp: number;
    coolantTemp: number;
    vibrationRms: number;
    fuelFlow: number;
    pressure: number;
    sensorHealthy: boolean;
  }>;
  summary: {
    sampleCount: number;
    expectedStatus: PdmHealthStatus;
    failureMode: string;
    usefulFor: string[];
  };
  featureHints: {
    meanTemp: number;
    meanVibration: number;
    rmsVibration: number;
    meanPressure: number;
    kurtosis: number;
    sampleCount: number;
  };
}

export function useEvaluatePdmDecisionSupport() {
  return useMutation({
    mutationFn: (payload: PdmDecisionSupportRequest) =>
      apiRequest<PdmDecisionSupportResult>("POST", "/api/pdm/decision-support/evaluate", payload),
  });
}

export function useGenerateSyntheticTelemetry() {
  return useMutation({
    mutationFn: (payload: SyntheticTelemetryRequest) =>
      apiRequest<SyntheticTelemetryResult>(
        "POST",
        "/api/pdm/decision-support/synthetic-telemetry",
        payload
      ),
  });
}
