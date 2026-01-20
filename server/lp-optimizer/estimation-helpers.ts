/**
 * LP Optimizer - Estimation Helper Functions
 */

import type { MaintenanceJob, OptimizationConstraints } from "./types.js";

export function getPriorityCost(
  priority: number,
  weights: OptimizationConstraints["priorityWeights"]
): number {
  const priorityMap = { 1: weights.critical, 2: weights.high, 3: weights.medium, 4: weights.low };
  return priorityMap[priority as keyof typeof priorityMap] || weights.low;
}

export function getRequiredSkillLevel(maintenanceType: string, equipmentType: string): number {
  if (equipmentType === "engine" && maintenanceType === "corrective") { return 4; }
  if (equipmentType === "engine") { return 3; }
  if (maintenanceType === "corrective") { return 3; }
  return 2;
}

export function getRequiredSkillLevelFromPriority(priority: number): number {
  return priority === 1 ? 4 : priority <= 2 ? 3 : 2;
}

export function estimateWorkOrderDuration(description: string, priority: number): number {
  const baseTime = priority === 1 ? 240 : 120;

  const keywords = (description || "").toLowerCase();
  let multiplier = 1;

  if (keywords.includes("replace") || keywords.includes("overhaul")) { multiplier = 2; }
  if (keywords.includes("inspect") || keywords.includes("check")) { multiplier = 0.5; }
  if (keywords.includes("complex") || keywords.includes("rebuild")) { multiplier = 3; }

  return Math.round(baseTime * multiplier);
}

export function estimatePartsRequired(
  maintenanceType: string,
  equipmentType: string,
  _inventory: any[]
): MaintenanceJob["parts"] {
  const parts: MaintenanceJob["parts"] = [];

  if (maintenanceType === "preventive") {
    if (equipmentType === "engine") {
      parts.push({ partId: "filter-oil", quantity: 1, unitCost: 25 }, { partId: "oil", quantity: 5, unitCost: 8 });
    }
  } else if (maintenanceType === "corrective") {
    parts.push({ partId: "spare-parts-general", quantity: 1, unitCost: 100 });
  }

  return parts;
}

export function estimatePartsFromDescription(
  description: string,
  _inventory: any[]
): MaintenanceJob["parts"] {
  const parts: MaintenanceJob["parts"] = [];
  const desc = (description || "").toLowerCase();

  if (desc.includes("oil")) {
    parts.push({ partId: "oil", quantity: 5, unitCost: 8 });
  }

  if (desc.includes("filter")) {
    parts.push({ partId: "filter", quantity: 1, unitCost: 25 });
  }

  if (desc.includes("belt")) {
    parts.push({ partId: "belt", quantity: 1, unitCost: 45 });
  }

  return parts.length > 0 ? parts : [{ partId: "misc", quantity: 1, unitCost: 50 }];
}

export function createEmptyResult(optimizationTime: number) {
  return {
    success: true,
    objectiveValue: 0,
    schedule: [],
    resourceUtilization: {
      crewUtilization: [],
      dailyWorkload: [],
      totalCost: 0,
      partsUsedBudget: 0,
    },
    constraints: {
      feasible: true,
      violations: [],
    },
    optimizationTime,
  };
}
