/**
 * Telemetry Processing Job Processor
 */

export async function processTelemetryProcessing(data: {
  telemetryReading: any;
}): Promise<{ alerts: any[]; schedules: any[]; insights: any }> {
  const results = {
    alerts: [] as any[],
    schedules: [] as any[],
    insights: null as any,
  };

  try {
    const { storage } = await import("../storage");
  } catch (error) {
    console.warn("Telemetry processing failed in background job:", error);
  }

  try {
    const { storage } = await import("../storage");
    const settings = await storage.getSettings();

    if (settings.llmEnabled) {
      const { generateAIInsights } = await import("../ai-insights");
      results.insights = await generateAIInsights(data.telemetryReading);
    }
  } catch (error) {
    console.warn("AI insights failed in background job:", error);
  }

  return results;
}
