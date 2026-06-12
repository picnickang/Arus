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
    totalFlowKgPerH?: number | undefined;
    portEngineFlowKgPerH?: number | undefined;
    stbdEngineFlowKgPerH?: number | undefined;
    mainEngineFlowKgPerH?: number | undefined;
    generatorFlowKgPerH?: number | undefined;
    boilerFlowKgPerH?: number | undefined;
    auxEngine1FlowKgPerH?: number | undefined;
    auxEngine2FlowKgPerH?: number | undefined;
    foDensity?: number | undefined;
    doDensity?: number | undefined;
    foTemperature?: number | undefined;
    doTemperature?: number | undefined;
    foCumulativeKg?: number | undefined;
    doCumulativeKg?: number | undefined;
    doFlowKgPerH?: number | undefined;
    doCumulativeTodayKg?: number | undefined;
    bunkerFlowKgPerH?: number | undefined;
    bunkerCumulativeKg?: number | undefined;
  };

  engine?: {
    rpm?: number | undefined;
    loadPercent?: number | undefined;
    runningHours?: number | undefined;
    powerKw?: number | undefined;
  };

  shaft?: {
    powerKw?: number | undefined;
    torqueNm?: number | undefined;
    rpmShaft?: number | undefined;
    shaftGeneratorKw?: number | undefined;
  };

  tanks?: {
    foServiceLevelPct?: number | undefined;
    foSettlingLevelPct?: number | undefined;
    doServiceLevelPct?: number | undefined;
    doSettlingLevelPct?: number | undefined;
    foServiceVolumeM3?: number | undefined;
    foSettlingVolumeM3?: number | undefined;
    doServiceVolumeM3?: number | undefined;
    doSettlingVolumeM3?: number | undefined;
  };

  navigation?: {
    latDeg?: number | undefined;
    lonDeg?: number | undefined;
    speedOverGround?: number | undefined;
    courseOverGround?: number | undefined;
    heading?: number | undefined;
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

/**
 * Raw poll payload accepted by FmccPollingService.buildSnapshot.
 * Supports both nested (fuel/navigation/engine/...) and flat field
 * layouts that different FMCC deployments emit. All fields are optional;
 * nested groups recursively share the same shape so `data.fuel ?? data`
 * style fallback patterns stay typed.
 */
export interface FmccRawPollData {
  fuel?: FmccRawPollData;
  engine?: FmccRawPollData;
  shaft?: FmccRawPollData;
  tanks?: FmccRawPollData;
  navigation?: FmccRawPollData;

  // Fuel flow / density / temperature
  totalFlowKgPerH?: number | undefined;
  foFlowKgPerH?: number | undefined;
  foNetFlowKgPerH?: number | undefined;
  foReturnFlowKgPerH?: number | undefined;
  foDensity?: number | undefined;
  foTemperature?: number | undefined;
  foCumulativeKg?: number | undefined;
  doFlowKgPerH?: number | undefined;
  doDensity?: number | undefined;
  doTemperature?: number | undefined;
  doCumulativeKg?: number | undefined;
  mainEngineFlowKgPerH?: number | undefined;
  generatorFlowKgPerH?: number | undefined;
  portEngineFlowKgPerH?: number | undefined;
  stbdEngineFlowKgPerH?: number | undefined;
  boilerFlowKgPerH?: number | undefined;
  auxEngine1FlowKgPerH?: number | undefined;
  auxEngine2FlowKgPerH?: number | undefined;
  bunkerFlowKgPerH?: number | undefined;
  bunkerCumulativeKg?: number | undefined;

  // Navigation
  latDeg?: number | undefined;
  lonDeg?: number | undefined;
  speedOverGround?: number | undefined;
  courseOverGround?: number | undefined;
  heading?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  sog?: number | undefined;
  cog?: number | undefined;

  // Engine
  rpm?: number | undefined;
  loadPercent?: number | undefined;
  load?: number | undefined;
  runningHours?: number | undefined;
  powerKw?: number | undefined;

  // Shaft
  torqueNm?: number | undefined;
  rpmShaft?: number | undefined;
  shaftGeneratorKw?: number | undefined;
  shaftPowerKw?: number | undefined;
  shaftTorqueNm?: number | undefined;
  shaftRpm?: number | undefined;

  // Tanks
  foServiceLevelPct?: number | undefined;
  foSettlingLevelPct?: number | undefined;
  doServiceLevelPct?: number | undefined;
  doSettlingLevelPct?: number | undefined;
  foServiceVolumeM3?: number | undefined;
  foSettlingVolumeM3?: number | undefined;
  doServiceVolumeM3?: number | undefined;
  doSettlingVolumeM3?: number | undefined;
}
