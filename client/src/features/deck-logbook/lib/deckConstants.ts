export const WIND_DIRECTIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] as const;

export const BEAUFORT_SCALE = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

export const SEA_STATES = ["Calm", "Smooth", "Slight", "Moderate", "Rough", "Very Rough", "High", "Very High", "Phenomenal"] as const;

export const VISIBILITY_CODES = ["0 (Fog)", "1 (<1nm)", "2 (1-2nm)", "3 (2-5nm)", "4 (5-10nm)", "5 (>10nm)"] as const;

export const WATCH_PERIODS = ["00-06", "06-12", "12-18", "18-24"] as const;

export const MANUAL_EVENT_TYPES = [
  { value: "DEPARTURE", label: "Departure" },
  { value: "ARRIVAL", label: "Arrival" },
  { value: "ANCHORING", label: "Anchoring" },
  { value: "ANCHOR_UP", label: "Anchor Up" },
  { value: "CARGO_OPS", label: "Cargo Operations" },
  { value: "BUNKERING", label: "Bunkering" },
  { value: "FUEL_TRANSFER", label: "Fuel Transfer" },
  { value: "DRILL", label: "Safety Drill" },
  { value: "POSITION_FIX", label: "Position Fix" },
  { value: "MOVEMENT", label: "Movement/Course Change" },
  { value: "REMARK", label: "General Remark" },
  { value: "CUSTOM", label: "Custom Event" },
] as const;

export type WindDirection = typeof WIND_DIRECTIONS[number];
export type BeaufortScale = typeof BEAUFORT_SCALE[number];
export type SeaState = typeof SEA_STATES[number];
export type VisibilityCode = typeof VISIBILITY_CODES[number];
export type WatchPeriod = typeof WATCH_PERIODS[number];
