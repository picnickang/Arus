import type { TwinEvent, InsertTwinEvent } from "@shared/schema";

export interface TimelineEntry {
  id: string;
  twinId: string;
  timestamp: Date | null;
  eventType: string;
  payload: unknown;
  source: string | null;
}

export interface TimelineQuery {
  orgId: string;
  twinId: string;
  startTime: Date;
  endTime: Date;
  limit?: number;
}

export interface AnomalyTimelineQuery {
  orgId: string;
  twinId: string;
  anomalyTimestamp: Date;
  windowMinutes?: number;
}

export interface ReplayPort {
  logEvent(data: InsertTwinEvent): Promise<TwinEvent>;

  getTimeline(query: TimelineQuery): Promise<TimelineEntry[]>;

  getTimelineAroundAnomaly(query: AnomalyTimelineQuery): Promise<TimelineEntry[]>;
}
