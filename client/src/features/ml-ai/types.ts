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
