import { pgTable, varchar, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./schema";

// Conflict tracking table for offline sync conflict resolution
export const syncConflicts = pgTable(
  "sync_conflicts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),

    // Conflict identification
    tableName: varchar("table_name", { length: 255 }).notNull(),
    recordId: varchar("record_id", { length: 255 }).notNull(),
    fieldName: varchar("field_name", { length: 255 }),

    // Local (device) values
    localValue: text("local_value"),
    localVersion: integer("local_version"),
    localTimestamp: timestamp("local_timestamp", { mode: "date" }),
    localUser: varchar("local_user", { length: 255 }),
    localDevice: varchar("local_device", { length: 255 }),

    // Server values
    serverValue: text("server_value"),
    serverVersion: integer("server_version"),
    serverTimestamp: timestamp("server_timestamp", { mode: "date" }),
    serverUser: varchar("server_user", { length: 255 }),
    serverDevice: varchar("server_device", { length: 255 }),

    // Resolution
    resolutionStrategy: varchar("resolution_strategy", { length: 50 }), // 'manual', 'max', 'append', 'lww', 'priority', 'or'
    resolved: boolean("resolved").default(false),
    resolvedValue: text("resolved_value"),
    resolvedBy: varchar("resolved_by", { length: 255 }),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),

    // Safety classification
    isSafetyCritical: boolean("is_safety_critical").default(false),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    unresolvedIdx: index("idx_sync_conflicts_unresolved")
      .on(table.orgId, table.resolved)
      .where(sql`${table.resolved} = false`),
    safetyIdx: index("idx_sync_conflicts_safety")
      .on(table.orgId, table.isSafetyCritical, table.resolved)
      .where(sql`${table.isSafetyCritical} = true AND ${table.resolved} = false`),
  })
);

// Types and schemas
export const insertSyncConflictSchema = createInsertSchema(syncConflicts).omit({
  id: true,
  createdAt: true,
});

export type SyncConflict = typeof syncConflicts.$inferSelect;
export type InsertSyncConflict = z.infer<typeof insertSyncConflictSchema>;
