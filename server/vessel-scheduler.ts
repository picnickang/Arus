// Stub file - vessel scheduler consolidated
export function setupVesselSchedules(): void {
  console.log("[Vessel Scheduler] Vessel schedules configured (stub)");
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
