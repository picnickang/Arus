/**
 * Crew Alert Evaluators - Types
 * Interface definitions for crew alert evaluation
 */

export interface CrewAlertResult {
  triggered: boolean;
  alertType: string;
  alertKey: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  entityId?: string;
  entityType?: "crew" | "vessel" | "certificate";
  metadata?: Record<string, unknown>;
}

export interface EvaluationContext {
  orgId: string;
  vesselId?: string;
  now?: Date;
}
