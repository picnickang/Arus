/**
 * Digital Twin Simulation Scenarios - Physics-based vessel simulations
 */

import type { TwinState, PhysicsModel, SimulationScenario, SimulationAnalysis } from "./types.js";
import {
  calculateOptimalEngineLoad,
  calculateFuelConsumption,
  calculateBearing,
  calculateNewPosition,
} from "./physics-calculations.js";

export function simulateMaintenanceScenario(
  state: TwinState,
  _physics: PhysicsModel,
  scenario: SimulationScenario,
  timeElapsed: number
): TwinState {
  const maintenanceParams = scenario.parameters.maintenance ?? {};
  const degradationRate = maintenanceParams.degradationRate ?? 0.01;
  for (const engine of Object.values(state.machinery.engines)) {
    const e = engine as { efficiency?: number };
    e.efficiency = Math.max(
      0.3,
      (e.efficiency ?? 0.85) * (1 - (degradationRate * timeElapsed) / 60)
    );
    engine.temperature += degradationRate * timeElapsed * 2;
  }

  if (maintenanceParams.maintenanceAction === "overhaul") {
    const completionRatio = Math.min(1, timeElapsed / (maintenanceParams.duration ?? 480));
    for (const engine of Object.values(state.machinery.engines)) {
      const e = engine as { efficiency?: number };
      e.efficiency = Math.min(
        0.95,
        (e.efficiency ?? 0.85) + 0.4 * completionRatio
      );
      engine.temperature = Math.max(80, engine.temperature - 20 * completionRatio);
    }
  }
  return state;
}

export function simulateFailureScenario(
  state: TwinState,
  _physics: PhysicsModel,
  scenario: SimulationScenario,
  timeElapsed: number
): TwinState {
  const failureParams = scenario.parameters.failure ?? {};
  const failureComponent = failureParams.component ?? "main_engine";
  const failureTime = failureParams.failureTime ?? 60;
  const failureHandlers: Record<string, () => void> = {
    main_engine: () => {
      const mainEngine = Object.values(state.machinery.engines)[0];
      if (mainEngine) {
        mainEngine.load = Math.max(0, mainEngine.load * 0.3);
        mainEngine.temperature += 50;
      }
      state.speed = Math.max(0, state.speed * 0.4);
    },
    cooling_pump: () => {
      const coolingPump = state.machinery.pumps['COOLING_PUMP_01'];
      if (coolingPump) {
        coolingPump.status = "failed";
        coolingPump.flow = 0;
      }
      for (const engine of Object.values(state.machinery.engines)) {
        engine.temperature += timeElapsed * 0.5;
      }
    },
    generator: () => {
      const generator = Object.values(state.machinery.generators)[0];
      if (generator) {
        generator.voltage = 0;
        generator.load = 0;
      }
    },
  };
  if (timeElapsed >= failureTime) {
    const handler = failureHandlers[failureComponent];
    if (handler) {
      handler();
    }
  }
  return state;
}

export function simulateOptimizationScenario(
  state: TwinState,
  physics: PhysicsModel,
  scenario: SimulationScenario,
  timeElapsed: number
): TwinState {
  const optParams = scenario.parameters.optimization ?? {};
  const targetSpeed = optParams.targetSpeed ?? 12;
  const optimalLoad = calculateOptimalEngineLoad(targetSpeed, physics);
  for (const engine of Object.values(state.machinery.engines)) {
    engine.load = Math.min(1, optimalLoad);
    engine.rpm = engine.load * 1800;
  }
  const hourlyConsumption = calculateFuelConsumption(state, physics);
  state.fuel.consumptionRate = hourlyConsumption * 24;
  state.fuel.currentLevel = Math.max(
    0,
    state.fuel.currentLevel - (hourlyConsumption * timeElapsed) / 60
  );
  state.speed = targetSpeed;
  return state;
}

export function simulateWeatherScenario(
  state: TwinState,
  _physics: PhysicsModel,
  scenario: SimulationScenario,
  timeElapsed: number
): TwinState {
  const weather = scenario.environmentalConditions;
  const seaStateEffect = 1 - weather.seaState * 0.05;
  const windEffect =
    Math.cos(((weather.windDirection - state.heading) * Math.PI) / 180) * weather.windSpeed * 0.002;
  state.speed = state.speed * seaStateEffect * (1 + windEffect);
  state.fuel.consumptionRate *= 1 + weather.seaState * 0.1;
  state.list = Math.sin(timeElapsed * 0.1) * weather.seaState * 2;
  state.trim = Math.cos(timeElapsed * 0.15) * weather.seaState * 1.5;
  return state;
}

export function simulateRouteScenario(
  state: TwinState,
  _physics: PhysicsModel,
  scenario: SimulationScenario,
  timeElapsed: number
): TwinState {
  const routeParams = scenario.parameters.route ?? {};
  const waypoints = routeParams.waypoints ?? [];
  const currentSpeed = routeParams.speed ?? 12;
  if (waypoints.length > 0) {
    const currentWaypointIndex = Math.floor(timeElapsed / 120);
    const waypoint = waypoints[currentWaypointIndex % waypoints.length];
    if (waypoint) {
      const bearing = calculateBearing(state.position, waypoint);
      state.heading = bearing;
      const distanceNM = (currentSpeed * timeElapsed) / 60;
      const newPosition = calculateNewPosition(state.position, bearing, distanceNM);
      state.position = newPosition;
      state.speed = currentSpeed;
    }
  }
  return state;
}

export function simulateNormalOperation(
  state: TwinState,
  physics: PhysicsModel,
  _scenario: SimulationScenario,
  timeElapsed: number
): TwinState {
  const variation = Math.sin(timeElapsed * 0.01) * 0.05;
  for (const engine of Object.values(state.machinery.engines)) {
    engine.load = Math.max(0.1, Math.min(0.9, 0.6 + variation));
    engine.rpm = engine.load * 1800;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    engine.temperature = 85 + engine.load * 30 + ((array[0] ?? 0) / 0xffffffff) * 5;
  }
  state.fuel.consumptionRate = calculateFuelConsumption(state, physics) * 24;
  state.fuel.currentLevel = Math.max(
    0,
    state.fuel.currentLevel - (state.fuel.consumptionRate * timeElapsed) / (60 * 24)
  );
  return state;
}

type ScenarioSimulator = (
  state: TwinState,
  physics: PhysicsModel,
  scenario: SimulationScenario,
  timeElapsed: number
) => TwinState;

const scenarioSimulators: Record<string, ScenarioSimulator> = {
  maintenance: simulateMaintenanceScenario,
  failure: simulateFailureScenario,
  optimization: simulateOptimizationScenario,
  weather: simulateWeatherScenario,
  route_planning: simulateRouteScenario,
};

export function simulatePhysics(
  state: TwinState,
  physics: PhysicsModel,
  scenario: SimulationScenario,
  timeElapsed: number
): TwinState {
  const newState: TwinState = JSON.parse(JSON.stringify(state));
  const simulator = scenarioSimulators[scenario.scenarioType] ?? simulateNormalOperation;
  return simulator(newState, physics, scenario, timeElapsed);
}

const analysisRecommendations: Record<
  string,
  { recommendation: string; savings: number; cost: number }
> = {
  maintenance: {
    recommendation: "Schedule maintenance during next port call",
    savings: 50000,
    cost: 15000,
  },
  optimization: {
    recommendation: "Reduce speed by 2 knots for 15% fuel savings",
    savings: 100000,
    cost: 5000,
  },
  failure: {
    recommendation: "Install redundant cooling pump to prevent failure",
    savings: 200000,
    cost: 75000,
  },
};

export function analyzeSimulationResults(
  _results: unknown[],
  scenario: SimulationScenario
): SimulationAnalysis {
  const analysis: SimulationAnalysis = {
    summary: `Simulation completed with ${_results.length} data points`,
    recommendations: [],
    costBenefit: { estimatedSavings: 0, implementationCost: 0 },
    keyFindings: [],
  };
  const rec = analysisRecommendations[scenario.scenarioType];
  if (rec) {
    analysis.recommendations.push(rec.recommendation);
    analysis.costBenefit = { estimatedSavings: rec.savings, implementationCost: rec.cost };
  }
  return analysis;
}
