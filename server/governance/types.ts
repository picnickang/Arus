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
  promotedAt?: string;
  promotedBy?: string;
  stage: DeploymentStage;
  canary?: boolean;
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
  | "sufficient_data"    // Enough telemetry for confident prediction
  | "limited_data"       // Some data but below ideal thresholds
  | "no_data"            // Insufficient or no data to make a prediction
  | "stale_data";        // Data exists but is too old for reliable prediction

export interface ProvenanceEvent {
  type: "prediction" | "alert" | "anomaly" | "work_order" | "training" | "engineer_override" | "override_outcome" | "rul_prediction";
  ts: string;
  prevHash: string | null;
  hash?: string;

  // Prediction-specific fields
  modelId?: string;
  vesselId?: string;
  equipmentId?: string;
  profile?: string;
  anomalyScore?: number;
  contributors?: Array<{ sensor: string; weight: number }>;
  rawSliceHash?: string;
  engine?: "tfjs" | "onnx" | "xgboost" | "rf";
  
  // RUL Prediction fields (ML Governance)
  remainingDays?: number;
  riskLevel?: string;
  confidenceScore?: number;
  dataStatus?: DataStatus;
  dataStatusReason?: string;
  predictionMethod?: string;

  // Alert-specific fields
  alertId?: string;
  severity?: string;
  source?: "anomaly" | "rule" | "operator";

  // Work order fields
  workOrderId?: string;
  linkedAlertId?: string;

  // Training fields
  checkpointHash?: string;
  datasetHash?: string;

  // Engineer override fields (ML Governance)
  overrideId?: string;
  predictionId?: string;
  overrideType?: "defer" | "escalate" | "dismiss" | "modify";
  originalRiskLevel?: string;
  newRiskLevel?: string;
  originalConfidence?: number;
  justification?: string;
  engineerId?: string;
  engineerName?: string;
  engineerCertifications?: string[];
  originalPrediction?: Record<string, unknown>;
  
  // Override outcome fields (ML Governance lifecycle tracking)
  outcomeStatus?: "pending" | "validated" | "failure_prevented" | "failure_occurred";
  outcomeNotes?: string;
  outcomeRecordedBy?: string;

  // Common metadata
  orgId: string;
  userId?: string;
}

export interface ProvenanceVerificationResult {
  ok: boolean;
  totalEvents: number;
  brokenAt?: number;
  errors?: Array<{
    index: number;
    eventId: string;
    reason: string;
  }>;
  lastHash?: string;
}
