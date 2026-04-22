/**
 * Schema Sync - Synchronization Journal and Outbox
 * 
 * Tables for event sourcing, sync tracking, and idempotency.
 */

import {
  sql,
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  createInsertSchema,
  z,
} from "./base";
import { users } from "./core";

// Sync journal for audit trails and change tracking (vessel-aware)
export const syncJournal = pgTable(
  "sync_journal",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entityType: text("entity_type").notNull(),
    entityId: varchar("entity_id").notNull(),
    operation: text("operation").notNull(),
    payload: jsonb("payload"),
    userId: varchar("user_id").references(() => users.id),
    vesselId: varchar("vessel_id"),
    syncType: text("sync_type"),
    status: text("status").notNull().default("pending"),
    syncStatus: text("sync_status").default("pending"),
    retryCount: integer("retry_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    entityIndex: index("idx_sync_journal_entity").on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    vesselStatusIdx: index("idx_sync_journal_vessel_status").on(table.vesselId, table.status),
  })
);

// Sync outbox for event publishing and real-time notifications (vessel-aware + priority)
export const syncOutbox = pgTable(
  "sync_outbox",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload"),
    processed: boolean("processed").default(false),
    processingAttempts: integer("processing_attempts").default(0),
    vesselId: varchar("vessel_id"),
    status: text("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(100),
    syncedAt: timestamp("synced_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
  },
  (table) => ({
    eventIndex: index("idx_sync_outbox_event").on(table.eventType, table.processed),
    vesselStatusPriorityIdx: index("idx_sync_outbox_vessel_status_priority").on(
      table.vesselId,
      table.status,
      table.priority
    ),
  })
);

// Request idempotency tracking
export const requestIdempotency = pgTable("request_idempotency", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  requestId: text("request_id").notNull().unique(),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Idempotency log for duplicate request detection
export const idempotencyLog = pgTable("idempotency_log", {
  key: varchar("key").primaryKey(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});

// Replay incoming for sync replay
export const replayIncoming = pgTable("replay_incoming", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  payload: jsonb("payload"),
  processedAt: timestamp("processed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Sheet lock for concurrent edit prevention
export const sheetLock = pgTable("sheet_lock", {
  sheetId: varchar("sheet_id").primaryKey(),
  lockedBy: varchar("locked_by").notNull(),
  lockedAt: timestamp("locked_at", { mode: "date" }).defaultNow(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});

// Sheet version for optimistic concurrency
export const sheetVersion = pgTable("sheet_version", {
  sheetId: varchar("sheet_id").primaryKey(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

// Insert schemas
export const insertSyncJournalSchema = createInsertSchema(syncJournal).omit({ id: true, createdAt: true });
export const insertSyncOutboxSchema = createInsertSchema(syncOutbox).omit({ id: true, createdAt: true });
export const insertRequestIdempotencySchema = createInsertSchema(requestIdempotency).omit({ id: true, createdAt: true });

// Types
export type SyncJournal = typeof syncJournal.$inferSelect;
export type InsertSyncJournal = z.infer<typeof insertSyncJournalSchema>;
export type SyncOutbox = typeof syncOutbox.$inferSelect;
export type InsertSyncOutbox = z.infer<typeof insertSyncOutboxSchema>;
export type RequestIdempotency = typeof requestIdempotency.$inferSelect;
export type IdempotencyLog = typeof idempotencyLog.$inferSelect;
export type ReplayIncoming = typeof replayIncoming.$inferSelect;
export type SheetLock = typeof sheetLock.$inferSelect;
export type InsertSheetLock = typeof sheetLock.$inferInsert;
export type SheetVersion = typeof sheetVersion.$inferSelect;
