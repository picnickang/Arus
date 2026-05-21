/**
 * Crew Alert Evaluators - Manning Compliance
 * Evaluates minimum safe manning alerts
 */

import { vesselService, dbCrewStorage } from "../../../repositories";
import { alertSettingsService } from "../settings-service.js";
import type { CrewAlertResult, EvaluationContext } from "./types.js";
import { getSeverityFromMinSeverity } from "./helpers.js";

export async function evaluateManningComplianceAlerts(
  ctx: EvaluationContext
): Promise<CrewAlertResult[]> {
  const results: CrewAlertResult[] = [];
  const now = ctx.now || new Date();

  const baseSettings = await alertSettingsService.getCrewAlertSettings(
    ctx.orgId,
    ctx.vesselId ?? undefined
  );
  const settings = baseSettings as
    | (typeof baseSettings & {
        manningComplianceEnabled?: boolean;
        manningMinSeverity?: string | null;
      })
    | null;
  if (!settings?.manningComplianceEnabled) {
    return results;
  }

  const vessels = ctx.vesselId
    ? [await vesselService.getVessel(ctx.vesselId)]
    : await vesselService.getVessels(ctx.orgId);

  for (const vessel of vessels) {
    if (!vessel) {
      continue;
    }
    const minSafeManning =
      "minSafeManning" in vessel && typeof vessel.minSafeManning === "number"
        ? vessel.minSafeManning
        : 0;
    if (minSafeManning === 0) {
      continue;
    }

    const vesselCrew = await dbCrewStorage.getCrew(ctx.orgId, vessel.id);
    const activeCrew = vesselCrew.filter((c: any) => c.status === "active" || c.status === "onboard");
    const currentManning = activeCrew.length;

    if (currentManning < minSafeManning) {
      const severity = getSeverityFromMinSeverity(settings?.manningMinSeverity ?? undefined);
      results.push({
        triggered: true,
        alertType: "manning_below_minimum",
        alertKey: `manning_below_minimum_${vessel.id}`,
        severity,
        title: "Below Minimum Safe Manning",
        message: `Vessel ${vessel.name} has ${currentManning} crew, below minimum of ${minSafeManning}`,
        entityId: vessel.id,
        entityType: "vessel",
        metadata: {
          vesselId: vessel.id,
          vesselName: vessel.name,
          currentManning,
          minimumManning: minSafeManning,
          shortage: minSafeManning - currentManning,
        },
      });
    }
  }

  return results;
}
