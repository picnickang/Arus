/**
 * Risk Matrix Parser - Parse AI recommendations into structured data
 */

import type { EquipmentRisk, PrioritizedAction } from "./types";
import type { EquipmentDossier } from "./dossier-builder";

export interface ParsedRecommendations {
  riskMatrix: EquipmentRisk[];
  prioritizedActions: PrioritizedAction[];
}

/**
 * Parse AI recommendations into structured risk matrix and prioritized actions
 */
export function parseRecommendations(
  recommendations: string[],
  equipmentDossiers: EquipmentDossier[]
): ParsedRecommendations {
  const riskMatrix: EquipmentRisk[] = [];
  const prioritizedActions: PrioritizedAction[] = [];

  if (!recommendations || recommendations.length === 0) {
    return { riskMatrix, prioritizedActions };
  }

  recommendations.forEach((recommendation: string) => {
    const parts = recommendation.split(" - ");
    if (parts.length < 4) {
      return;
    }
    const equipmentPart = parts[0];
    const impactPart = parts[1];
    const timePart = parts[2];
    const compliancePart = parts[3];
    if (
      equipmentPart === undefined ||
      impactPart === undefined ||
      timePart === undefined ||
      compliancePart === undefined
    ) {
      return;
    }
    const equipmentMatch = /^(\w+):\s{0,10}([^(]{1,200}?)\s{0,10}\((\d+)%\)/.exec(equipmentPart);
    if (!equipmentMatch) {
      return;
    }

    const equipmentId = equipmentMatch[1];
    const failureMode = equipmentMatch[2];
    const probabilityStr = equipmentMatch[3];
    if (equipmentId === undefined || failureMode === undefined || probabilityStr === undefined) {
      return;
    }
    const probability = Number.parseInt(probabilityStr);

    const impactLevel = determineImpactLevel(impactPart);
    const impactWeight = { Low: 1, Medium: 2, High: 3, Critical: 4 }[impactLevel];
    const riskScore = probability * impactWeight;

    const urgency = determineUrgency(timePart);

    const equipmentDossier = equipmentDossiers.find((d: { id?: string }) => d.id === equipmentId);
    const linkedWorkOrderId =
      (equipmentDossier?.context.workOrderStats.openCount ?? 0) > 0
        ? `work-order-${equipmentId}`
        : undefined;

    riskMatrix.push({
      equipmentId,
      failureMode,
      probability,
      impact: impactLevel,
      riskScore,
      urgency,
      complianceRequirement: compliancePart,
      ...(linkedWorkOrderId !== undefined && { linkedWorkOrderId }),
    });

    const businessImpact = determineBusinessImpact(impactPart);

    prioritizedActions.push({
      equipmentId,
      action: `Address ${failureMode.toLowerCase()}`,
      priority: Math.max(1, Math.ceil(riskScore / 100)),
      riskScore,
      businessImpact,
      timeWindow: timePart,
      resourceRequirement: compliancePart.includes("Class")
        ? "External survey required"
        : "Internal maintenance team",
      ...(linkedWorkOrderId !== undefined && { linkedWorkOrderId }),
      ...(timePart.includes("port") && { complianceDeadline: "Next port call" }),
    });
  });

  prioritizedActions.sort((a, b) => b.riskScore - a.riskScore);
  return { riskMatrix, prioritizedActions };
}

function determineImpactLevel(impactPart: string): "Low" | "Medium" | "High" | "Critical" {
  if (impactPart.includes("Safety critical") || impactPart.includes("SOLAS")) {
    return "Critical";
  }

  if (impactPart.includes("compliance")) {
    return "High";
  }

  if (impactPart.includes("Performance")) {
    return "Medium";
  }
  return "Low";
}

function determineUrgency(timePart: string): "Immediate" | "NextPort" | "Weekly" | "Monthly" {
  if (timePart.includes("48hrs") || timePart.includes("Immediate")) {
    return "Immediate";
  }

  if (timePart.includes("port")) {
    return "NextPort";
  }

  if (timePart.includes("weekly") || timePart.includes("Bi-weekly")) {
    return "Weekly";
  }
  return "Monthly";
}

function determineBusinessImpact(
  impactPart: string
): "Safety" | "Compliance" | "Operational" | "Financial" {
  if (impactPart.includes("Safety")) {
    return "Safety";
  }

  if (impactPart.includes("compliance") || impactPart.includes("SOLAS")) {
    return "Compliance";
  }

  if (impactPart.includes("Performance")) {
    return "Operational";
  }
  return "Financial";
}
