/**
 * AI Analysis Job Processors
 */

export async function processEquipmentAnalysis(data: {
  equipmentId: string;
  telemetryData: any[];
  equipmentType?: string;
}): Promise<any> {
  const { analyzeEquipmentHealth } = await import("../openai");
  return analyzeEquipmentHealth(data.telemetryData, data.equipmentId, data.equipmentType);
}

export async function processFleetAnalysis(data: {
  equipmentHealthData: any[];
  telemetryData: any[];
}): Promise<any> {
  const { analyzeFleetHealth } = await import("../openai");
  return analyzeFleetHealth(data.equipmentHealthData, data.telemetryData);
}
