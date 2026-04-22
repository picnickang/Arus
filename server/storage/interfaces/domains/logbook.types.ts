/**
 * Logbook Storage Interface - Deck Logs, Engine Logs, Events, Watches
 * Part of IStorage modularization for improved maintainability
 */

import type {
  DeckLogDaily,
  InsertDeckLogDaily,
  DeckLogHourly,
  InsertDeckLogHourly,
  DeckLogWatch,
  InsertDeckLogWatch,
  DeckLogEvent,
  InsertDeckLogEvent,
  EngineLogDaily,
  InsertEngineLogDaily,
  EngineLogHourly,
  InsertEngineLogHourly,
  EngineLogGenerator,
  InsertEngineLogGenerator,
  EngineLogWatch,
  InsertEngineLogWatch,
  EngineLogEvent,
  InsertEngineLogEvent,
  DeckLogHourlyAutoFill,
  InsertDeckLogHourlyAutoFill,
  SheetLock,
  SheetVersion,
  InsertSheetVersion,
} from "@shared/schema";

/**
 * Logbook storage operations for deck and engine logs
 */
export interface ILogbookStorage {
  // Deck Log Daily
  getDeckLogDaily(
    orgId: string,
    filters?: { vesselId?: string; startDate?: string; endDate?: string; status?: string }
  ): Promise<DeckLogDaily[]>;
  getDeckLogDailyById(id: string, orgId: string): Promise<DeckLogDaily | undefined>;
  getDeckLogDailyByDate(
    vesselId: string,
    logDate: string,
    orgId: string
  ): Promise<DeckLogDaily | undefined>;
  createDeckLogDaily(entry: InsertDeckLogDaily): Promise<DeckLogDaily>;
  updateDeckLogDaily(
    id: string,
    entry: Partial<InsertDeckLogDaily>,
    orgId: string
  ): Promise<DeckLogDaily>;
  deleteDeckLogDaily(id: string, orgId: string): Promise<void>;
  signDeckLogDaily(
    id: string,
    signData: { signedByCrewId: string; signedByName: string; signedByRank: string },
    orgId: string
  ): Promise<DeckLogDaily>;
  lockDeckLogDaily(
    id: string,
    lockData: { lockedByUserId: string; lockedByUserName: string },
    orgId: string
  ): Promise<DeckLogDaily>;
  unlockDeckLogDaily(id: string, orgId: string): Promise<DeckLogDaily>;
  getDeckLogComplete(
    dailyLogId: string,
    orgId: string
  ): Promise<{ daily: DeckLogDaily; hourly: DeckLogHourly[]; watches: DeckLogWatch[] } | undefined>;

  // Deck Log Hourly
  getDeckLogHourly(dailyLogId: string, orgId: string): Promise<DeckLogHourly[]>;
  getDeckLogHourlyByHour(
    dailyLogId: string,
    hour: number,
    orgId: string
  ): Promise<DeckLogHourly | undefined>;
  upsertDeckLogHourly(entry: InsertDeckLogHourly): Promise<DeckLogHourly>;
  bulkUpsertDeckLogHourly(entries: InsertDeckLogHourly[]): Promise<DeckLogHourly[]>;
  deleteDeckLogHourly(id: string, orgId: string): Promise<void>;

  // Deck Log Watch
  getDeckLogWatch(dailyLogId: string, orgId: string): Promise<DeckLogWatch[]>;
  getDeckLogWatchByPeriod(
    dailyLogId: string,
    watchPeriod: string,
    orgId: string
  ): Promise<DeckLogWatch | undefined>;
  upsertDeckLogWatch(entry: InsertDeckLogWatch): Promise<DeckLogWatch>;
  deleteDeckLogWatch(id: string, orgId: string): Promise<void>;

  // Deck Log Events
  getDeckLogEvents(
    dayId: string,
    orgId: string,
    filters?: { eventType?: string; source?: string; startTime?: Date; endTime?: Date }
  ): Promise<DeckLogEvent[]>;
  getDeckLogEventById(id: string, orgId: string): Promise<DeckLogEvent | undefined>;
  getDeckLogEventByIdempotencyKey(key: string, orgId: string): Promise<DeckLogEvent | undefined>;
  createDeckLogEvent(event: InsertDeckLogEvent): Promise<DeckLogEvent>;
  updateDeckLogEvent(
    id: string,
    event: Partial<InsertDeckLogEvent>,
    orgId: string
  ): Promise<DeckLogEvent>;
  deleteDeckLogEvent(id: string, orgId: string): Promise<void>;

  // Deck Log Auto-Fill
  getDeckLogHourlyAutoFill(hourlyLogId: string): Promise<DeckLogHourlyAutoFill | undefined>;
  createDeckLogHourlyAutoFill(
    autoFill: InsertDeckLogHourlyAutoFill
  ): Promise<DeckLogHourlyAutoFill>;
  updateDeckLogHourlyAutoFill(
    id: string,
    autoFill: Partial<InsertDeckLogHourlyAutoFill>
  ): Promise<DeckLogHourlyAutoFill>;
  markAutoFillOverridden(
    hourlyLogId: string,
    overriddenFields: string[],
    userId: string,
    userName: string
  ): Promise<DeckLogHourlyAutoFill>;

  // Engine Log Daily
  getEngineLogDaily(
    orgId: string,
    filters?: { vesselId?: string; startDate?: string; endDate?: string; status?: string }
  ): Promise<EngineLogDaily[]>;
  getEngineLogDailyById(id: string, orgId: string): Promise<EngineLogDaily | undefined>;
  getEngineLogDailyByDate(
    vesselId: string,
    logDate: string,
    orgId: string
  ): Promise<EngineLogDaily | undefined>;
  createEngineLogDaily(entry: InsertEngineLogDaily): Promise<EngineLogDaily>;
  updateEngineLogDaily(
    id: string,
    entry: Partial<InsertEngineLogDaily>,
    orgId: string
  ): Promise<EngineLogDaily>;
  deleteEngineLogDaily(id: string, orgId: string): Promise<void>;
  signEngineLogDaily(
    id: string,
    signData: { signedByCrewId: string; signedByName: string; signedByRank: string },
    orgId: string
  ): Promise<EngineLogDaily>;
  lockEngineLogDaily(
    id: string,
    lockData: { lockedByUserId: string; lockedByUserName: string },
    orgId: string
  ): Promise<EngineLogDaily>;
  unlockEngineLogDaily(id: string, orgId: string): Promise<EngineLogDaily>;
  getEngineLogComplete(
    dailyLogId: string,
    orgId: string
  ): Promise<
    | {
        daily: EngineLogDaily;
        hourly: EngineLogHourly[];
        generators: EngineLogGenerator[];
        watches: EngineLogWatch[];
      }
    | undefined
  >;

  // Engine Log Hourly
  getEngineLogHourly(dailyLogId: string, orgId: string): Promise<EngineLogHourly[]>;
  getEngineLogHourlyByHour(
    dailyLogId: string,
    hour: number,
    orgId: string
  ): Promise<EngineLogHourly | undefined>;
  upsertEngineLogHourly(entry: InsertEngineLogHourly): Promise<EngineLogHourly>;
  bulkUpsertEngineLogHourly(entries: InsertEngineLogHourly[]): Promise<EngineLogHourly[]>;
  deleteEngineLogHourly(id: string, orgId: string): Promise<void>;

  // Engine Log Generator
  getEngineLogGenerator(dailyLogId: string, orgId: string): Promise<EngineLogGenerator[]>;
  getEngineLogGeneratorByHour(
    dailyLogId: string,
    hour: number,
    orgId: string
  ): Promise<EngineLogGenerator[]>;
  upsertEngineLogGenerator(entry: InsertEngineLogGenerator): Promise<EngineLogGenerator>;
  bulkUpsertEngineLogGenerator(entries: InsertEngineLogGenerator[]): Promise<EngineLogGenerator[]>;
  deleteEngineLogGenerator(id: string, orgId: string): Promise<void>;

  // Engine Log Watch
  getEngineLogWatch(dailyLogId: string, orgId: string): Promise<EngineLogWatch[]>;
  getEngineLogWatchByPeriod(
    dailyLogId: string,
    watchPeriod: string,
    orgId: string
  ): Promise<EngineLogWatch | undefined>;
  upsertEngineLogWatch(entry: InsertEngineLogWatch): Promise<EngineLogWatch>;
  deleteEngineLogWatch(id: string, orgId: string): Promise<void>;

  // Engine Log Events
  getEngineLogEvents(
    dayId: string,
    orgId: string,
    filters?: { eventType?: string; source?: string; startTime?: Date; endTime?: Date }
  ): Promise<EngineLogEvent[]>;
  getEngineLogEventById(id: string, orgId: string): Promise<EngineLogEvent | undefined>;
  getEngineLogEventByIdempotencyKey(
    key: string,
    orgId: string
  ): Promise<EngineLogEvent | undefined>;
  createEngineLogEvent(event: InsertEngineLogEvent): Promise<EngineLogEvent>;
  updateEngineLogEvent(
    id: string,
    event: Partial<InsertEngineLogEvent>,
    orgId: string
  ): Promise<EngineLogEvent>;
  deleteEngineLogEvent(id: string, orgId: string): Promise<void>;

  // Sheet Locking
  acquireSheetLock(
    sheetKey: string,
    holder: string,
    token: string,
    expiresAt: Date
  ): Promise<SheetLock>;
  releaseSheetLock(sheetKey: string, token: string): Promise<void>;
  getSheetLock(sheetKey: string): Promise<SheetLock | undefined>;
  isSheetLocked(sheetKey: string): Promise<boolean>;

  // Sheet Versioning
  getSheetVersion(sheetKey: string): Promise<SheetVersion | undefined>;
  incrementSheetVersion(sheetKey: string, modifiedBy: string): Promise<SheetVersion>;
  setSheetVersion(version: InsertSheetVersion): Promise<SheetVersion>;
}
