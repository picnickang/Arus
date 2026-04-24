/**
 * Telemetry Processing Job Processor
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("JobProcessors:TelemetryProcessor");
import { storage } from "../repositories";
import { generateAIInsights } from "../services/telemetry-processing";

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
    logger.warn("AI insights failed in background job:", { details: error });
  }

  return results;
}
