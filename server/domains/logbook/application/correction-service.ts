/**
 * Logbook Correction Application Service
 * Orchestrates logbook corrections, audit, PSC view, and countersign via the
 * ILogbookCorrectionRepository port (constructor DI).
 */

import type { ILogbookCorrectionRepository } from "../domain/ports";
import type {
  LogEntryRow,
  AuditLogRow,
  CorrectionActor,
  CreateCorrectionCommand,
  CorrectionRequestMeta,
  PscViewQuery,
  PscViewResult,
} from "../domain/types";

/** Thrown when the referenced original log entry does not exist. */
export class OriginalEntryNotFoundError extends Error {
  constructor() {
    super("Original log entry not found");
    this.name = "OriginalEntryNotFoundError";
  }
}

export class LogbookCorrectionService {
  constructor(private readonly repository: ILogbookCorrectionRepository) {}

  async createCorrection(
    orgId: string,
    command: CreateCorrectionCommand,
    actor: CorrectionActor,
    meta: CorrectionRequestMeta
  ): Promise<LogEntryRow | undefined> {
    const original = await this.repository.findEntryById(orgId, command.originalEntryId);
    if (!original) {
      throw new OriginalEntryNotFoundError();
    }
    return this.repository.createCorrection(orgId, original, command, actor, meta);
  }

  listCorrectionsFor(orgId: string, entryId: string): Promise<LogEntryRow[]> {
    return this.repository.listCorrectionsFor(orgId, entryId);
  }

  getAuditTrail(orgId: string, entryId: string): Promise<AuditLogRow[]> {
    return this.repository.getAuditTrail(orgId, entryId);
  }

  async getPscView(orgId: string, query: PscViewQuery): Promise<PscViewResult> {
    const [entries, auditSummary] = await Promise.all([
      this.repository.getPscEntries(orgId, query),
      this.repository.getPscAuditSummary(orgId, query),
    ]);

    return {
      vessel_id: query.vesselId,
      period: { from: query.fromDate, to: query.toDate },
      totalEntries: entries.length,
      correctedEntries: entries.filter((e) =>
        Boolean((e as { is_corrected?: unknown }).is_corrected)
      ).length,
      corrections: entries.filter((e) =>
        Boolean((e as { correction_of?: unknown }).correction_of)
      ).length,
      auditSummary,
      entries,
    };
  }

  countersign(orgId: string, entryId: string, actor: CorrectionActor): Promise<void> {
    return this.repository.countersign(orgId, entryId, actor);
  }
}
