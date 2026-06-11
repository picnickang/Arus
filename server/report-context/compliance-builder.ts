/**
 * Compliance Context Builder
 *
 * Build comprehensive context for compliance reports.
 */

import {
  vesselService,
  dbCrewStorage,
  dbEquipmentStorage,
  workOrderService,
  dbStcwStorage,
} from "../repositories";
import type { Vessel as SelectVessel } from "@shared/schema";
import type { ReportContext, ContextBuilderOptions } from "./types.js";
import { getCrewCertifications, getCrewRestSheets, getComplianceLogs } from "./data-fetchers.js";
import { fetchKBKnowledge, buildCitations, determinePriority } from "./knowledge-citations.js";

export async function buildComplianceContext(
  vesselId: string | undefined,
  orgId: string = "default-org",
  options: ContextBuilderOptions = {}
): Promise<ReportContext> {
  const timeframeDays = options.timeframeDays || 90;
  const end = new Date();
  const start = new Date(end.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

  let vessels: SelectVessel[];
  let crew: Awaited<ReturnType<typeof dbCrewStorage.getCrew>>;
  let certifications: Awaited<ReturnType<typeof getCrewCertifications>>;
  let restSheets: Awaited<ReturnType<typeof getCrewRestSheets>> | unknown[];
  let complianceLogs: Awaited<ReturnType<typeof getComplianceLogs>>;

  if (vesselId) {
    const vessel = await vesselService.getVessel(vesselId);
    if (!vessel) {
      throw new Error(`Vessel not found: ${vesselId}`);
    }
    vessels = [vessel];
    crew = await dbCrewStorage.getCrew(undefined, vesselId);
    certifications = await getCrewCertifications(crew.map((c) => c.id));
    restSheets = await getCrewRestSheets(vesselId, start, end);
    complianceLogs = await getComplianceLogs(start, end);
  } else {
    vessels = await vesselService.getVessels();
    crew = await dbCrewStorage.getCrew();
    certifications = await getCrewCertifications(crew.map((c) => c.id));
    restSheets = await (
      dbStcwStorage as object as { getCrewRestRange: () => Promise<unknown[]> }
    ).getCrewRestRange();
    complianceLogs = await getComplianceLogs(start, end);
  }

  const workOrders = await workOrderService.getWorkOrdersWithDetails();
  const filteredOrders = workOrders.filter((wo) => {
    const created = new Date(wo.createdAt ?? 0);
    return created >= start && created <= end && (vesselId ? wo.vesselId === vesselId : true);
  });

  const citations = buildCitations(vessels[0], crew, filteredOrders);
  let knowledge;
  if (options.includeKnowledge) {
    const equipment = await dbEquipmentStorage.getEquipmentRegistry(orgId);
    knowledge = await fetchKBKnowledge(orgId, equipment, "compliance");
  }

  return {
    type: "compliance",
    scope: {
      vesselId,
      timeframe: { start, end },
      organizationId: orgId,
    },
    data: {
      vessels,
      crew,
      workOrders: filteredOrders,
      compliance: complianceLogs,
    },
    metadata: {
      generatedAt: new Date(),
      audience: options.audience || "compliance",
      priority: determinePriority(
        filteredOrders,
        complianceLogs as ReadonlyArray<Record<string, unknown>>
      ),
    },
    knowledge,
    citations,
  };
}
