/**
 * Engine Log Event - Vessel Engine State Manager
 */

import type { EngineTelemetryState } from './types.js';

const vesselEngineState = new Map<string, EngineTelemetryState>();

export function getVesselEngineState(vesselId: string): EngineTelemetryState | undefined {
  return vesselEngineState.get(vesselId);
}

export function setVesselEngineState(vesselId: string, state: EngineTelemetryState): void {
  vesselEngineState.set(vesselId, state);
}

export function resetVesselEngineState(vesselId: string): void {
  vesselEngineState.delete(vesselId);
}

export function initVesselEngineState(vesselId: string, orgId: string): EngineTelemetryState {
  const state: EngineTelemetryState = {
    vesselId,
    orgId,
    meRunning: false,
    meRpm: 0,
    meLoad: 0,
    meExhaustTemp: 0,
    meLubOilPress: 0,
    generators: {},
  };
  vesselEngineState.set(vesselId, state);
  return state;
}
