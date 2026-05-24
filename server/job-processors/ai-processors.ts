/**
 * AI Analysis Job Processors
 */

import { analyzeEquipmentHealth, analyzeFleetHealth } from "../openai";

type EquipmentTelemetryArg = Parameters<typeof analyzeEquipmentHealth>[0];
type EquipmentHealthArg = Parameters<typeof analyzeFleetHealth>[0];
type FleetTelemetryArg = Parameters<typeof analyzeFleetHealth>[1];

export async function processEquipmentAnalysis(data: {
  equipmentId: string;
  telemetryData: EquipmentTelemetryArg;
  equipmentType?: string;
}): Promise<Awaited<ReturnType<typeof analyzeEquipmentHealth>>> {
  return analyzeEquipmentHealth(data.telemetryData, data.equipmentId, data.equipmentType);
}

export async function processFleetAnalysis(data: {
  equipmentHealthData: EquipmentHealthArg;
  telemetryData: FleetTelemetryArg;
}): Promise<Awaited<ReturnType<typeof analyzeFleetHealth>>> {
  return analyzeFleetHealth(data.equipmentHealthData, data.telemetryData);
}
