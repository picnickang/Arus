/**
 * Logbook Domain - Types (corrections / audit slice)
 *
 * The correction/audit endpoints operate over the raw `log_entries` and
 * `logbook_audit_log` tables and return row shapes verbatim, so rows are modelled
 * as `Record<string, unknown>` (behaviour-preserving). The remaining logbook
 * route groups (deck/engine/autofill) are flat support pending later conversion.
 */

export type LogEntryRow = Record<string, unknown>;
export type AuditLogRow = Record<string, unknown>;

export interface CorrectionActor {
  id: string;
  name: string;
  rank: string;
}

export interface CreateCorrectionCommand {
  originalEntryId: string;
  correctedFields: Record<string, unknown>;
  reason: string;
}

export interface CorrectionRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PscViewQuery {
  vesselId: string;
  logType?: string | undefined;
  fromDate: Date;
  toDate: Date;
}

export interface PscViewResult {
  vessel_id: string;
  period: { from: Date; to: Date };
  totalEntries: number;
  correctedEntries: number;
  corrections: number;
  auditSummary: AuditLogRow[];
  entries: LogEntryRow[];
}
