/**
 * Fleet Technician Insights
 *
 * Generate insights for all equipment across the fleet.
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("InsightsEngine:FleetInsights");
import { dbEquipmentStorage } from "../repositories";
import { recordFleetTechnicianInsight } from "../ml-prometheus-metrics";
import type { TechnicianInsightView, VesselInsightGroup } from "./types.js";
import { generateTechnicianInsight } from "./technician-insight.js";

const PRIORITY_ORDER = {
  immediate: 0,
  urgent: 1,
  scheduled: 2,
  monitor: 3,
  routine: 4,
} as const;

/**
 * Generate technician insights for all equipment in a fleet/vessel
 */
export async function generateFleetTechnicianInsights(
  orgId: string,
  vesselId?: string
): Promise<VesselInsightGroup[]> {
  const startTime = Date.now();
  try {
    const allEquipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
    const equipment = allEquipment.filter(
      (eq) => eq.isActive && (!vesselId || eq.vesselId === vesselId)
    );

    const insights = await Promise.all(
      equipment.map((eq) => generateTechnicianInsight(eq.id, orgId))
    );

    const validInsights = insights.filter((i): i is TechnicianInsightView => i !== null);

    const vesselGroups = new Map<string, TechnicianInsightView[]>();
    validInsights.forEach((insight) => {
      const vId = insight.vesselId || "unassigned";
      if (!vesselGroups.has(vId)) {
        vesselGroups.set(vId, []);
      }
      vesselGroups.get(vId)!.push(insight);
    });

    const result = Array.from(vesselGroups.entries()).map(([vId, insights]) => ({
      vesselId: vId,
      vesselName: insights[0]?.vesselName || "Unassigned Equipment",
      insights: insights.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 99;
        const pb = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 99;
        return pa - pb;
      }),
    }));

    const duration = (Date.now() - startTime) / 1000;

    recordFleetTechnicianInsight(orgId, result.length, duration, true);

    logger.info(String(JSON.stringify({
        msg: "fleet_insights_done",
        orgId,
        vesselFilter: vesselId ?? null,
        groups: result.length,
        t_ms: Date.now() - startTime,
      })));

    return result;
  } catch (error) {
    logger.error("[Insights] Failed to generate fleet technician insights:", undefined, error);

    const duration = (Date.now() - startTime) / 1000;

    recordFleetTechnicianInsight(orgId, 0, duration, false);

    return [];
  }
}
