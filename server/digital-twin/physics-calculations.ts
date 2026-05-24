/**
 * Digital Twin Physics Calculations - Navigation and fuel calculations
 */

import type { TwinState, PhysicsModel } from "./types.js";

export function calculateOptimalEngineLoad(targetSpeed: number, _physics: PhysicsModel): number {
  const baseLoad = targetSpeed / 20;
  return Math.min(0.85, Math.max(0.3, baseLoad));
}

export function calculateFuelConsumption(state: TwinState, physics: PhysicsModel): number {
  let totalConsumption = 0;
  for (const engine of Object.values(state.machinery.engines)) {
    const enginePower = 5000;
    const consumption = enginePower * engine.load * physics.propulsion.fuelConsumption;
    totalConsumption += consumption;
  }
  return totalConsumption / 1000;
}

export function calculateBearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function calculateNewPosition(
  position: { latitude: number; longitude: number },
  bearing: number,
  distanceNM: number
): { latitude: number; longitude: number } {
  const R = 3440.065;
  const bearingRad = (bearing * Math.PI) / 180;
  const lat1 = (position.latitude * Math.PI) / 180;
  const lon1 = (position.longitude * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceNM / R) +
      Math.cos(lat1) * Math.sin(distanceNM / R) * Math.cos(bearingRad)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distanceNM / R) * Math.cos(lat1),
      Math.cos(distanceNM / R) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

export function validateStateConsistency(state: TwinState): TwinState {
  state.speed = Math.max(0, Math.min(25, state.speed));
  state.heading = (state.heading + 360) % 360;
  state.draft = Math.max(1, Math.min(20, state.draft));
  state.trim = Math.max(-10, Math.min(10, state.trim));
  state.list = Math.max(-45, Math.min(45, state.list));
  for (const engine of Object.values(state.machinery.engines)) {
    engine.load = Math.max(0, Math.min(1, engine.load));
    engine.rpm = Math.max(0, Math.min(2000, engine.rpm));
    engine.temperature = Math.max(20, Math.min(150, engine.temperature));
  }
  return state;
}

export function calculateTwinAccuracy(
  telemetryData: { speed?: number; engine_temperature?: number } & Record<string, unknown>,
  twinState: TwinState
): number {
  let accuracySum = 0;
  let comparisonCount = 0;
  if (telemetryData.speed !== undefined && twinState.speed !== undefined) {
    const speedError =
      Math.abs(telemetryData.speed - twinState.speed) / Math.max(telemetryData.speed, 1);
    accuracySum += Math.max(0, 1 - speedError);
    comparisonCount++;
  }

  if (telemetryData.engine_temperature && twinState.machinery.engines) {
    const engine = Object.values(twinState.machinery.engines)[0];
    if (engine) {
      const tempError =
        Math.abs(telemetryData.engine_temperature - engine.temperature) /
        Math.max(telemetryData.engine_temperature, 1);
      accuracySum += Math.max(0, 1 - tempError);
      comparisonCount++;
    }
  }
  return comparisonCount > 0 ? accuracySum / comparisonCount : 0.85;
}

export function assimilateTelemetryData(
  currentState: TwinState,
  telemetryData: {
    position?: { latitude: number; longitude: number };
    speed?: number;
    heading?: number;
    engine_temperature?: number;
    engine_rpm?: number;
  } & Record<string, unknown>
): TwinState {
  const updatedState = { ...currentState };
  if (telemetryData.position) {
    updatedState.position = telemetryData.position;
  }
  if (telemetryData.speed !== undefined) {
    updatedState.speed = telemetryData.speed;
  }
  if (telemetryData.heading !== undefined) {
    updatedState.heading = telemetryData.heading;
  }
  if (telemetryData.engine_temperature) {
    const engine = Object.values(updatedState.machinery.engines)[0];
    if (engine) {
      engine.temperature = telemetryData.engine_temperature;
    }
  }

  if (telemetryData.engine_rpm) {
    const engine = Object.values(updatedState.machinery.engines)[0];
    if (engine) {
      engine.rpm = telemetryData.engine_rpm;
      engine.load = engine.rpm / 1800;
    }
  }
  return updatedState;
}
