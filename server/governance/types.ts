/**
 * ML Governance Types
 * Type definitions for model lineage tracking and event provenance
 */

export type ModelFamily = "lstm" | "xgboost" | "rf";
export type DeploymentStage = "dev" | "staging" | "production";

export interface DatasetMixEntry {
  name: string;
  weight: number;
  hash: string;
  rowCount?: number;
}

export interface ModelArtifacts {
  checkpointPath: string;
  checkpointHash: string;
  thresholdsPath?: string;
  thresholdsHash?: string;
}

export interface ModelPromotion {
  promotedAt?: string | undefined;
  promotedBy?: string | undefined;
  stage: DeploymentStage;
  canary?: boolean | undefined;
}

export interface LineageRecord {
  modelId: string;
  family: ModelFamily;
  profile: string;
  vesselId?: string;
  version: string;
  createdAt: string;
  trainedBy: string;
  datasetMix: DatasetMixEntry[];
  hyperparams: Record<string, number | string | boolean>;
  metrics: Record<string, number>;
  artifacts: ModelArtifacts;
  promotion: ModelPromotion;
  ttlSeconds?: number;
  predictionCount: number;
  orgId: string;
}

export interface LineageDelta {
  type: "predCount" | "promotion" | "deployment";
  modelId: string;
  orgId: string; // SECURITY: Track orgId in deltas
  ts: string;
  inc?: number;
  stage?: DeploymentStage;
  promotedBy?: string;
  deployedBy?: string;
}

/**
 * Data status for ML governance - differentiates "no data" from "low risk"
 * CRITICAL: Prevents conflating missing telemetry with healthy equipment
 */
export type DataStatus =
  | "sufficient_data" // Enough telemetry for confident prediction
  | "limited_data" // Some data but below ideal thresholds
  | "no_data" // Insufficient or no data to make a prediction
  | "stale_data"; // Data exists but is too old for reliable prediction

export interface ProvenanceEvent {
  type:
    | "prediction"
    | "alert"
    | "anomaly"
    | "work_order"
    | "training"
    | "engineer_override"
    | "override_outcome"
    | "rul_prediction";
  ts: string;
  prevHash: string | null;
  hash?: string | undefined;

  // Prediction-specific fields
  modelId?: string | undefined;
  vesselId?: string | undefined;
  equipmentId?: string | undefined;
  profile?: string | undefined;
  anomalyScore?: number | undefined;
  contributors?: Array<{ sensor: string; weight: number }> | undefined;
  rawSliceHash?: string | undefined;
  engine?: "tfjs" | "onnx" | "xgboost" | "rf" | undefined;

  // RUL Prediction fields (ML Governance)
  remainingDays?: number | undefined;
  riskLevel?: string | undefined;
  confidenceScore?: number | undefined;
  dataStatus?: DataStatus | undefined;
  dataStatusReason?: string | undefined;
  predictionMethod?: string | undefined;

  // Alert-specific fields
  alertId?: string | undefined;
  severity?: string | undefined;
  source?: "anomaly" | "rule" | "operator" | undefined;

  // Work order fields
  workOrderId?: string | undefined;
  linkedAlertId?: string | undefined;

  // Training fields
  checkpointHash?: string | undefined;
  datasetHash?: string | undefined;

  // Engineer override fields (ML Governance)
  overrideId?: string | undefined;
  predictionId?: string | undefined;
  overrideType?: "defer" | "escalate" | "dismiss" | "modify" | undefined;
  originalRiskLevel?: string | undefined;
  newRiskLevel?: string | undefined;
  originalConfidence?: number | undefined;
  justification?: string | undefined;
  engineerId?: string | undefined;
  engineerName?: string | undefined;
  engineerCertifications?: string[] | undefined;
  originalPrediction?: Record<string, unknown> | undefined;

  // Override outcome fields (ML Governance lifecycle tracking)
  outcomeStatus?: "pending" | "validated" | "failure_prevented" | "failure_occurred" | undefined;
  outcomeNotes?: string | undefined;
  outcomeRecordedBy?: string | undefined;

  // Common metadata
  orgId: string;
  userId?: string | undefined;
}

export interface ProvenanceVerificationResult {
  ok: boolean;
  totalEvents: number;
  brokenAt?: number | undefined;
  errors?: Array<{
    index: number;
    eventId: string;
    reason: string;
  }> | undefined;
  lastHash?: string | undefined;
}
