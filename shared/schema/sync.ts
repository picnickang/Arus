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
  uniqueIndex,
  createInsertSchema,
  z,
} from "./base";
import { organizations, users } from "./core";

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

// Event-streaming spine outbox (Push B3 — durable, partitioned by orgId).
// Distinct concern from sync_outbox above (which is vessel-aware offline
// replication). Rows are written inside the same DB tx as the business write
// for transactional publish-after-commit; an out-of-process worker polls
// pending rows and dispatches to the streaming substrate (Redpanda).
export const eventOutbox = pgTable(
  "event_outbox",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    eventId: varchar("event_id").notNull(),
    eventType: text("event_type").notNull(),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    aggregateId: varchar("aggregate_id"),
    aggregateType: text("aggregate_type"),
    payload: jsonb("payload").notNull(),
    occurredAt: timestamp("occurred_at", { mode: "date" }).notNull().defaultNow(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date" }).notNull().defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { mode: "date" }),
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdUnique: uniqueIndex("uniq_event_outbox_event_id").on(table.eventId),
    pendingIdx: index("idx_event_outbox_pending").on(table.status, table.nextAttemptAt),
    orgEventIdx: index("idx_event_outbox_org_event").on(table.orgId, table.eventType),
  })
);

export const insertEventOutboxSchema = createInsertSchema(eventOutbox).omit({
  id: true,
  createdAt: true,
});
export type EventOutbox = typeof eventOutbox.$inferSelect;
export type InsertEventOutbox = z.infer<typeof insertEventOutboxSchema>;

// Request idempotency tracking
export const requestIdempotency = pgTable("request_idempotency", {
  key: varchar("key").primaryKey(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Idempotency log for duplicate request detection
export const idempotencyLog = pgTable("idempotency_log", {
  key: varchar("key").primaryKey(),
});

// Replay incoming for sync replay
export const replayIncoming = pgTable("replay_incoming", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: text("device_id"),
  endpoint: text("endpoint"),
  key: text("key"),
  receivedAt: timestamp("received_at", { mode: "date" }).defaultNow(),
});

// Sheet lock for concurrent edit prevention
export const sheetLock = pgTable("sheet_lock", {
  sheetKey: varchar("sheet_key").primaryKey(),
  token: varchar("token"),
  holder: varchar("holder"),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Sheet version for optimistic concurrency
export const sheetVersion = pgTable("sheet_version", {
  sheetKey: varchar("sheet_key").primaryKey(),
  version: integer("version").default(1),
  lastModified: timestamp("last_modified", { mode: "date" }).defaultNow(),
  lastModifiedBy: varchar("last_modified_by"),
});

// Insert schemas
export const insertSyncJournalSchema = createInsertSchema(syncJournal).omit({
  id: true,
  createdAt: true,
});
export const insertSyncOutboxSchema = createInsertSchema(syncOutbox).omit({
  id: true,
  createdAt: true,
});
export const insertRequestIdempotencySchema = createInsertSchema(requestIdempotency).omit({
  createdAt: true,
});

// Types
export type SyncJournal = typeof syncJournal.$inferSelect;
export type InsertSyncJournal = z.infer<typeof insertSyncJournalSchema>;
export type SyncOutbox = typeof syncOutbox.$inferSelect;
export type InsertSyncOutbox = z.infer<typeof insertSyncOutboxSchema>;
export type RequestIdempotency = typeof requestIdempotency.$inferSelect;
export type IdempotencyLog = typeof idempotencyLog.$inferSelect;
export type ReplayIncoming = typeof replayIncoming.$inferSelect;
export type InsertReplayIncoming = typeof replayIncoming.$inferInsert;
export type SheetLock = typeof sheetLock.$inferSelect;
export type InsertSheetLock = typeof sheetLock.$inferInsert;
export type SheetVersion = typeof sheetVersion.$inferSelect;
export type InsertSheetVersion = typeof sheetVersion.$inferInsert;
