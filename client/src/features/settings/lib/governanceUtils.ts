import type { LucideIcon } from "lucide-react";
import { Brain, AlertTriangle, Activity, FileCheck, Cpu } from "lucide-react";

export interface LineageRecord {
  modelId: string;
  family: "lstm" | "xgboost" | "rf";
  profile: string;
  vesselId?: string;
  version: string;
  createdAt: string;
  trainedBy: string;
  datasetMix: Array<{ name: string; weight: number; hash: string; rowCount?: number }>;
  hyperparams: Record<string, number | string | boolean>;
  metrics: Record<string, number>;
  artifacts: {
    checkpointPath: string;
    checkpointHash: string;
    thresholdsPath?: string;
    thresholdsHash?: string;
  };
  promotion: {
    promotedAt?: string;
    promotedBy?: string;
    stage: "dev" | "staging" | "production";
    canary?: boolean;
  };
  ttlSeconds?: number;
  predictionCount: number;
  orgId: string;
}

export interface ProvenanceEvent {
  type: "prediction" | "alert" | "anomaly" | "work_order" | "training";
  ts: string;
  prevHash: string | null;
  hash?: string;
  modelId?: string;
  vesselId?: string;
  equipmentId?: string;
  profile?: string;
  anomalyScore?: number;
  contributors?: Array<{ sensor: string; weight: number }>;
  rawSliceHash?: string;
  engine?: "tfjs" | "onnx" | "xgboost" | "rf";
  alertId?: string;
  severity?: string;
  source?: "anomaly" | "rule" | "operator";
  workOrderId?: string;
  linkedAlertId?: string;
  checkpointHash?: string;
  datasetHash?: string;
  orgId: string;
  userId?: string;
}

export interface VerificationResult {
  ok: boolean;
  totalEvents: number;
  brokenAt?: number;
  errors?: Array<{ index: number; eventId: string; reason: string }>;
  lastHash?: string;
}

export interface EventTypeConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

const FAMILY_COLORS: Record<string, string> = {
  lstm: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  xgboost: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  rf: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
};

const STAGE_COLORS: Record<string, string> = {
  dev: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  staging: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  production: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
};

const EVENT_TYPE_CONFIG: Record<string, EventTypeConfig> = {
  prediction: { icon: Brain, color: "text-blue-500", label: "Prediction" },
  alert: { icon: AlertTriangle, color: "text-orange-500", label: "Alert" },
  anomaly: { icon: Activity, color: "text-red-500", label: "Anomaly" },
  work_order: { icon: FileCheck, color: "text-green-500", label: "Work Order" },
  training: { icon: Cpu, color: "text-purple-500", label: "Training" },
};

export function getFamilyColor(family: string): string {
  return FAMILY_COLORS[family] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
}

export function getStageColor(stage: string): string {
  return STAGE_COLORS[stage] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
}

export function getEventTypeConfig(type: string): EventTypeConfig {
  return EVENT_TYPE_CONFIG[type] || { icon: Brain, color: "text-gray-500", label: type };
}

export function formatModelVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

export function truncateHash(hash: string, length: number = 8): string {
  if (hash.length <= length) {
    return hash;
  }
  return `${hash.substring(0, length)}...`;
}

export function formatMetricValue(key: string, value: number): string {
  if (
    key.includes("accuracy") ||
    key.includes("rate") ||
    key.includes("recall") ||
    key.includes("precision")
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (key.includes("loss") || key.includes("error")) {
    return value.toExponential(3);
  }
  return value.toFixed(4);
}

export function getModelStageBadgeVariant(
  stage: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (stage) {
    case "production":
      return "default";
    case "staging":
      return "secondary";
    case "dev":
      return "outline";
    default:
      return "outline";
  }
}
