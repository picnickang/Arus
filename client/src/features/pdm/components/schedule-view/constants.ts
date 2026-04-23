import type { BlockReason, RiskLevel } from "@/features/pdm";

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  capacity: "Capacity Limit",
  parts_lead_time: "Parts Lead Time",
  vessel_unavailable: "Vessel Unavailable",
  telemetry_stale: "Stale Telemetry",
  insufficient_confidence: "Low Confidence",
  scheduling_conflict: "Schedule Conflict",
};

export const SEVERITY_COLORS: Record<RiskLevel, string> = {
  critical: "bg-red-500 dark:bg-red-600",
  high: "bg-orange-500 dark:bg-orange-600",
  medium: "bg-yellow-500 dark:bg-yellow-600",
  low: "bg-green-500 dark:bg-green-600",
};

export const SEVERITY_BADGE_VARIANTS: Record<RiskLevel, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};
