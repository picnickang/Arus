import { createLogger } from "./lib/structured-logger";
const logger = createLogger("VesselScheduler");
// Stub file - vessel scheduler consolidated
export function setupVesselSchedules(): void {
  logger.info("[Vessel Scheduler] Vessel schedules configured (stub)");
}

export function startVesselScheduler(): void {
  // No-op
}

export function stopVesselScheduler(): void {
  // No-op
}

export const vesselScheduler = {
  setup: setupVesselSchedules,
  start: startVesselScheduler,
  stop: stopVesselScheduler,
};
