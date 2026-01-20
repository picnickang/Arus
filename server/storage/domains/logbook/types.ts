/**
 * Logbook Storage Types
 * Digital Deck and Engine Room Logbook type definitions
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
} from "@shared/schema-runtime";

export interface DeckLogFilters {
  vesselId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface EngineLogFilters {
  vesselId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface LogEventFilters {
  eventType?: string;
  source?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface SignData {
  signedByCrewId: string;
  signedByName: string;
  signedByRank: string;
}

export interface LockData {
  lockedByUserId: string;
  lockedByUserName: string;
}

export interface DeckLogComplete {
  daily: DeckLogDaily;
  hourly: DeckLogHourly[];
  watches: DeckLogWatch[];
}

export interface EngineLogComplete {
  daily: EngineLogDaily;
  hourly: EngineLogHourly[];
  generators: EngineLogGenerator[];
  watches: EngineLogWatch[];
}

/**
 * Logbook Storage Interface
 * Defines all operations for digital logbook management
 */
export interface ILogbookStorage {
  // ===== DECK LOG DAILY =====
  getDeckLogDaily(orgId: string, filters?: DeckLogFilters): Promise<DeckLogDaily[]>;
  getDeckLogDailyById(id: string, orgId: string): Promise<DeckLogDaily | undefined>;
  getDeckLogDailyByDate(vesselId: string, logDate: string, orgId: string): Promise<DeckLogDaily | undefined>;
  createDeckLogDaily(entry: InsertDeckLogDaily): Promise<DeckLogDaily>;
  updateDeckLogDaily(id: string, entry: Partial<InsertDeckLogDaily>, orgId: string): Promise<DeckLogDaily>;
  deleteDeckLogDaily(id: string, orgId: string): Promise<void>;
  signDeckLogDaily(id: string, signData: SignData, orgId: string): Promise<DeckLogDaily>;
  lockDeckLogDaily(id: string, lockData: LockData, orgId: string): Promise<DeckLogDaily>;
  unlockDeckLogDaily(id: string, orgId: string): Promise<DeckLogDaily>;

  // ===== DECK LOG HOURLY =====
  getDeckLogHourly(dailyLogId: string, orgId: string): Promise<DeckLogHourly[]>;
  getDeckLogHourlyByHour(dailyLogId: string, hour: number, orgId: string): Promise<DeckLogHourly | undefined>;
  upsertDeckLogHourly(entry: InsertDeckLogHourly): Promise<DeckLogHourly>;
  bulkUpsertDeckLogHourly(entries: InsertDeckLogHourly[]): Promise<DeckLogHourly[]>;
  deleteDeckLogHourly(id: string, orgId: string): Promise<void>;

  // ===== DECK LOG WATCH =====
  getDeckLogWatch(dailyLogId: string, orgId: string): Promise<DeckLogWatch[]>;
  getDeckLogWatchByPeriod(dailyLogId: string, watchPeriod: string, orgId: string): Promise<DeckLogWatch | undefined>;
  upsertDeckLogWatch(entry: InsertDeckLogWatch): Promise<DeckLogWatch>;
  deleteDeckLogWatch(id: string, orgId: string): Promise<void>;

  // ===== DECK LOG COMPLETE =====
  getDeckLogComplete(dailyLogId: string, orgId: string): Promise<DeckLogComplete | undefined>;

  // ===== DECK LOG EVENTS =====
  getDeckLogEvents(dayId: string, orgId: string, filters?: LogEventFilters): Promise<DeckLogEvent[]>;
  getDeckLogEventById(id: string, orgId: string): Promise<DeckLogEvent | undefined>;
  getDeckLogEventByIdempotencyKey(key: string, orgId: string): Promise<DeckLogEvent | undefined>;
  createDeckLogEvent(event: InsertDeckLogEvent): Promise<DeckLogEvent>;
  updateDeckLogEvent(id: string, event: Partial<InsertDeckLogEvent>, orgId: string): Promise<DeckLogEvent>;
  deleteDeckLogEvent(id: string, orgId: string): Promise<void>;

  // ===== ENGINE LOG DAILY =====
  getEngineLogDaily(orgId: string, filters?: EngineLogFilters): Promise<EngineLogDaily[]>;
  getEngineLogDailyById(id: string, orgId: string): Promise<EngineLogDaily | undefined>;
  getEngineLogDailyByDate(vesselId: string, logDate: string, orgId: string): Promise<EngineLogDaily | undefined>;
  createEngineLogDaily(entry: InsertEngineLogDaily): Promise<EngineLogDaily>;
  updateEngineLogDaily(id: string, entry: Partial<InsertEngineLogDaily>, orgId: string): Promise<EngineLogDaily>;
  deleteEngineLogDaily(id: string, orgId: string): Promise<void>;
  signEngineLogDaily(id: string, signData: SignData, orgId: string): Promise<EngineLogDaily>;
  lockEngineLogDaily(id: string, lockData: LockData, orgId: string): Promise<EngineLogDaily>;
  unlockEngineLogDaily(id: string, orgId: string): Promise<EngineLogDaily>;

  // ===== ENGINE LOG HOURLY =====
  getEngineLogHourly(dailyLogId: string, orgId: string): Promise<EngineLogHourly[]>;
  getEngineLogHourlyByHour(dailyLogId: string, hour: number, orgId: string): Promise<EngineLogHourly | undefined>;
  upsertEngineLogHourly(entry: InsertEngineLogHourly): Promise<EngineLogHourly>;
  bulkUpsertEngineLogHourly(entries: InsertEngineLogHourly[]): Promise<EngineLogHourly[]>;
  deleteEngineLogHourly(id: string, orgId: string): Promise<void>;

  // ===== ENGINE LOG GENERATOR =====
  getEngineLogGenerator(dailyLogId: string, orgId: string): Promise<EngineLogGenerator[]>;
  getEngineLogGeneratorByHour(dailyLogId: string, hour: number, orgId: string): Promise<EngineLogGenerator[]>;
  upsertEngineLogGenerator(entry: InsertEngineLogGenerator): Promise<EngineLogGenerator>;
  bulkUpsertEngineLogGenerator(entries: InsertEngineLogGenerator[]): Promise<EngineLogGenerator[]>;
  deleteEngineLogGenerator(id: string, orgId: string): Promise<void>;

  // ===== ENGINE LOG WATCH =====
  getEngineLogWatch(dailyLogId: string, orgId: string): Promise<EngineLogWatch[]>;
  getEngineLogWatchByPeriod(dailyLogId: string, watchPeriod: string, orgId: string): Promise<EngineLogWatch | undefined>;
  upsertEngineLogWatch(entry: InsertEngineLogWatch): Promise<EngineLogWatch>;
  deleteEngineLogWatch(id: string, orgId: string): Promise<void>;

  // ===== ENGINE LOG COMPLETE =====
  getEngineLogComplete(dailyLogId: string, orgId: string): Promise<EngineLogComplete | undefined>;

  // ===== ENGINE LOG EVENTS =====
  getEngineLogEvents(dayId: string, orgId: string, filters?: LogEventFilters): Promise<EngineLogEvent[]>;
  getEngineLogEventById(id: string, orgId: string): Promise<EngineLogEvent | undefined>;
  getEngineLogEventByIdempotencyKey(key: string, orgId: string): Promise<EngineLogEvent | undefined>;
  createEngineLogEvent(event: InsertEngineLogEvent): Promise<EngineLogEvent>;
  updateEngineLogEvent(id: string, event: Partial<InsertEngineLogEvent>, orgId: string): Promise<EngineLogEvent>;
  deleteEngineLogEvent(id: string, orgId: string): Promise<void>;
}

// Re-export all types for convenience
export type {
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
};
