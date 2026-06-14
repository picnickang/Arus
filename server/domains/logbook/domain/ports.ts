/**
 * Logbook Domain - Ports (corrections / audit slice)
 *
 * The concrete adapter (raw SQL over log_entries / logbook_audit_log) lives in
 * infrastructure/; no port references the db handle.
 */

import type {
  LogEntryRow,
  AuditLogRow,
  CorrectionActor,
  CreateCorrectionCommand,
  CorrectionRequestMeta,
  PscViewQuery,
} from "./types";

export interface ILogbookCorrectionRepository {
  /** Fetch a single log entry (for existence checks). */
  findEntryById(orgId: string, entryId: string): Promise<LogEntryRow | undefined>;

  /**
   * Create a correction entry, mark the original as corrected, and write the
   * audit-log record — mirroring the original three-statement sequence. Returns
   * the inserted correction row.
   */
  createCorrection(
    orgId: string,
    original: LogEntryRow,
    command: CreateCorrectionCommand,
    actor: CorrectionActor,
    meta: CorrectionRequestMeta
  ): Promise<LogEntryRow | undefined>;

  listCorrectionsFor(orgId: string, entryId: string): Promise<LogEntryRow[]>;
  getAuditTrail(orgId: string, entryId: string): Promise<AuditLogRow[]>;

  getPscEntries(orgId: string, query: PscViewQuery): Promise<LogEntryRow[]>;
  getPscAuditSummary(orgId: string, query: PscViewQuery): Promise<AuditLogRow[]>;

  countersign(orgId: string, entryId: string, actor: CorrectionActor): Promise<void>;
}
