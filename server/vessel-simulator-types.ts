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
  hyd_pressure?: number;
  winch_tension?: number;
  towline_tension?: number;
  cargo_pump_pressure?: number;
  cargo_pump_temp?: number;
  gen_load?: number;
  thruster_load?: number;
  dp_status?: number;
  imu_heave: number;
  imu_pitch: number;
  imu_roll: number;
  ramp_hyd_pressure?: number;
}

export const VESSEL_TYPE_PRESETS = {
  CARGO: { name: "Cargo", speed: 12, rpm: 100, fuelConsumption: 100 },
  TANKER: { name: "Tanker", speed: 10, rpm: 80, fuelConsumption: 120 },
};
