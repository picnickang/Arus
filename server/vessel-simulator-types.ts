// Stub file - vessel simulator types
export interface VesselOperationalPattern {
  name: string;
  speed: number;
  rpm: number;
  fuelConsumption: number;
}

export interface SimulatedTelemetryPoint {
  timestamp: Date;
  sensorId: string;
  value: number;
  unit: string;
}

export const VESSEL_TYPE_PRESETS = {
  CARGO: { name: "Cargo", speed: 12, rpm: 100, fuelConsumption: 100 },
  TANKER: { name: "Tanker", speed: 10, rpm: 80, fuelConsumption: 120 },
};
