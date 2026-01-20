import { formatDate } from "@/lib/formatters";

export function formatAnalyticsDate(dateString: string | undefined | null): string {
  if (!dateString) { return "N/A"; }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) { return "N/A"; }
  return formatDate(date);
}

export const ANALYTICS_TABS = [
  { id: "ml-models", label: "ML Models", shortLabel: "ML", icon: "brain" },
  { id: "anomalies", label: "Anomalies", shortLabel: "Anom", icon: "alertTriangle" },
  { id: "predictions", label: "Predictions", shortLabel: "Pred", icon: "trendingUp" },
  { id: "optimizations", label: "Optimizations", shortLabel: "Opt", icon: "settings" },
  { id: "digital-twins", label: "Digital Twins", shortLabel: "Twin", icon: "activity" },
  { id: "insights", label: "Insights", shortLabel: "Ins", icon: "barChart" },
] as const;

export const MODEL_TYPE_OPTIONS = [
  { value: "anomaly_detection", label: "Anomaly Detection" },
  { value: "failure_prediction", label: "Failure Prediction" },
  { value: "threshold_optimization", label: "Threshold Optimization" },
  { value: "predictive_maintenance", label: "Predictive Maintenance" },
] as const;

export const MODEL_STATUS_OPTIONS = [
  { value: "training", label: "Training" },
  { value: "active", label: "Active" },
  { value: "deprecated", label: "Deprecated" },
] as const;

export function createEquipmentLookup(equipment: Array<{ id: string; name?: string }>): Map<string, string> {
  return new Map(equipment.map((eq) => [eq.id, eq.name || eq.id]));
}

export function createVesselLookup(vessels: Array<{ id: string; name: string }>): Map<string, string> {
  return new Map(vessels.map((v) => [v.id, v.name]));
}

export function lookupName(map: Map<string, string>, id: string): string {
  return map.get(id) || id;
}

export type BadgeVariant = "destructive" | "default" | "secondary" | "outline";

export function getSeverityColor(severity: string): BadgeVariant {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "default";
    case "info":
      return "secondary";
    default:
      return "outline";
  }
}

export function getRiskLevelColor(riskLevel: string): BadgeVariant {
  switch (riskLevel) {
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "outline";
  }
}

export function getModelStatusColor(status: string): BadgeVariant {
  switch (status) {
    case "deployed":
      return "default";
    case "training":
      return "secondary";
    case "failed":
      return "destructive";
    case "archived":
      return "outline";
    default:
      return "outline";
  }
}

export function getValidationStatusColor(status: string): BadgeVariant {
  switch (status) {
    case "valid":
      return "default";
    case "invalid":
      return "destructive";
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

export function formatDaysToFailure(days: number | undefined): string {
  if (days === undefined) { return "N/A"; }
  if (days < 1) { return "< 1 day"; }
  if (days === 1) { return "1 day"; }
  return `${Math.round(days)} days`;
}
