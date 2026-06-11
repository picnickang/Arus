import type { db as DbInstance } from "../../db";

export type DbHandle = typeof DbInstance;

export interface PredictionOutcome {
  predictionId: number;
  equipmentId: string;
  modelId: string | null;
  predictedProbability: number;
  predictedFailureDate: Date | null;
  riskLevel: string;
  actualOutcome: "true_positive" | "true_negative" | "false_positive" | "false_negative";
  outcomeRecordedAt: Date;
}

export interface OutcomeEvaluationReport {
  orgId: string;
  evaluatedAt: Date;
  totalPredictionsEvaluated: number;
  totalAlreadyTracked: number;
  newOutcomesRecorded: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: {
    truePositive: number;
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
  };
  retrainingTriggered: boolean;
  retrainingReason: string | null;
  modelAccuracies: Record<string, { accuracy: number; total: number; shouldRetrain: boolean }>;
}

export interface TrackerConfig {
  /** Days after predicted failure date to wait before evaluating outcome */
  outcomeWindowDays: number;
  /** Days before/after predicted date to look for actual failures */
  matchWindowDays: number;
  /** Accuracy threshold below which retraining is triggered */
  retrainAccuracyThreshold: number;
  /** Minimum predictions needed before evaluating a model */
  minPredictionsForEval: number;
}

export const DEFAULT_CONFIG: TrackerConfig = {
  outcomeWindowDays: 14,
  matchWindowDays: 7,
  retrainAccuracyThreshold: 0.7,
  minPredictionsForEval: 20,
};

export interface TrackerWorkOrder {
  createdAt: string | Date | null;
  type?: string | null;
  priority?: number | null;
  equipmentId?: string | null;
}

export interface TrackerAlert {
  createdAt: string | Date | null;
  equipmentId?: string | null;
  alertType?: string | null;
}

export interface OutcomeTrackerDeps {
  getWorkOrders: (equipmentId?: string, orgId?: string) => Promise<TrackerWorkOrder[]>;
  getAlertNotifications: (acknowledged?: boolean, orgId?: string) => Promise<TrackerAlert[]>;
}

export interface EligiblePrediction {
  id: number;
  equipmentId: string;
  modelId: string | null;
  failureProbability?: number | null;
  predictedFailureDate: string | Date | null;
  riskLevel?: string | null;
}
