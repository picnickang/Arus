/**
 * SQLite Import/Audit Tables
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

const textIdDefault = sql.raw(
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))"
);

export function getImportTablesSql(): SQL[] {
  return [
    sql`CREATE TABLE IF NOT EXISTS import_manifest (id TEXT PRIMARY KEY DEFAULT (${textIdDefault}), org_id TEXT NOT NULL, source_system TEXT NOT NULL, module TEXT NOT NULL, filename TEXT, vessel_id TEXT, vessel_name_requested TEXT, status TEXT NOT NULL DEFAULT 'running', started_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), completed_at INTEGER, rows_total INTEGER DEFAULT 0, rows_imported INTEGER DEFAULT 0, rows_updated INTEGER DEFAULT 0, rows_skipped INTEGER DEFAULT 0, error_message TEXT, first_errors TEXT, initiated_by TEXT)`,
  ];
}

export function getImportIndexesSql(): SQL[] {
  return [
    sql`CREATE INDEX IF NOT EXISTS idx_import_manifest_org_status ON import_manifest(org_id, status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_import_manifest_vessel ON import_manifest(vessel_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_import_manifest_started_at ON import_manifest(started_at)`,
  ];
}
