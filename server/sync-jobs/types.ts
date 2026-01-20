/**
 * Sync Jobs - Types
 * Shared type definitions for reconciliation
 */

export interface DataIssue {
  code: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  reference?: any;
  resolvedAt?: Date;
}

export interface ReconciliationResult {
  success: boolean;
  issues: DataIssue[];
  stats: {
    totalIssues: number;
    criticalIssues: number;
    checkedEntities: number;
    executionTimeMs: number;
  };
  timestamp: Date;
}

export interface CheckResult {
  issues: DataIssue[];
  entitiesChecked: number;
}
