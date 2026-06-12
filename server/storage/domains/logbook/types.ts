/**
 * Logbook Storage Types
 * Digital Deck and Engine Room Logbook type definitions
 */

import type {
  DeckLogDaily,
  DeckLogHourly,
  DeckLogWatch,
  EngineLogDaily,
  EngineLogHourly,
  EngineLogGenerator,
  EngineLogWatch,
} from "@shared/schema";

export interface DeckLogFilters {
  vesselId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  status?: string | undefined;
}

export interface EngineLogFilters {
  vesselId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  status?: string | undefined;
}

export interface LogEventFilters {
  eventType?: string | undefined;
  source?: string | undefined;
  startTime?: Date | undefined;
  endTime?: Date | undefined;
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
