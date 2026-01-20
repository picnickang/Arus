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
  source: 'fmcc';
  
  /** Fuel consumption and flow metrics */
  fuel: {
    /** Total net fuel flow (kg/h) - combined FO + DO */
    totalFlowKgPerH?: number;
    /** Port engine fuel flow (kg/h) */
    portEngineFlowKgPerH?: number;
    /** Starboard engine fuel flow (kg/h) */
    stbdEngineFlowKgPerH?: number;
    /** Main engine fuel flow (kg/h) */
    mainEngineFlowKgPerH?: number;
    /** Generator fuel flow (kg/h) */
    generatorFlowKgPerH?: number;
    /** Fuel oil density at 15°C (kg/m³) */
    foDensity?: number;
    /** Diesel oil density at 15°C (kg/m³) */
    doDensity?: number;
    /** Fuel oil temperature (°C) */
    foTemperature?: number;
    /** Diesel oil temperature (°C) */
    doTemperature?: number;
    /** Cumulative FO consumed today (kg) */
    foCumulativeKg?: number;
    /** Cumulative DO consumed today (kg) */
    doCumulativeKg?: number;
  };
  
  /** Engine-related telemetry from FMCC */
  engine?: {
    /** Engine RPM (if available from FMCC) */
    rpm?: number;
    /** Engine load percentage (0-100) */
    loadPercent?: number;
    /** Engine running hours */
    runningHours?: number;
    /** Engine power output (kW) */
    powerKw?: number;
  };
  
  /** Navigation/position data from FMCC GPS */
  navigation?: {
    /** Latitude in decimal degrees */
    latDeg?: number;
    /** Longitude in decimal degrees */
    lonDeg?: number;
    /** Speed Over Ground in knots */
    speedOverGround?: number;
    /** Course Over Ground in degrees (0-360) */
    courseOverGround?: number;
    /** Heading in degrees (0-360) */
    heading?: number;
  };
  
  /** Raw register data for debugging */
  raw?: Record<string, unknown>;
}

/**
 * FMCC register mapping table.
 * Maps FMCC Modbus registers or REST API fields to normalized snapshot fields.
 */
export interface FmccRegisterMapping {
  /** FMCC register address (Modbus) or field path (REST) */
  register: string | number;
  /** Target field in FmccSnapshot using dot notation */
  targetField: string;
  /** Data type for parsing */
  dataType: 'float32' | 'int16' | 'uint16' | 'int32' | 'uint32';
  /** Multiplier to convert raw value to engineering units */
  multiplier: number;
  /** Offset to apply after multiplier */
  offset: number;
  /** Unit of the resulting value */
  unit: string;
  /** Description of this register */
  description: string;
}

/**
 * Default register mappings for Aquametro FMCC
 * These follow common Aquametro register conventions
 */
export const DEFAULT_FMCC_REGISTER_MAP: FmccRegisterMapping[] = [
  // Fuel flow registers
  { register: 100, targetField: 'fuel.mainEngineFlowKgPerH', dataType: 'float32', multiplier: 1, offset: 0, unit: 'kg/h', description: 'Main engine fuel flow' },
  { register: 104, targetField: 'fuel.generatorFlowKgPerH', dataType: 'float32', multiplier: 1, offset: 0, unit: 'kg/h', description: 'Generator fuel flow' },
  { register: 108, targetField: 'fuel.foDensity', dataType: 'float32', multiplier: 1, offset: 0, unit: 'kg/m³', description: 'Fuel oil density at 15°C' },
  { register: 112, targetField: 'fuel.foTemperature', dataType: 'float32', multiplier: 1, offset: 0, unit: '°C', description: 'Fuel oil temperature' },
  { register: 116, targetField: 'fuel.foCumulativeKg', dataType: 'float32', multiplier: 1000, offset: 0, unit: 'kg', description: 'Cumulative FO consumption (MT → kg)' },
  // Navigation registers (if FMCC has GPS)
  { register: 200, targetField: 'navigation.latDeg', dataType: 'float32', multiplier: 1, offset: 0, unit: 'deg', description: 'Latitude' },
  { register: 204, targetField: 'navigation.lonDeg', dataType: 'float32', multiplier: 1, offset: 0, unit: 'deg', description: 'Longitude' },
  { register: 208, targetField: 'navigation.speedOverGround', dataType: 'float32', multiplier: 1, offset: 0, unit: 'kn', description: 'Speed over ground' },
  { register: 212, targetField: 'navigation.courseOverGround', dataType: 'float32', multiplier: 1, offset: 0, unit: 'deg', description: 'Course over ground' },
  // Engine registers (if available)
  { register: 300, targetField: 'engine.rpm', dataType: 'uint16', multiplier: 1, offset: 0, unit: 'rpm', description: 'Engine RPM' },
  { register: 302, targetField: 'engine.loadPercent', dataType: 'uint16', multiplier: 0.1, offset: 0, unit: '%', description: 'Engine load' },
];

/**
 * FMCC polling service configuration
 */
export interface FmccPollingConfig {
  enabled: boolean;
  vesselId: string;
  orgId: string;
  pollIntervalMs: number;
  /** Whether to route navigation data to track log */
  enableTrackLogging: boolean;
  /** Whether to route fuel/engine data to telemetry */
  enableTelemetryLogging: boolean;
  /** Minimum position change (nautical miles) to log new track point */
  minPositionChangeNm: number;
  /** Maximum time between track points (minutes) */
  maxTrackGapMinutes: number;
}

/**
 * FMCC health status for monitoring
 */
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
