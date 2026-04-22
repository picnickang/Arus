/**
 * Global Instance Management for Vessel Simulator Services
 *
 * Provides singleton access to VesselSimulator and TelemetryStressTest instances.
 */

import type { IStorage } from "../storage/interfaces/storage.types";
import { VesselSimulator } from "./simulator.js";
import { TelemetryStressTest } from "./stress-test.js";
import { FleetStressTest } from "./fleet-stress-test.js";

let vesselSimulatorInstance: VesselSimulator | null = null;

export function initVesselSimulator(storage: IStorage): VesselSimulator {
  vesselSimulatorInstance = new VesselSimulator(storage);
  console.log("[VesselSimulator] Service initialized");
  return vesselSimulatorInstance;
}

export function getVesselSimulator(): VesselSimulator {
  if (!vesselSimulatorInstance) {
    throw new Error("Vessel simulator not initialized");
  }
  return vesselSimulatorInstance;
}

let stressTestInstance: TelemetryStressTest | null = null;

export function initStressTest(storage: IStorage): TelemetryStressTest {
  stressTestInstance = new TelemetryStressTest(storage);
  console.log("[StressTest] Harness initialized");
  return stressTestInstance;
}

export function getStressTest(): TelemetryStressTest {
  if (!stressTestInstance) {
    throw new Error("Stress test harness not initialized");
  }
  return stressTestInstance;
}

let fleetStressTestInstance: FleetStressTest | null = null;

export function initFleetStressTest(storage: IStorage): FleetStressTest {
  fleetStressTestInstance = new FleetStressTest(storage);
  console.log("[FleetStressTest] Harness initialized");
  return fleetStressTestInstance;
}

export function getFleetStressTest(): FleetStressTest {
  if (!fleetStressTestInstance) {
    throw new Error("Fleet stress test harness not initialized");
  }
  return fleetStressTestInstance;
}
