export interface MLModel {
  id: string;
  orgId: string;
  name: string;
  modelType: "lstm" | "xgboost" | "random_forest" | "ensemble";
  targetMetric: string;
  equipmentType?: string;
  version: string;
  status: "training" | "validating" | "active" | "deprecated" | "failed";
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainingDataStart?: Date;
  trainingDataEnd?: Date;
  trainedAt?: Date;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TrainingJob {
  id: string;
  modelId?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  metrics?: Record<string, number>;
}

export interface InsightReport {
  id: string;
  orgId: string;
  title: string;
  reportType: string;
  summary: string;
  insights: Insight[];
  recommendations: string[];
  generatedAt: Date;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface Insight {
  id: string;
  type: "anomaly" | "trend" | "prediction" | "recommendation";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  affectedEquipment?: string[];
  confidence?: number;
  actionable: boolean;
}

export interface RULPrediction {
  equipmentId: string;
  equipmentName: string;
  remainingUsefulLife: number;
  unit: "hours" | "days" | "cycles";
  confidence: number;
  predictedFailureDate?: Date;
  degradationRate?: number;
  lastUpdated: Date;
}

export const MODEL_TYPES = ["lstm", "xgboost", "random_forest", "ensemble"] as const;
export const MODEL_STATUSES = ["training", "validating", "active", "deprecated", "failed"] as const;

export type ModelType = (typeof MODEL_TYPES)[number];
export type ModelStatus = (typeof MODEL_STATUSES)[number];

// -------------------------------------------------------------------------
// AI Insights / LLM-side types
// -------------------------------------------------------------------------

export const REPORT_TYPES = ["health", "fleet", "maintenance", "compliance"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const AUDIENCE_TYPES = ["executive", "engineer", "technician", "regulator"] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

/** Identifier strings for LLM models exposed by the platform (gpt-4o, claude, etc.). */
export const LLM_MODEL_TYPES = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "claude-sonnet-4-5",
  "claude-opus-4-1",
  "claude-haiku-4-5",
] as const;
export type LlmModelType = (typeof LLM_MODEL_TYPES)[number] | string;

/**
 * LLM model record returned by /api/llm/models. The shape is intentionally
 * loose because the backend currently aggregates from multiple providers.
 */
export interface AIModel {
  id: string;
  name: string;
  provider?: string;
  contextWindow?: number;
  description?: string;
  available?: boolean;
  [key: string]: unknown;
}

/** Audience selector record returned by /api/llm/models. */
export interface Audience {
  id: string;
  label: string;
  description?: string;
  [key: string]: unknown;
}

/** Generated AI report payload returned from POST /api/llm/reports/*. */
export interface GeneratedReport {
  reportType: ReportType;
  audience: AudienceType;
  model: LlmModelType;
  content: unknown; // server returns provider-shaped object; consumers narrow as needed
  timestamp: string;
}

/** Vessel-level intelligence payload returned from /api/llm/vessel/:id/intelligence. */
export interface VesselIntelligence {
  vesselId: string;
  vesselName: string;
  lookbackDays?: number;
  findings?: unknown[];
  recommendations?: string[];
  generatedAt?: string;
  [key: string]: unknown;
}

/**
 * Display-friendly projection of an ML model row used by the training UI.
 * Server may return additional fields; consumers should treat unknown ones
 * as opaque.
 */
export interface MlModelDisplay {
  id: string;
  name: string;
  modelType: string;
  status: string;
  accuracy?: number | null;
  version?: string;
  targetMetric?: string;
  equipmentType?: string | null;
  trainedAt?: string | Date | null;
  lastUsedAt?: string | Date | null;
  createdAt?: string | Date | null;
  [key: string]: unknown;
}
