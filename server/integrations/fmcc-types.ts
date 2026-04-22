/**
 * FMCC Snapshot Types
 *
 * Normalized data structures for FMCC telemetry that integrate with
 * the existing ARUS telemetry and track log systems.
 *
 * DESIGN RULE: FMCC plugs into existing telemetry & track schema,
 * not a parallel universe. Use source: 'fmcc' to distinguish data origin.
 */

/**
 * Normalized FMCC snapshot containing all data from a single poll.
 * This is the unified format that all FMCC data passes through before
 * being routed to the appropriate existing subsystems.
 */
export interface FmccSnapshot {
  vesselId: string;
  orgId: string;
  timestamp: string; // ISO 8601 format
  source: "fmcc";

  fuel: {
    totalFlowKgPerH?: number;
    portEngineFlowKgPerH?: number;
    stbdEngineFlowKgPerH?: number;
    mainEngineFlowKgPerH?: number;
    generatorFlowKgPerH?: number;
    boilerFlowKgPerH?: number;
    auxEngine1FlowKgPerH?: number;
    auxEngine2FlowKgPerH?: number;
    foDensity?: number;
    doDensity?: number;
    foTemperature?: number;
    doTemperature?: number;
    foCumulativeKg?: number;
    doCumulativeKg?: number;
    doFlowKgPerH?: number;
    doCumulativeTodayKg?: number;
    bunkerFlowKgPerH?: number;
    bunkerCumulativeKg?: number;
  };

  engine?: {
    rpm?: number;
    loadPercent?: number;
    runningHours?: number;
    powerKw?: number;
  };

  shaft?: {
    powerKw?: number;
    torqueNm?: number;
    rpmShaft?: number;
    shaftGeneratorKw?: number;
  };

  tanks?: {
    foServiceLevelPct?: number;
    foSettlingLevelPct?: number;
    doServiceLevelPct?: number;
    doSettlingLevelPct?: number;
    foServiceVolumeM3?: number;
    foSettlingVolumeM3?: number;
    doServiceVolumeM3?: number;
    doSettlingVolumeM3?: number;
  };

  navigation?: {
    latDeg?: number;
    lonDeg?: number;
    speedOverGround?: number;
    courseOverGround?: number;
    heading?: number;
  };

  raw?: Record<string, unknown>;
}

export interface FmccRegisterMapping {
  register: string | number;
  targetField: string;
  dataType: "float32" | "int16" | "uint16" | "int32" | "uint32";
  multiplier: number;
  offset: number;
  unit: string;
  description: string;
}

export const DEFAULT_FMCC_REGISTER_MAP: FmccRegisterMapping[] = [
  // === Fuel Oil (FO) flow registers ===
  {
    register: 100,
    targetField: "fuel.mainEngineFlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Main engine fuel flow",
  },
  {
    register: 104,
    targetField: "fuel.generatorFlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Generator fuel flow",
  },
  {
    register: 108,
    targetField: "fuel.foDensity",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/m³",
    description: "Fuel oil density at 15°C",
  },
  {
    register: 112,
    targetField: "fuel.foTemperature",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "°C",
    description: "Fuel oil temperature",
  },
  {
    register: 116,
    targetField: "fuel.foCumulativeKg",
    dataType: "float32",
    multiplier: 1000,
    offset: 0,
    unit: "kg",
    description: "Cumulative FO consumption (MT → kg)",
  },
  {
    register: 120,
    targetField: "fuel.portEngineFlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Port engine fuel flow",
  },
  {
    register: 124,
    targetField: "fuel.stbdEngineFlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Starboard engine fuel flow",
  },
  {
    register: 128,
    targetField: "fuel.boilerFlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Boiler fuel flow",
  },
  {
    register: 132,
    targetField: "fuel.auxEngine1FlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Auxiliary engine 1 fuel flow",
  },
  {
    register: 136,
    targetField: "fuel.auxEngine2FlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Auxiliary engine 2 fuel flow",
  },

  // === Diesel Oil (DO) registers ===
  {
    register: 140,
    targetField: "fuel.doFlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Diesel oil flow rate",
  },
  {
    register: 144,
    targetField: "fuel.doDensity",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/m³",
    description: "Diesel oil density at 15°C",
  },
  {
    register: 148,
    targetField: "fuel.doTemperature",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "°C",
    description: "Diesel oil temperature",
  },
  {
    register: 152,
    targetField: "fuel.doCumulativeKg",
    dataType: "float32",
    multiplier: 1000,
    offset: 0,
    unit: "kg",
    description: "Cumulative DO consumption (MT → kg)",
  },

  // === Bunkering (CONTOIL bunker meters) ===
  {
    register: 160,
    targetField: "fuel.bunkerFlowKgPerH",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kg/h",
    description: "Bunker line flow rate",
  },
  {
    register: 164,
    targetField: "fuel.bunkerCumulativeKg",
    dataType: "float32",
    multiplier: 1000,
    offset: 0,
    unit: "kg",
    description: "Bunker cumulative (MT → kg)",
  },

  // === Navigation registers (GPS from RMS IPC) ===
  {
    register: 200,
    targetField: "navigation.latDeg",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "deg",
    description: "Latitude",
  },
  {
    register: 204,
    targetField: "navigation.lonDeg",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "deg",
    description: "Longitude",
  },
  {
    register: 208,
    targetField: "navigation.speedOverGround",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kn",
    description: "Speed over ground",
  },
  {
    register: 212,
    targetField: "navigation.courseOverGround",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "deg",
    description: "Course over ground",
  },
  {
    register: 216,
    targetField: "navigation.heading",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "deg",
    description: "Vessel heading (gyrocompass)",
  },

  // === Engine registers ===
  {
    register: 300,
    targetField: "engine.rpm",
    dataType: "uint16",
    multiplier: 1,
    offset: 0,
    unit: "rpm",
    description: "Main engine RPM",
  },
  {
    register: 302,
    targetField: "engine.loadPercent",
    dataType: "uint16",
    multiplier: 0.1,
    offset: 0,
    unit: "%",
    description: "Engine load percentage",
  },
  {
    register: 304,
    targetField: "engine.runningHours",
    dataType: "uint32",
    multiplier: 0.1,
    offset: 0,
    unit: "hours",
    description: "Engine running hours",
  },
  {
    register: 308,
    targetField: "engine.powerKw",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kW",
    description: "Engine power output",
  },

  // === Shaft / propulsion registers ===
  {
    register: 400,
    targetField: "shaft.powerKw",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kW",
    description: "Shaft power",
  },
  {
    register: 404,
    targetField: "shaft.torqueNm",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "Nm",
    description: "Shaft torque",
  },
  {
    register: 408,
    targetField: "shaft.rpmShaft",
    dataType: "uint16",
    multiplier: 0.1,
    offset: 0,
    unit: "rpm",
    description: "Shaft RPM",
  },
  {
    register: 410,
    targetField: "shaft.shaftGeneratorKw",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "kW",
    description: "Shaft generator output power",
  },

  // === Tank level registers ===
  {
    register: 500,
    targetField: "tanks.foServiceLevelPct",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "%",
    description: "FO service tank level",
  },
  {
    register: 504,
    targetField: "tanks.foSettlingLevelPct",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "%",
    description: "FO settling tank level",
  },
  {
    register: 508,
    targetField: "tanks.doServiceLevelPct",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "%",
    description: "DO service tank level",
  },
  {
    register: 512,
    targetField: "tanks.doSettlingLevelPct",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "%",
    description: "DO settling tank level",
  },
  {
    register: 516,
    targetField: "tanks.foServiceVolumeM3",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "m³",
    description: "FO service tank volume",
  },
  {
    register: 520,
    targetField: "tanks.foSettlingVolumeM3",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "m³",
    description: "FO settling tank volume",
  },
  {
    register: 524,
    targetField: "tanks.doServiceVolumeM3",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "m³",
    description: "DO service tank volume",
  },
  {
    register: 528,
    targetField: "tanks.doSettlingVolumeM3",
    dataType: "float32",
    multiplier: 1,
    offset: 0,
    unit: "m³",
    description: "DO settling tank volume",
  },
];

export const BUNKERING_REGISTER_MAP: FmccRegisterMapping[] = DEFAULT_FMCC_REGISTER_MAP.filter(
  (r) =>
    r.targetField.startsWith("fuel.bunker") ||
    r.targetField.startsWith("fuel.foDensity") ||
    r.targetField.startsWith("fuel.foTemperature")
);

export interface FmccPollingConfig {
  enabled: boolean;
  vesselId: string;
  orgId: string;
  pollIntervalMs: number;
  enableTrackLogging: boolean;
  enableTelemetryLogging: boolean;
  minPositionChangeNm: number;
  maxTrackGapMinutes: number;
}

export interface FmccHealthStatus {
  enabled: boolean;
  connected: boolean;
  lastSuccessfulPoll: Date | null;
  lastError: string | null;
  lastErrorTime: Date | null;
  consecutiveFailures: number;
  totalPollsSuccess: number;
  totalPollsFailed: number;
  averageResponseTimeMs: number;
}
