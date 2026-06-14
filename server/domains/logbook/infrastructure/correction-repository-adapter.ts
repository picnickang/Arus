/**
 * Logbook Infrastructure - Correction Repository Adapter
 *
 * Implements ILogbookCorrectionRepository with raw SQL over the `log_entries`
 * and `logbook_audit_log` tables. This is the only logbook layer permitted to
 * hold the db handle (the SQL is moved verbatim from the former
 * correction-routes.ts).
 */

import { sql } from "drizzle-orm";
import { db } from "../../../db";
import type { ILogbookCorrectionRepository } from "../domain/ports";
import type {
  LogEntryRow,
  AuditLogRow,
  CorrectionActor,
  CreateCorrectionCommand,
  CorrectionRequestMeta,
  PscViewQuery,
} from "../domain/types";

function getRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as Record<string, unknown>[];
    }
  }
  return [];
}

export class LogbookCorrectionRepositoryAdapter implements ILogbookCorrectionRepository {
  async findEntryById(orgId: string, entryId: string): Promise<LogEntryRow | undefined> {
    const result = await db.execute(
      sql`SELECT * FROM log_entries WHERE id = ${entryId} AND org_id = ${orgId}`
    );
    return getRows(result)[0];
  }

  async createCorrection(
    orgId: string,
    original: LogEntryRow,
    command: CreateCorrectionCommand,
    actor: CorrectionActor,
    meta: CorrectionRequestMeta
  ): Promise<LogEntryRow | undefined> {
    const insertResult = await db.execute(sql`
      INSERT INTO log_entries (
        org_id, vessel_id, log_type, entry_date, watch_period,
        data, correction_of, correction_reason, corrected_by_id,
        author_id, author_name, author_rank,
        created_at, updated_at
      ) VALUES (
        ${orgId},
        ${original["vessel_id"]},
        ${original["log_type"]},
        ${original["entry_date"]},
        ${original["watch_period"] || null},
        ${JSON.stringify(command.correctedFields)},
        ${command.originalEntryId},
        ${command.reason},
        ${actor.id},
        ${actor.id},
        ${actor.name},
        ${actor.rank},
        NOW(), NOW()
      )
      RETURNING *
    `);

    const correctionEntry = getRows(insertResult)[0];

    await db.execute(sql`
      UPDATE log_entries
      SET is_corrected = true, updated_at = NOW()
      WHERE id = ${command.originalEntryId} AND org_id = ${orgId}
    `);

    await db.execute(sql`
      INSERT INTO logbook_audit_log (
        org_id, vessel_id, log_entry_id, action,
        performed_by, performed_by_name, performed_by_rank,
        details, ip_address, user_agent
      ) VALUES (
        ${orgId},
        ${original["vessel_id"]},
        ${command.originalEntryId},
        'corrected',
        ${actor.id},
        ${actor.name},
        ${actor.rank},
        ${JSON.stringify({
          originalEntryId: command.originalEntryId,
          correctionEntryId: correctionEntry?.["id"],
          reason: command.reason,
          correctedFields: Object.keys(command.correctedFields),
        })},
        ${meta.ipAddress || null},
        ${meta.userAgent || null}
      )
    `);

    return correctionEntry;
  }

  async listCorrectionsFor(orgId: string, entryId: string): Promise<LogEntryRow[]> {
    const result = await db.execute(sql`
      SELECT * FROM log_entries
      WHERE correction_of = ${entryId} AND org_id = ${orgId}
      ORDER BY created_at DESC
    `);
    return getRows(result);
  }

  async getAuditTrail(orgId: string, entryId: string): Promise<AuditLogRow[]> {
    const result = await db.execute(sql`
      SELECT * FROM logbook_audit_log
      WHERE log_entry_id = ${entryId} AND org_id = ${orgId}
      ORDER BY created_at ASC
    `);
    return getRows(result);
  }

  async getPscEntries(orgId: string, query: PscViewQuery): Promise<LogEntryRow[]> {
    const { vesselId, logType, fromDate, toDate } = query;
    const result = await db.execute(sql`
      SELECT
        le.*,
        CASE WHEN le.correction_of IS NOT NULL THEN 'correction' ELSE 'original' END as entry_role,
        corrected.id as corrected_by_entry_id,
        corrected.created_at as corrected_at,
        corrected.corrected_by_id as corrected_by_user
      FROM log_entries le
      LEFT JOIN log_entries corrected ON corrected.correction_of = le.id
      WHERE le.org_id = ${orgId}
        AND le.vessel_id = ${vesselId}
        AND le.entry_date >= ${fromDate}
        AND le.entry_date <= ${toDate}
        ${logType ? sql`AND le.log_type = ${logType}` : sql``}
      ORDER BY le.entry_date DESC, le.created_at DESC
    `);
    return getRows(result);
  }

  async getPscAuditSummary(orgId: string, query: PscViewQuery): Promise<AuditLogRow[]> {
    const { vesselId, fromDate, toDate } = query;
    const result = await db.execute(sql`
      SELECT action, COUNT(*) as count
      FROM logbook_audit_log
      WHERE org_id = ${orgId}
        AND vessel_id = ${vesselId}
        AND created_at >= ${fromDate}
        AND created_at <= ${toDate}
      GROUP BY action
    `);
    return getRows(result);
  }

  async countersign(orgId: string, entryId: string, actor: CorrectionActor): Promise<void> {
    await db.execute(sql`
      INSERT INTO logbook_audit_log (
        org_id, vessel_id, log_entry_id, action,
        performed_by, performed_by_name, performed_by_rank,
        details
      )
      SELECT
        ${orgId},
        vessel_id,
        ${entryId},
        'countersigned',
        ${actor.id},
        ${actor.name},
        ${actor.rank},
        ${JSON.stringify({ countersignedBy: actor.name, rank: actor.rank })}
      FROM log_entries
      WHERE id = ${entryId} AND org_id = ${orgId}
    `);
  }
}

export const logbookCorrectionRepository = new LogbookCorrectionRepositoryAdapter();
