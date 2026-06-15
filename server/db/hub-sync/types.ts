/**
 * Hub Sync - Types
 */

import type { syncJournal, syncOutbox } from "@shared/schema-runtime";

export type SyncJournal = typeof syncJournal.$inferSelect;
export type InsertSyncJournal = typeof syncJournal.$inferInsert;
export type SyncOutbox = typeof syncOutbox.$inferSelect;
export type InsertSyncOutbox = typeof syncOutbox.$inferInsert;
