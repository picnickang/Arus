export interface DeckLogDaily {
  id: string;
  orgId: string;
  vesselId: string;
  logDate: string;
  status: string;
  signedByCrewId?: string;
  signedByName?: string;
  signedByRank?: string;
  signedAt?: Date;
  lockedAt?: Date;
  lockedByUserId?: string;
  lockedByUserName?: string;
  voyageNumber?: string;
  portOfDeparture?: string;
  portOfArrival?: string;
  etaNextPort?: Date;
  distanceToGo?: number;
  distanceRun?: number;
  masterRemarks?: string;
  chiefOfficerRemarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DeckLogHourly {
  id: string;
  dailyLogId: string;
  hour: number;
  latitude?: number;
  longitude?: number;
  course?: number;
  speed?: number;
  windDirection?: number;
  windForce?: number;
  seaState?: string;
  visibility?: string;
  barometer?: number;
  airTemp?: number;
  seaTemp?: number;
  weather?: string;
  remarks?: string;
}

export interface DeckLogWatch {
  id: string;
  dailyLogId: string;
  watchPeriod: string;
  masterName?: string;
  chiefOfficerName?: string;
  secondOfficerName?: string;
  thirdOfficerName?: string;
  helmsman?: string;
  lookout?: string;
}

export interface DeckLogEvent {
  id: string;
  vesselId: string;
  dayId: string;
  timestamp: Date;
  eventType: string;
  source: string;
  summary: string;
  details?: string;
  latitude?: number;
  longitude?: number;
  course?: number;
  speed?: number;
  workOrderId?: string;
  alertId?: string;
  crewMemberId?: string;
  createdByUserId?: string;
  createdByUserName?: string;
}

export interface DeckLogComplete {
  daily: DeckLogDaily;
  hourlyEntries: DeckLogHourly[];
  watches: DeckLogWatch[];
  events: DeckLogEvent[];
}

export const DECK_WATCH_PERIODS = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"] as const;

export const DECK_EVENT_TYPES = {
  DEPARTURE: { label: "Departure", color: "bg-green-500" },
  ARRIVAL: { label: "Arrival", color: "bg-blue-500" },
  ANCHOR_DROP: { label: "Anchor Drop", color: "bg-yellow-500" },
  ANCHOR_WEIGH: { label: "Anchor Weigh", color: "bg-yellow-400" },
  PILOT_EMBARK: { label: "Pilot Embark", color: "bg-purple-500" },
  PILOT_DISEMBARK: { label: "Pilot Disembark", color: "bg-purple-400" },
  COURSE_CHANGE: { label: "Course Change", color: "bg-cyan-500" },
  SPEED_CHANGE: { label: "Speed Change", color: "bg-cyan-400" },
  WEATHER_CHANGE: { label: "Weather Change", color: "bg-gray-500" },
  DRILL: { label: "Drill", color: "bg-orange-500" },
  MUSTER: { label: "Muster", color: "bg-orange-400" },
  WATCH_CHANGE: { label: "Watch Change", color: "bg-indigo-500" },
  NAVIGATION_WARNING: { label: "Nav Warning", color: "bg-red-500" },
  SIGHTING: { label: "Sighting", color: "bg-green-400" },
  MAINTENANCE: { label: "Maintenance", color: "bg-amber-500" },
  OTHER: { label: "Other", color: "bg-gray-400" },
} as const;

export type DeckEventType = keyof typeof DECK_EVENT_TYPES;
