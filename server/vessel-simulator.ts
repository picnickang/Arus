/**
 * Vessel Telemetry Simulator - Backward Compatibility Shim
 * 
 * This file re-exports from the modularized vessel-simulator/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/vessel-simulator/index.ts for the modular implementation
 */

export type { StressTestConfig, StressTestResult, FleetStressConfig, FleetStressResult } from "./vessel-simulator/index.js";

export {
  VesselSimulator,
  TelemetryStressTest,
  FleetStressTest,
  initVesselSimulator,
  getVesselSimulator,
  initStressTest,
  getStressTest,
  initFleetStressTest,
  getFleetStressTest,
} from "./vessel-simulator/index.js";
