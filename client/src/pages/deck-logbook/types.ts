export interface HourlyEntry {
  course?: string;
  windDirection?: string;
  windForce?: string;
  seaState?: string;
  visibility?: string;
  barometer?: number;
  airTemp?: number;
  seaTemp?: number;
  remarks?: string;
}

export interface DeckEvent {
  id: string;
  timestamp: string;
  eventType: string;
  summary: string;
  source: string;
  details?: string;
  positionLat?: number;
  positionLon?: number;
}

export interface WatchData {
  officerName?: string;
  helmName?: string;
  lookoutName?: string;
}
