/**
 * ============================================================================
 * SHIPMATE Import Manifest — audit trail for SHIPMATE imports
 * ============================================================================
 *
 * One row per import attempt. Recorded inside the import transaction so the
 * customer can answer "what did this import actually touch?" after the fact.
 *
 * Place at: shared/schema/import-manifest.ts
 * Re-export from shared/schema/index.ts:
 *   export * from "./import-manifest";
 *
 * Wave: launch P0, Fix #2 (transactional wrapping support)
 * ============================================================================
 */

import { pgTable, varchar, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { timestamps } from "./base";
import { organizations } from "./core";

export const importManifest = pgTable(
  "import_manifest",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),

    // What was imported
    sourceSystem: text("source_system").notNull(), // "shipmate" | "amos" | future
    module: text("module").notNull(), // "pms_equipment" | "pms_jobs" | "sps_stores"
    filename: text("filename"), // the upload filename, if available

    // Which vessel
    vesselId: varchar("vessel_id"), // resolved vessel ID (null if not resolved)
    vesselNameRequested: text("vessel_name_requested"), // what the user asked for

    // Lifecycle
    status: text("status").notNull().default("running"), // "running" | "committed" | "rolled_back" | "failed"
    startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),

    // Counts
    rowsTotal: integer("rows_total").default(0),
    rowsImported: integer("rows_imported").default(0),
    rowsUpdated: integer("rows_updated").default(0),
    rowsSkipped: integer("rows_skipped").default(0),

    // Diagnostics
    errorMessage: text("error_message"),
    firstErrors: jsonb("first_errors"), // first ~20 errors for triage

    // Who
    initiatedBy: varchar("initiated_by"), // user id, if known

    ...timestamps(),
  },
  (table) => ({
    orgStatusIdx: index("idx_import_manifest_org_status").on(table.orgId, table.status),
    vesselIdx: index("idx_import_manifest_vessel").on(table.vesselId),
    startedAtIdx: index("idx_import_manifest_started_at").on(table.startedAt),
  })
);

export const insertImportManifestSchema = createInsertSchema(importManifest).omit({
  id: true,
  startedAt: true,
});

export type ImportManifest = typeof importManifest.$inferSelect;
export type InsertImportManifest = z.infer<typeof insertImportManifestSchema>;
