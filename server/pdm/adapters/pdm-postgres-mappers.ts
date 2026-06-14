import type {
  AlertStatus,
  EvidenceChip,
  RiskLevel,
  RiskQueueItem,
} from "../domain/types";

export type RiskQueueStatus = "new" | "active" | "resolved";

export type RiskQueryRow = {
  id: number;
  equipmentId: string;
  failureMode: string | null;
  riskLevel: string | null;
  remainingUsefulLife: number | null;
  confidenceInterval: unknown;
  failureProbability: number | null;
  maintenanceRecommendations: unknown;
  predictionTimestamp: Date | null;
  resolvedByWorkOrderId: string | null;
  equipmentName: string | null;
  equipmentType: string | null;
  vesselId: string | null;
  vesselName: string | null;
};

export function generateEvidenceChips(row: {
  riskLevel: string | null;
  remainingUsefulLife: number | null;
  failureProbability: number | null;
  failureMode: string | null;
}): EvidenceChip[] {
  const chips: EvidenceChip[] = [];

  if (row.remainingUsefulLife !== null && row.remainingUsefulLife < 7 * 24) {
    chips.push({ label: "Low RUL", type: "threshold" });
  }

  if (row.failureProbability !== null && row.failureProbability > 0.7) {
    chips.push({ label: "High Failure Probability", type: "threshold" });
  } else if (row.failureProbability !== null && row.failureProbability > 0.5) {
    chips.push({ label: "Elevated Risk", type: "trend" });
  }

  if (row.riskLevel === "critical") {
    chips.push({ label: "Critical Condition", type: "anomaly" });
  }

  const mode = (row.failureMode || "").toLowerCase();
  if (mode.includes("vibration")) {
    chips.push({ label: "Vibration Anomaly", type: "pattern" });
  } else if (mode.includes("temperature") || mode.includes("overheating")) {
    chips.push({ label: "Thermal Stress", type: "trend" });
  } else if (mode.includes("bearing")) {
    chips.push({ label: "Bearing Wear", type: "pattern" });
  } else if (mode.includes("oil") || mode.includes("leak")) {
    chips.push({ label: "Fluid Degradation", type: "anomaly" });
  }

  if (chips.length === 0) {
    chips.push({ label: "Scheduled Review", type: "pattern" });
  }

  return chips.slice(0, 3);
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  return `${diffMins}m ago`;
}

export function mapRiskLevel(riskLevel: string | null): RiskLevel {
  if (!riskLevel) {
    return "low";
  }
  const normalized = riskLevel.toLowerCase();
  if (normalized === "critical") {
    return "critical";
  }
  if (normalized === "high") {
    return "high";
  }
  if (normalized === "medium") {
    return "medium";
  }
  return "low";
}

export function mapAlertStatus(
  acknowledged: boolean | null,
  resolved: boolean | null
): AlertStatus {
  if (resolved) {
    return "resolved";
  }
  if (acknowledged) {
    return "acknowledged";
  }
  return "new";
}

export function mapRiskQueueRows(
  results: RiskQueryRow[],
  status?: RiskQueueStatus
): RiskQueueItem[] {
  return results.filter((row) => includeRiskQueueRow(row, status)).map(mapRiskQueueRow);
}

function includeRiskQueueRow(row: RiskQueryRow, status?: RiskQueueStatus): boolean {
  const resolved = !!row.resolvedByWorkOrderId;
  if (status === "resolved") {
    return resolved;
  }
  if (status === "active") {
    return !resolved && (row.riskLevel === "high" || row.riskLevel === "critical");
  }
  if (status === "new") {
    return !resolved && row.riskLevel !== "high" && row.riskLevel !== "critical";
  }
  return true;
}

function mapRiskQueueRow(row: RiskQueryRow): RiskQueueItem {
  const resolved = !!row.resolvedByWorkOrderId;
  const isHighSeverity = row.riskLevel === "high" || row.riskLevel === "critical";
  let computedStatus: AlertStatus = "new";
  if (resolved) {
    computedStatus = "resolved";
  } else if (isHighSeverity) {
    computedStatus = "active";
  }

  return {
    id: String(row.id),
    vesselId: row.vesselId || "",
    vesselName: row.vesselName || "Unknown Vessel",
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName || "Unknown Equipment",
    equipmentType: row.equipmentType || "Unknown",
    failureMode: row.failureMode || "Unknown",
    severity: mapRiskLevel(row.riskLevel),
    rulEstimateDays: row.remainingUsefulLife ? Math.round(row.remainingUsefulLife / 24) : null,
    rulConfidenceInterval: extractRulConfidenceInterval(row.confidenceInterval),
    confidence: Math.round((1 - (row.failureProbability || 0)) * 100),
    recommendedAction: Array.isArray(row.maintenanceRecommendations)
      ? String(row.maintenanceRecommendations[0] || "Schedule inspection")
      : "Schedule inspection",
    evidenceChips: generateEvidenceChips(row),
    status: computedStatus,
    detectedAt: row.predictionTimestamp || new Date(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    workOrderId: row.resolvedByWorkOrderId,
  };
}

function extractRulConfidenceInterval(
  confidenceInterval: unknown
): { lowDays: number; highDays: number } | null {
  if (!confidenceInterval || typeof confidenceInterval !== "object") {
    return null;
  }
  const ci = confidenceInterval as Record<string, unknown>;
  const lowHours =
    typeof ci["low"] === "number"
      ? ci["low"]
      : typeof ci["lowHours"] === "number"
        ? ci["lowHours"]
        : null;
  const highHours =
    typeof ci["high"] === "number"
      ? ci["high"]
      : typeof ci["highHours"] === "number"
        ? ci["highHours"]
        : null;
  if (lowHours === null || highHours === null) {
    return null;
  }
  return {
    lowDays: Math.round(lowHours / 24),
    highDays: Math.round(highHours / 24),
  };
}
