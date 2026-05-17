/**
 * Report Context Knowledge & Citations
 *
 * KB knowledge fetching and citation building.
 */

import { db } from "../db";
import { kbDocs } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { searchKnowledgeBase, type SearchResult } from "../vector-search-service";
import type { Vessel as SelectVessel, WorkOrder } from "@shared/schema";
import type { ReportContext } from "./types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("ReportContext:KnowledgeCitations");

export async function fetchKBKnowledge(
  orgId: string,
  equipment: any[],
  reportType: string
): Promise<ReportContext["knowledge"]> {
  if (!db) {
    logger.info("[Context] KB knowledge skipped: database not available (offline mode)");
    return { documents: [], semanticMatches: [] };
  }

  try {
    const equipmentTypes = [...new Set(equipment.map((e) => e.type).filter(Boolean))];
    const equipmentNames = equipment
      .slice(0, 5)
      .map((e) => e.name)
      .filter(Boolean);
    const equipmentSystems = [...new Set(equipment.map((e) => e.system).filter(Boolean))];
    const criticalEquipment = equipment.filter(
      (e) => e.criticality === "critical" || e.criticality === "high"
    );
    const criticalTypes = [...new Set(criticalEquipment.map((e) => e.type).filter(Boolean))];

    const typeContext = equipmentTypes.slice(0, 3).join(" ");
    const nameContext = equipmentNames.slice(0, 2).join(" ");
    const systemContext = equipmentSystems.slice(0, 2).join(" ");
    const criticalContext = criticalTypes.slice(0, 2).join(" ");

    const searchQueryTemplates: Record<string, string> = {
      health: `equipment health monitoring diagnostics ${typeContext} ${nameContext} ${criticalContext ? `critical ${criticalContext}` : ""} condition assessment failure indicators`,
      maintenance: `maintenance procedures preventive corrective ${typeContext} ${nameContext} ${systemContext} service intervals troubleshooting spare parts`,
      fleet_summary: `fleet operations vessel performance ${typeContext} ${systemContext} maintenance summary operational efficiency fuel consumption`,
      compliance: `regulatory compliance SOLAS MARPOL class survey certification inspection ${typeContext} ${criticalContext} safety requirements ISM code`,
    };
    const defaultQuery =
      typeContext || nameContext || systemContext
        ? `marine equipment ${typeContext} ${nameContext} ${systemContext} operations maintenance procedures`
        : "marine equipment maintenance operations procedures safety vessel systems";
    const searchQuery = (searchQueryTemplates[reportType] ?? defaultQuery).trim();

    const orgEquipment = equipment.filter((e) => !e.orgId || e.orgId === orgId);
    const equipmentIds = orgEquipment.map((e) => e.id).filter(Boolean);
    let linkedDocuments: any[] = [];

    if (equipmentIds.length > 0 && kbDocs) {
      try {
        linkedDocuments = await db
          .select({
            id: kbDocs.id,
            name: kbDocs.name,
            equipmentId: kbDocs.equipmentId,
            extractedText: (kbDocs as any).extractedText,
          })
          .from(kbDocs)
          .where(and(eq(kbDocs.orgId, orgId), inArray(kbDocs.equipmentId, equipmentIds)))
          .limit(10);
      } catch (dbError) {
        logger.warn("[Context] Failed to fetch linked KB docs:", { details: dbError });
      }
    }

    let semanticResults: SearchResult[] = [];
    try {
      semanticResults = await (searchKnowledgeBase as any)({
        query: searchQuery,
        orgId,
        limit: 5,
      });
    } catch (searchError) {
      logger.warn("[Context] KB semantic search failed:", { details: searchError });
    }

    const documents = linkedDocuments.map((doc, index) => ({
      docId: doc.id,
      name: doc.name || "Untitled Document",
      equipmentId: doc.equipmentId,
      text: doc.extractedText?.substring(0, 500),
      relevance: Math.max(0.7, 1 - index * 0.05),
    }));

    const semanticMatches = semanticResults.map((r) => ({
      docId: r.docId ?? "",
      text: r.text ?? "",
      score: r.score,
    }));

    return {
      documents,
      semanticMatches,
    };
  } catch (error) {
    logger.error("[Context] Failed to fetch KB knowledge:", undefined, error);
    return { documents: [], semanticMatches: [] };
  }
}

export function buildCitations(
  vessel: SelectVessel | undefined,
  relatedItems: any[],
  workOrders: WorkOrder[]
): ReportContext["citations"] {
  const citations: ReportContext["citations"] = [];

  if (vessel) {
    citations.push({
      sourceType: "vessel",
      sourceId: vessel.id,
      title: vessel.name,
      relevance: 1,
    });
  }

  relatedItems.slice(0, 5).forEach((item, index) => {
    citations.push({
      sourceType: item.type || "equipment",
      sourceId: item.id,
      title: item.name || item.type || `Item ${item.id}`,
      relevance: Math.max(0.5, 1 - index * 0.1),
    });
  });

  const criticalOrders = workOrders
    .filter((wo) => (wo.priority as any) === "critical" || (wo.priority as any) === "urgent")
    .slice(0, 3);

  criticalOrders.forEach((order, index) => {
    citations.push({
      sourceType: "work_order",
      sourceId: order.id,
      title: (order as any).title ?? (order as any).description ?? order.id,
      relevance: Math.max(0.6, 0.9 - index * 0.1),
    });
  });

  return citations;
}

export function determinePriority(
  workOrders: WorkOrder[],
  alerts: any[]
): "low" | "medium" | "high" | "critical" {
  const criticalOrders = workOrders.filter((wo) => (wo.priority as any) === "critical").length;
  const urgentOrders = workOrders.filter((wo) => (wo.priority as any) === "urgent").length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;

  if (criticalOrders > 0 || criticalAlerts > 2) {
    return "critical";
  }
  if (urgentOrders > 2 || criticalAlerts > 0) {
    return "high";
  }
  if (urgentOrders > 0 || alerts.length > 5) {
    return "medium";
  }
  return "low";
}
