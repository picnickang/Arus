/**
 * Data Reconciliation Types
 *
 * Types for data validation and reconciliation operations.
 */

import { z } from "zod";

export const validationIssueSchema = z.object({
  type: z.enum([
    "orphaned",
    "missing_org",
    "inconsistent",
    "missing_reference",
    "validation_failure",
    "quality_issue",
    "temporal_issue",
    "unknown",
  ]),
  severity: z.enum(["critical", "warning", "info"]),
  table: z.string(),
  count: z.number().int().min(0),
  description: z.string(),
});

export const reconciliationStatusSchema = z.object({
  enabled: z.boolean(),
  lastRun: z.coerce.date().nullable(),
  nextScheduledRun: z.coerce.date(),
  isRunning: z.boolean(),
  totalRuns: z.number().int().min(0),
  successfulRuns: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  metadata: z.object({
    orgId: z.string(),
    timestamp: z.coerce.date(),
    version: z.string(),
  }),
});

export const reconciliationReportSchema = z.object({
  timestamp: z.coerce.date(),
  duration: z.number().min(0),
  totalChecks: z.number().int().min(0),
  issuesFound: z.number().int().min(0),
  issues: z.array(validationIssueSchema),
  status: z.enum(["completed", "failed", "running"]),
  metadata: z.object({
    orgId: z.string(),
    timestamp: z.coerce.date(),
    version: z.string(),
  }),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ReconciliationStatus = z.infer<typeof reconciliationStatusSchema>;
export type ReconciliationReport = z.infer<typeof reconciliationReportSchema>;
