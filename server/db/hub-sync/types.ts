/**
 * Hub Sync - Types
 */

import type {
  syncJournal,
  syncOutbox,
  deviceRegistry,
  replayIncoming,
  sheetLock,
  sheetVersion,
} from "@shared/schema-runtime";

export type SyncJournal = typeof syncJournal.$inferSelect;
export type InsertSyncJournal = typeof syncJournal.$inferInsert;
export type SyncOutbox = typeof syncOutbox.$inferSelect;
export type InsertSyncOutbox = typeof syncOutbox.$inferInsert;

export type { Device, InsertDevice } from "@shared/schema-runtime";

export type SelectDeviceRegistry = typeof deviceRegistry.$inferSelect;
export type InsertDeviceRegistry = typeof deviceRegistry.$inferInsert;
export type SelectReplayIncoming = typeof replayIncoming.$inferSelect;
export type InsertReplayIncoming = typeof replayIncoming.$inferInsert;
export type SelectSheetLock = typeof sheetLock.$inferSelect;
export type InsertSheetLock = typeof sheetLock.$inferInsert;
export type SelectSheetVersion = typeof sheetVersion.$inferSelect;
export type InsertSheetVersion = typeof sheetVersion.$inferInsert;
