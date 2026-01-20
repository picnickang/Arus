/**
 * Compliance Context Builder
 * 
 * Build comprehensive context for compliance reports.
 */

import { storage } from "../storage";
import type { SelectVessel } from "@shared/schema-runtime";
import type { ReportContext, ContextBuilderOptions } from "./types.js";
import {
  getCrewCertifications,
  getCrewRestSheets,
  getComplianceLogs,
} from "./data-fetchers.js";
import {
  fetchKBKnowledge,
  buildCitations,
  determinePriority,
} from "./knowledge-citations.js";

export async function buildComplianceContext(
  vesselId: string | undefined,
  orgId: string = "default-org",
  options: ContextBuilderOptions = {}
): Promise<ReportContext> {
  const timeframeDays = options.timeframeDays || 90;
  const end = new Date();
  const start = new Date(end.getTime() - timeframeDays * 24 * 60 * 60 * 1000);

  let vessels: SelectVessel[];
  let crew: any[];
  let certifications: any[];
  let restSheets: any[];
  let complianceLogs: any[];

  if (vesselId) {
    const vessel = await storage.getVessel(vesselId);
    if (!vessel) {
      throw new Error(`Vessel not found: ${vesselId}`);
    }
    vessels = [vessel];
    crew = await storage.getCrew(undefined, vesselId);
    certifications = await getCrewCertifications(crew.map((c) => c.id));
    restSheets = await getCrewRestSheets(vesselId, start, end);
    complianceLogs = await getComplianceLogs(start, end);
  } else {
    vessels = await storage.getVessels();
    crew = await storage.getCrew();
    certifications = await getCrewCertifications(crew.map((c) => c.id));
    restSheets = await storage.getCrewRestSheets();
    complianceLogs = await getComplianceLogs(start, end);
  }

  const workOrders = await storage.getWorkOrders();
  const filteredOrders = workOrders.filter(
    (wo) =>
      new Date(wo.createdAt) >= start &&
      new Date(wo.createdAt) <= end &&
      (vesselId ? wo.vesselId === vesselId : true)
  );

  const citations = buildCitations(vessels[0], crew, filteredOrders);
  let knowledge;
  if (options.includeKnowledge) {
    const equipment = await storage.getEquipmentRegistry(orgId);
    knowledge = await fetchKBKnowledge(orgId, equipment, 'compliance');
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
      priority: determinePriority(filteredOrders, complianceLogs),
    },
    knowledge,
    citations,
  };
}
