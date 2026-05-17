// @ts-nocheck
/**
 * Maintenance Context Builder
 *
 * Build comprehensive context for maintenance reports.
 */

import {
  vesselService,
  dbEquipmentStorage,
  workOrderService,
  dbMaintenanceStorage,
} from "../repositories";
import { vesselIntelligence } from "../vessel-intelligence";
import type { Vessel as SelectVessel, WorkOrder } from "@shared/schema";
import type { ReportContext, ContextBuilderOptions } from "./types.js";
import {
  getVesselEquipment,
  getVesselWorkOrders,
  getVesselMaintenanceSchedules,
} from "./data-fetchers.js";
import { fetchKBKnowledge, buildCitations, determinePriority } from "./knowledge-citations.js";

export async function buildMaintenanceContext(
  vesselId: string | undefined,
  orgId: string = "default-org",
  options: ContextBuilderOptions = {}
): Promise<ReportContext> {
  const timeframeDays = options.timeframeDays || 90;
  const end = new Date();
  const start = new Date(end.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

  let vessels: SelectVessel[];
  let equipment: any[];
  let workOrders: WorkOrder[];
  let schedules: any[];

  if (vesselId) {
    const vessel = await vesselService.getVessel(vesselId);
    if (!vessel) {
      throw new Error(`Vessel not found: ${vesselId}`);
    }
    vessels = [vessel];
    equipment = await getVesselEquipment(vesselId);
    workOrders = await getVesselWorkOrders(vesselId, start, end);
    schedules = await getVesselMaintenanceSchedules(vesselId);
  } else {
    vessels = await vesselService.getVessels();
    equipment = await dbEquipmentStorage.getEquipmentRegistry();
    const allOrders = await workOrderService.getWorkOrdersWithDetails();
    workOrders = allOrders.filter(
      (wo) => new Date(wo.createdAt) >= start && new Date(wo.createdAt) <= end
    );
    schedules = await dbMaintenanceStorage.getMaintenanceSchedules();
  }

  let intelligence;
  if (options.includeIntelligence && vesselId) {
    const learnings = await vesselIntelligence.learnVesselPatterns(vesselId, timeframeDays);
    intelligence = {
      vesselLearnings: learnings,
      patterns: learnings.maintenancePatterns,
    };
  }

  const citations = buildCitations(vessels[0], equipment, workOrders);
  let knowledge;
  if (options.includeKnowledge) {
    knowledge = await fetchKBKnowledge(orgId, equipment, "maintenance");
  }

  return {
    type: "maintenance",
    scope: {
      vesselId,
      timeframe: { start, end },
      organizationId: orgId,
    },
    data: {
      vessels,
      equipment,
      workOrders,
      maintenanceSchedules: schedules,
    },
    metadata: {
      generatedAt: new Date(),
      audience: options.audience || "maintenance",
      priority: determinePriority(workOrders, []),
    },
    intelligence,
    knowledge,
    citations,
  };
}
