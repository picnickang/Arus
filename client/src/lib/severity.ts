export type AnomalyAckStatus = "unacknowledged" | "watching" | "acknowledged";

export type FreshnessLevel = "fresh" | "stale" | "critical" | "unknown";

export interface FreshnessResult {
  level: FreshnessLevel;
  label: string;
  ageMs: number;
  description: string;
}

export interface ConfidenceLabel {
  label: string;
  variant: "default" | "destructive" | "outline" | "secondary";
  description: string;
}

export function getSeverityVariant(
  severity: string | null | undefined
): "default" | "destructive" | "outline" | "secondary" {
  if (!severity) return "secondary";
  switch (severity.toLowerCase()) {
    case "critical":
    case "high":
      return "destructive";
    case "warning":
    case "medium":
      return "default";
    case "caution":
    case "low":
      return "outline";
    default:
      return "secondary";
  }
}

export function getDataFreshness(
  lastUpdated: Date | string | number | null | undefined,
  options?: { staleThresholdMs?: number; criticalThresholdMs?: number }
): FreshnessResult {
  if (lastUpdated == null) {
    return {
      level: "unknown",
      label: "No data",
      ageMs: Infinity,
      description: "No data has been received yet.",
    };
  }

  const ts =
    typeof lastUpdated === "number"
      ? lastUpdated
      : new Date(lastUpdated).getTime();

  if (Number.isNaN(ts)) {
    return {
      level: "unknown",
      label: "No data",
      ageMs: Infinity,
      description: "Unable to determine data age.",
    };
  }

  const ageMs = Date.now() - ts;
  const staleMs = options?.staleThresholdMs ?? 5 * 60 * 1000;
  const criticalMs = options?.criticalThresholdMs ?? 30 * 60 * 1000;

  if (ageMs < staleMs) {
    return {
      level: "fresh",
      label: "Live",
      ageMs,
      description: "Data is current and up to date.",
    };
  }

  if (ageMs < criticalMs) {
    const mins = Math.round(ageMs / 60000);
    return {
      level: "stale",
      label: `${mins}m ago`,
      ageMs,
      description: `Data is ${mins} minute${mins !== 1 ? "s" : ""} old. Readings may not reflect current conditions.`,
    };
  }

  const mins = Math.round(ageMs / 60000);
  const hours = Math.round(ageMs / 3600000);
  const display = hours >= 1 ? `${hours}h ago` : `${mins}m ago`;
  return {
    level: "critical",
    label: display,
    ageMs,
    description: `Data is ${display} old. Readings are significantly outdated and may be unreliable.`,
  };
}

export function getConfidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.85) {
    return {
      label: "Very confident",
      variant: "default",
      description:
        "The AI found very strong patterns. This prediction is highly reliable for maintenance planning.",
    };
  }
  if (confidence >= 0.7) {
    return {
      label: "Confident",
      variant: "secondary",
      description:
        "Clear patterns detected. This prediction is reliable enough for most planning decisions.",
    };
  }
  if (confidence >= 0.5) {
    return {
      label: "Moderate",
      variant: "outline",
      description:
        "Some patterns found but not conclusive. Monitor the equipment closely for confirmation.",
    };
  }
  return {
    label: "Low confidence",
    variant: "destructive",
    description:
      "Limited data or weak patterns. Gather more sensor data before acting on this prediction.",
  };
}

export function getAckStatusLabel(status: AnomalyAckStatus): string {
  switch (status) {
    case "unacknowledged":
      return "New";
    case "watching":
      return "Watching";
    case "acknowledged":
      return "Acknowledged";
  }
}

export function getAckStatusVariant(
  status: AnomalyAckStatus
): "default" | "destructive" | "outline" | "secondary" {
  switch (status) {
    case "unacknowledged":
      return "destructive";
    case "watching":
      return "default";
    case "acknowledged":
      return "secondary";
  }
}
