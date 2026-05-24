/**
 * Digital Twin Types - Type definitions for vessel digital twin simulations
 */

export interface VesselSpecifications {
  vesselType: string;
  length: number;
  beam: number;
  displacement: number;
  propulsionType: string;
  enginePower: number;
  maxSpeed: number;
  yearBuilt: number;
  classification: string;
}

export interface PhysicsModel {
  hydrodynamics: {
    hullResistance: number;
    waveMaking: number;
    frictionCoefficient: number;
  };
  propulsion: {
    efficiency: number;
    thrustCurve: number[];
    fuelConsumption: number;
  };
  machinery: {
    mainEngines: Array<{ id: string; power: number; efficiency: number }>;
    auxiliaryPower: number;
    heatExchangers: Array<{ id: string; capacity: number }>;
  };
  environmental: {
    windResistance: number;
    currentEffect: number;
    waveHeight: number;
  };
}

export interface TwinState {
  position: { latitude: number; longitude: number };
  speed: number;
  heading: number;
  draft: number;
  trim: number;
  list: number;
  machinery: {
    engines: Record<string, { rpm: number; load: number; temperature: number }>;
    generators: Record<string, { load: number; voltage: number; frequency: number }>;
    pumps: Record<string, { flow: number; pressure: number; status: string }>;
  };
  cargo: {
    totalWeight: number;
    distribution: Array<{ bay: string; weight: number }>;
  };
  fuel: {
    totalCapacity: number;
    currentLevel: number;
    consumptionRate: number;
  };
  crew: {
    onboard: number;
    positions: Record<string, string>;
  };
}

export interface SimulationScenario {
  scenarioType:
    | "maintenance"
    | "failure"
    | "optimization"
    | "training"
    | "weather"
    | "route_planning";
  parameters: {
    maintenance?: {
      degradationRate?: number;
      maintenanceAction?: string;
      duration?: number;
    };
    failure?: {
      component?: string;
      failureTime?: number;
    };
    optimization?: {
      targetSpeed?: number;
    };
    route?: {
      waypoints?: Array<{ latitude: number; longitude: number }>;
      speed?: number;
    };
    [key: string]: unknown;
  };
  duration: number;
  timeStep: number;
  environmentalConditions: {
    seaState: number;
    windSpeed: number;
    windDirection: number;
    visibility: number;
    temperature: number;
  };
}

export interface SimulationResult {
  time: number;
  state: TwinState;
  conditions: SimulationScenario["environmentalConditions"];
}

export interface SimulationAnalysis {
  summary: string;
  recommendations: string[];
  costBenefit: { estimatedSavings: number; implementationCost: number };
  keyFindings: string[];
}
