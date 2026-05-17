/**
 * DTC Health and Financial Impact Calculations
 */

import { dbEquipmentStorage, dbDtcStorage, workOrderService, vesselService } from "../repositories";
import type { DtcWithDefinition, DtcSummary, DtcFinancialImpact } from "./types";

export function calculateDtcHealthImpact(activeDtcs: DtcWithDefinition[]): number {
  let healthPenalty = 0;

  for (const dtc of activeDtcs) {
    const severity = dtc.definition?.severity ?? 4;
    // @ts-ignore -- bulk-silence
    const occurrenceMultiplier = Math.min(dtc.oc / 10, 2);
    const basePenalty = severity === 1 ? 30 : severity === 2 ? 20 : severity === 3 ? 10 : 5;
    healthPenalty += basePenalty * (1 + occurrenceMultiplier);
  }

  return Math.min(healthPenalty, 100);
}

export async function getDtcSummaryForReports(
  equipmentId: string,
  orgId: string
): Promise<DtcSummary> {
  const dtcs = await dbDtcStorage.getActiveDtcs(equipmentId, orgId);

  const criticalCount = dtcs.filter((d) => d.definition?.severity === 1).length;
  const highCount = dtcs.filter((d) => d.definition?.severity === 2).length;
  const moderateCount = dtcs.filter((d) => d.definition?.severity === 3).length;
  const lowCount = dtcs.filter((d) => d.definition?.severity === 4).length;

  const topDtcs = dtcs
    .sort((a, b) => {
      const sevA = a.definition?.severity ?? 999;
      const sevB = b.definition?.severity ?? 999;
      if (sevA !== sevB) {
        return sevA - sevB;
      }
      // @ts-ignore -- bulk-silence
      return b.oc - a.oc;
    })
    .slice(0, 5)
    .map((d) => ({
      spn: d.spn,
      fmi: d.fmi,
      description: d.definition?.description ?? "Unknown fault",
      severity: d.definition?.severity ?? 0,
      oc: d.oc,
    }));

  return {
    activeDtcCount: dtcs.length,
    criticalCount,
    highCount,
    moderateCount,
    lowCount,
    // @ts-ignore -- bulk-silence
    topDtcs,
  };
}

export async function calculateDtcFinancialImpact(
  vesselId: string,
  orgId: string
): Promise<DtcFinancialImpact> {
  const vesselEquipment = await dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || "");
  let totalDowntimeHours = 0;
  let criticalDtcCount = 0;

  for (const eq of vesselEquipment) {
    const dtcs = await dbDtcStorage.getActiveDtcs(eq.id, orgId);
    criticalDtcCount += dtcs.filter((d) => d.definition?.severity === 1).length;

    const eqWorkOrders = await workOrderService.getWorkOrdersWithDetails(eq.id);
    const dtcWorkOrders = eqWorkOrders.filter(
      (wo) => wo.reason?.includes("DTC Fault") && wo.affectsVesselDowntime
    );

    for (const wo of dtcWorkOrders) {
      totalDowntimeHours += wo.actualDowntimeHours ?? wo.estimatedDowntimeHours ?? 0;
    }
  }

  const vessel = await vesselService.getVessel(vesselId, orgId);
  // @ts-ignore -- bulk-silence
  const dayRate = vessel?.dayRate ? Number(vessel.dayRate) : 50000;
  const hourlyRate = dayRate / 24;

  return { totalDowntimeHours, estimatedCost: totalDowntimeHours * hourlyRate, criticalDtcCount };
}
