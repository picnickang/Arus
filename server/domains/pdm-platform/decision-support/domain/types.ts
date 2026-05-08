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

export interface EquipmentFeatureSnapshot {
  id?: string;
  timestamp: Date;
  windowMinutes?: number | null;
  sampleCount?: number | null;
  meanTemp?: number | null;
  stdTemp?: number | null;
  meanVibration?: number | null;
  stdVibration?: number | null;
  meanPressure?: number | null;
  stdPressure?: number | null;
  rmsVibration?: number | null;
  peakToPeak?: number | null;
  kurtosis?: number | null;
  skewness?: number | null;
}

export interface EquipmentContext {
  id: string;
  name?: string | null;
  type?: string | null;
  vesselId?: string | null;
  vesselName?: string | null;
  criticalityLevel?: string | null;
  operatingParameters?: Record<string, unknown> | null;
}

export interface OperationalContextInput {
  operatingMode?: "harbour" | "transit" | "maneuvering" | "heavy_weather" | "unknown";
  loadFactor?: number;
  weatherSeverity?: number;
  seaState?: number;
  speedOverGround?: number;
  fuelBurnRate?: number;
  shaftPower?: number;
  cargoLoadPercent?: number;
  routeSegment?: string;
}

export interface NormalizedOperationalContext extends Required<Pick<OperationalContextInput, "operatingMode">> {
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
}

export interface PdmProbabilities {
  optimal: number;
  watch: number;
  degrading: number;
  critical: number;
}

export interface PerformanceIndicators {
  efficiencyLossPercent: number;
  loadNormalizedVibration: number | null;
  loadNormalizedTemperature: number | null;
  fuelPenaltyScore: number;
  dataQualityScore: number;
  minimumSequenceSatisfied: boolean;
  sequenceLength: number;
  requiredSequenceLength: number;
}

export interface SafetyReview {
  decision: "approved" | "needs_engineer_review" | "blocked";
  reasons: string[];
  sanitizedRecommendation: string;
}

export interface PdmDecisionRecommendation {
  action: string;
  priority: "routine" | "soon" | "urgent" | "immediate";
  dueInHours: number;
  reason: string;
  createWorkOrder: boolean;
}

export interface StandardizedPdmDecision {
  equipmentId: string;
  equipmentName?: string | null;
  equipmentType?: string | null;
  predictedStatus: PdmHealthStatus;
  previousStatus?: PdmHealthStatus | null;
  predictedRulHours: number;
  probabilities: PdmProbabilities;
  confidence: number;
  alertNeeded: boolean;
  decisionScore: number;
  featureWindowStart: string | null;
  featureWindowEnd: string | null;
  featureSnapshotId: string | null;
  operatingContext: NormalizedOperationalContext;
  performanceIndicators: PerformanceIndicators;
  recommendations: PdmDecisionRecommendation[];
  safetyReview: SafetyReview;
  lineage: {
    source: "pdm-decision-support";
    modelFamily: "heuristic-context-normalized";
    featureSetVersion: string;
    contextVersion: string;
    generatedAt: string;
  };
}

export interface SyntheticTelemetryPoint {
  timestamp: string;
  rpm: number;
  loadFactor: number;
  oilTemp: number;
  coolantTemp: number;
  vibrationRms: number;
  fuelFlow: number;
  pressure: number;
  sensorHealthy: boolean;
}

export interface SyntheticTelemetryResult {
  equipmentId: string;
  scenario: SyntheticTelemetryScenario;
  hours: number;
  intervalMinutes: number;
  samples: SyntheticTelemetryPoint[];
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
