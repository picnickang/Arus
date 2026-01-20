/**
 * Operating Conditions - Types
 */

export type { OperatingParameter, InsertOperatingParameter, OperatingConditionAlert, InsertOperatingConditionAlert } from "@shared/schema";

export type ViolationType = "below_optimal" | "above_optimal" | "below_critical" | "above_critical";
export type SeverityType = "info" | "warning" | "critical";

export interface OperatingViolation {
  parameterId: string;
  parameterName: string;
  currentValue: number;
  thresholdType: ViolationType;
  severity: SeverityType;
  lifeImpact?: string;
  recommendedAction?: string;
}

export interface CheckConditionsResult {
  violations: OperatingViolation[];
  alertsCreated: number;
}
