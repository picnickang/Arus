/**
 * Logbook automation schema tables.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  unique,
  index,
  createInsertSchema,
  z,
} from "../base";
import { organizations } from "../core";
import { vessels } from "../vessels";
import { crew } from "../crew";
import { workOrders } from "../work-orders";
import { equipment } from "../equipment";

import { deckLogHourly } from "./deck";

// ============================================================================
// AUTOFILL TABLES FOR DECK LOG
// ============================================================================

// Real Postgres shape: stores a single row per hourly log capturing all
// auto-filled and overridden fields as JSONB blobs (not one-row-per-field).
// There is no org_id column — org scope is resolved via hourly_log_id →
// deck_log_hourly → vessel → organizations.
export const deckLogHourlyAutoFill = pgTable(
  "deck_log_hourly_autofill",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    hourlyLogId: varchar("hourly_log_id")
      .notNull()
      .references(() => deckLogHourly.id, { onDelete: "cascade" }),
    autoFilledAt: timestamp("auto_filled_at", { mode: "date" }).defaultNow(),
    source: text("source").notNull(),
    snapshotId: varchar("snapshot_id"),
    autoFilledFields: jsonb("auto_filled_fields"),
    overriddenAt: timestamp("overridden_at", { mode: "date" }),
    overriddenByUserId: varchar("overridden_by_user_id"),
    overriddenByUserName: text("overridden_by_user_name"),
    overriddenFields: jsonb("overridden_fields"),
    confidenceScore: real("confidence_score"),
    dataQuality: text("data_quality"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    hourlyLogIdx: index("idx_deck_log_hourly_autofill_hourly").on(table.hourlyLogId),
    snapshotIdx: index("idx_deck_log_hourly_autofill_snapshot").on(table.snapshotId),
    sourceIdx: index("idx_deck_log_hourly_autofill_source").on(table.source),
  })
);

export const insertDeckLogHourlyAutoFillSchema = createInsertSchema(deckLogHourlyAutoFill).omit({
  id: true,
  autoFilledAt: true,
  createdAt: true,
  updatedAt: true,
});

export type DeckLogHourlyAutoFill = typeof deckLogHourlyAutoFill.$inferSelect;
export type InsertDeckLogHourlyAutoFill = z.infer<typeof insertDeckLogHourlyAutoFillSchema>;
