/**
 * AI Analysis Job Processors
 */

import { analyzeEquipmentHealth, analyzeFleetHealth } from "../openai";

export async function processEquipmentAnalysis(data: {
  equipmentId: string;
  telemetryData: any[];
  equipmentType?: string;
}): Promise<any> {
  return analyzeEquipmentHealth(data.telemetryData, data.equipmentId, data.equipmentType);
}

export async function processFleetAnalysis(data: {
  equipmentHealthData: any[];
  telemetryData: any[];
}): Promise<any> {
  return analyzeFleetHealth(data.equipmentHealthData, data.telemetryData);
}
