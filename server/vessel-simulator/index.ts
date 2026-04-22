/**
 * Vessel Simulator Module
 *
 * Re-exports public API for vessel telemetry simulation.
 */

export { PhysicsEngine } from "./physics-engine.js";
export { OperationalPatternGenerator } from "./pattern-generator.js";
export { VesselSimulator } from "./simulator.js";
export type { StressTestConfig, StressTestResult } from "./stress-test.js";
export { TelemetryStressTest } from "./stress-test.js";
export type { FleetStressConfig, FleetStressResult } from "./fleet-stress-test.js";
export { FleetStressTest } from "./fleet-stress-test.js";
export {
  initVesselSimulator,
  getVesselSimulator,
  initStressTest,
  getStressTest,
  initFleetStressTest,
  getFleetStressTest,
} from "./instances.js";
