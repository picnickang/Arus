/**
 * Telemetry Processing Job Processor
 */

import { storage } from "../repositories";
import { generateAIInsights } from "../ai-insights";

export async function processTelemetryProcessing(data: {
  telemetryReading: any;
}): Promise<{ alerts: any[]; schedules: any[]; insights: any }> {
  const results = {
    alerts: [] as any[],
    schedules: [] as any[],
    insights: null as any,
  };

  try {
    const settings = await storage.getSettings();

    if (settings.llmEnabled) {
      results.insights = await generateAIInsights(data.telemetryReading);
    }
  } catch (error) {
    console.warn("AI insights failed in background job:", error);
  }

  return results;
}
