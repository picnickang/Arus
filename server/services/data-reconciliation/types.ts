/**
 * Data Reconciliation - Type Definitions
 */

export interface ReconciliationIssue {
  type:
    | "missing_equipment"
    | "invalid_sensor"
    | "data_quality"
    | "org_mismatch"
    | "timestamp_anomaly"
    | "orphaned_record";
  severity: "low" | "medium" | "high" | "critical";
  recordId: string;
  equipmentId?: string;
  orgId: string;
  message: string;
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ReconciliationReport {
  orgId: string;
  runId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  recordsScanned: number;
  issuesDetected: number;
  issues: ReconciliationIssue[];
  dataQualityScore: number;
  summary: ReconciliationSummary;
}

export interface ReconciliationSummary {
  missingEquipment: number;
  invalidSensors: number;
  dataQualityIssues: number;
  orgMismatches: number;
  orphanedRecords: number;
}

export interface ValidationResult {
  issues: ReconciliationIssue[];
  scanned: number;
}

export interface ReconciliationStatus {
  enabled: boolean;
  isRunning: boolean;
  lastRun: Date | null;
  nextScheduledRun: Date;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}
