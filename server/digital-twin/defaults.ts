import type { PhysicsModel, TwinState, VesselSpecifications } from "./types.js";

export function buildDefaultPhysicsModel(specifications: VesselSpecifications): PhysicsModel {
  return {
    hydrodynamics: {
      hullResistance: 0.02,
      waveMaking: 0.015,
      frictionCoefficient: 0.003,
    },
    propulsion: {
      efficiency: 0.85,
      thrustCurve: [0, 0.25, 0.5, 0.75, 1],
      fuelConsumption: 0.2,
    },
    machinery: {
      mainEngines: [{ id: "MAIN_ENGINE_01", power: specifications.enginePower, efficiency: 0.42 }],
      auxiliaryPower: specifications.enginePower * 0.15,
      heatExchangers: [{ id: "HE_01", capacity: 1000 }],
    },
    environmental: { windResistance: 0.01, currentEffect: 0.5, waveHeight: 2 },
  };
}

export function buildInitialTwinState(specifications: VesselSpecifications): TwinState {
  return {
    position: { latitude: 0, longitude: 0 },
    speed: 0,
    heading: 0,
    draft: specifications.displacement / (specifications.length * specifications.beam * 0.7),
    trim: 0,
    list: 0,
    machinery: {
      engines: { MAIN_ENGINE_01: { rpm: 0, load: 0, temperature: 85 } },
      generators: { GEN_01: { load: 0, voltage: 440, frequency: 60 } },
      pumps: { COOLING_PUMP_01: { flow: 0, pressure: 0, status: "standby" } },
    },
    cargo: { totalWeight: 0, distribution: [] },
    fuel: {
      totalCapacity: specifications.displacement * 0.15,
      currentLevel: specifications.displacement * 0.12,
      consumptionRate: 0,
    },
    crew: { onboard: 20, positions: {} },
  };
}
