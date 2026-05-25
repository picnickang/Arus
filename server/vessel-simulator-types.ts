// Vessel simulator types

export interface VesselOperationalPattern {
  name: string;
  speed: number;
  rpm: number;
  fuelConsumption: number;
}

export interface SimulatedTelemetryPoint {
  timestamp: Date;
  rpm: number;
  shaft_torque: number;
  vibration_x: number;
  vibration_y: number;
  vibration_z: number;
  oil_temp: number;
  coolant_temp: number;
  fuel_rate: number;
  hyd_pressure?: number | undefined;
  winch_tension?: number | undefined;
  towline_tension?: number | undefined;
  cargo_pump_pressure?: number | undefined;
  cargo_pump_temp?: number | undefined;
  gen_load?: number | undefined;
  thruster_load?: number | undefined;
  dp_status?: number | undefined;
  imu_heave: number;
  imu_pitch: number;
  imu_roll: number;
  ramp_hyd_pressure?: number | undefined;
}

export const VESSEL_TYPE_PRESETS: Record<string, {
  name: string;
  speed: number;
  rpm: number;
  fuelConsumption: number;
  maxRpm: number;
  maxTorque: number;
  pattern: "steady" | "harbor" | "dp" | string;
  seaState: number;
}> = {
  CARGO: { name: "Cargo", speed: 12, rpm: 100, fuelConsumption: 100, maxRpm: 1800, maxTorque: 2500, pattern: "steady", seaState: 3 },
  TANKER: { name: "Tanker", speed: 10, rpm: 80, fuelConsumption: 120, maxRpm: 1600, maxTorque: 3000, pattern: "steady", seaState: 3 },
  tug: { name: "Tug", speed: 12, rpm: 100, fuelConsumption: 110, maxRpm: 2000, maxTorque: 2200, pattern: "harbor", seaState: 2 },
  osv: { name: "OSV", speed: 14, rpm: 110, fuelConsumption: 130, maxRpm: 1800, maxTorque: 2800, pattern: "dp", seaState: 4 },
};

export interface SimulationConfig {
  vesselType: string;
  equipmentId: string;
  deviceId: string;
  orgId: string;
  durationMinutes: number;
  samplingIntervalSeconds?: number | undefined;
  signals?: string[] | undefined;
  customPreset?: Partial<typeof VESSEL_TYPE_PRESETS[string]> | undefined;
  injectFault?: boolean | undefined;
  faultStartMinute?: number | undefined;
  faultSeverity?: number | undefined;
}

export interface SimulationResult {
  vesselType: string;
  equipmentId: string;
  dataPoints: SimulatedTelemetryPoint[];
  statistics: unknown;
}
