/**
 * Custom Context Builder
 * 
 * Build context for specialized custom reports.
 */

import { storage } from "../storage";
import type { ReportContext, ContextBuilderOptions } from "./types.js";
import { fetchKBKnowledge } from "./knowledge-citations.js";

export async function buildCustomContext(
  reportType: string,
  params: Record<string, any>,
  orgId: string = "default-org",
  options: ContextBuilderOptions = {}
): Promise<ReportContext> {
  const timeframeDays = options.timeframeDays || 30;
  const end = new Date();
  const start = new Date(end.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

  const [vessels, equipment, workOrders, telemetry] = await Promise.all([
    storage.getVessels(),
    storage.getEquipmentRegistry(orgId),
    storage.getWorkOrders(),
    storage.getLatestTelemetryReadings(),
  ]);

  let knowledge;
  if (options.includeKnowledge) {
    knowledge = await fetchKBKnowledge(orgId, equipment, reportType);
  }

  return {
    type: "custom",
    scope: {
      timeframe: { start, end },
      organizationId: orgId,
    },
    data: {
      vessels,
      equipment,
      workOrders,
      telemetry,
    },
    metadata: {
      generatedAt: new Date(),
      audience: options.audience || "technical",
      priority: "medium",
    },
    knowledge,
  };
}
