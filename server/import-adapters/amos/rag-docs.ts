import { createLogger } from "../../lib/structured-logger";
import type { ImportType } from "./types";

const logger = createLogger("amos-import");

// ============================================================================
// RAG Knowledge Base Integration
// ============================================================================

/**
 * Feed imported data into the RAG knowledge base.
 *
 * This is what makes AMOS import valuable beyond just data migration:
 * the imported maintenance history becomes searchable via the AI assistant.
 *
 * For each import type, we generate structured text documents that the
 * RAG chunker/embedder can process. The documents include:
 *   - Equipment: technical specs, hierarchy, manufacturer data
 *   - Work orders: failure descriptions, corrective actions, lessons learned
 *   - Parts: compatibility, substitutions, supplier info
 *   - Maintenance plans: procedures, intervals, required tools
 */
export async function feedAmosRowsToRag(
  orgId: string,
  type: ImportType,
  rows: Record<string, unknown>[],
  filename?: string
): Promise<number> {
  let ragDocuments: Array<{
    title: string;
    content: string;
    metadata: Record<string, unknown>;
  }> = [];

  switch (type) {
    case "equipment":
      ragDocuments = generateEquipmentRagDocs(rows);
      break;
    case "work_orders":
      ragDocuments = generateWorkOrderRagDocs(rows);
      break;
    case "parts":
      ragDocuments = generatePartsRagDocs(rows);
      break;
    case "maintenance_plans":
      ragDocuments = generateMaintenancePlanRagDocs(rows);
      break;
  }

  if (ragDocuments.length === 0) {
    return 0;
  }

  // Batch ingest into knowledge base
  let created = 0;
  try {
    const { ingestDocuments } = await import("../../services/kb-ingest");

    for (const doc of ragDocuments) {
      try {
        await (ingestDocuments as object as (input: Record<string, unknown>) => Promise<unknown>)({
          orgId,
          documents: [
            {
              title: doc.title,
              content: doc.content,
              source: `AMOS Import: ${filename || type}`,
              sourceType: "amos_import",
              metadata: {
                ...doc.metadata,
                importType: type,
                importedAt: new Date().toISOString(),
                sourceFile: filename,
              },
            },
          ],
        });
        created++;
      } catch (err) {
        logger.warn("Failed to ingest single RAG document", {
          title: doc.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    // kb-ingest module may not exist yet — that's OK
    logger.warn("KB ingest module not available, skipping RAG ingestion", {
      error: err instanceof Error ? err.message : String(err),
    });

    // Fallback: try direct API call
    try {
      for (const doc of ragDocuments) {
        const res = await fetch("http://localhost:5000/api/kb/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-org-id": orgId,
          },
          body: JSON.stringify({
            title: doc.title,
            content: doc.content,
            source: `AMOS Import: ${filename || type}`,
            metadata: doc.metadata,
          }),
        });

        if (res.ok) {
          created++;
        }
      }
    } catch {
      logger.warn("Direct KB API call also failed, RAG ingestion skipped");
    }
  }

  logger.info("RAG ingestion complete", { type, documents: created, total: ragDocuments.length });
  return created;
}

// ============================================================================
// RAG document generators
// ============================================================================

function generateEquipmentRagDocs(
  rows: Record<string, unknown>[]
): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
  // Group equipment by system type for more useful documents
  const bySystem = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const system = (row["systemType"] as string) || "General";
    if (!bySystem.has(system)) {
      bySystem.set(system, []);
    }
    bySystem.get(system)!.push(row);
  }

  const docs: Array<{ title: string; content: string; metadata: Record<string, unknown> }> = [];

  for (const [system, items] of bySystem) {
    const lines = items.map((item) => {
      const parts = [
        `- ${item["name"]}`,
        item["manufacturer"] && `  Manufacturer: ${item["manufacturer"]}`,
        item["model"] && `  Model: ${item["model"]}`,
        item["serialNumber"] && `  Serial: ${item["serialNumber"]}`,
        item["location"] && `  Location: ${item["location"]}`,
        item["criticalityLevel"] && `  Criticality: ${item["criticalityLevel"]}`,
        item["runningHours"] && `  Running Hours: ${item["runningHours"]}`,
        item["description"] && `  Notes: ${item["description"]}`,
      ].filter(Boolean);
      return parts.join("\n");
    });

    docs.push({
      title: `Equipment Register — ${system}`,
      content: `# Equipment Register: ${system}\n\nThe following equipment is registered under the ${system} system:\n\n${lines.join("\n\n")}`,
      metadata: {
        entityType: "equipment",
        systemType: system,
        equipmentCount: items.length,
      },
    });
  }

  return docs;
}

function generateWorkOrderRagDocs(
  rows: Record<string, unknown>[]
): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
  const docs: Array<{ title: string; content: string; metadata: Record<string, unknown> }> = [];

  // Generate per-equipment maintenance history summaries
  const byEquipment = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const eqId = (row["equipmentId"] as string) || "unknown";
    if (!byEquipment.has(eqId)) {
      byEquipment.set(eqId, []);
    }
    byEquipment.get(eqId)!.push(row);
  }

  for (const [eqId, orders] of byEquipment) {
    // Sort by date descending
    orders.sort((a, b) => {
      const da = a["completedAt"] ? new Date(a["completedAt"] as string).getTime() : 0;
      const db = b["completedAt"] ? new Date(b["completedAt"] as string).getTime() : 0;
      return db - da;
    });

    const lines = orders.slice(0, 50).map((wo) => {
      const parts = [
        `## ${wo["woNumber"]}: ${wo["title"]}`,
        `Type: ${wo["maintenanceType"] || "N/A"} | Status: ${wo["status"] || "N/A"} | Priority: ${wo["priority"] || "N/A"}`,
        wo["description"] && `Description: ${wo["description"]}`,
        wo["completedAt"] &&
          `Completed: ${new Date(wo["completedAt"] as string).toLocaleDateString()}`,
        wo["actualHours"] && `Hours: ${wo["actualHours"]}`,
        wo["notes"] && `Notes: ${wo["notes"]}`,
        wo["assignedTo"] && `Performed by: ${wo["assignedTo"]}`,
      ].filter(Boolean);
      return parts.join("\n");
    });

    docs.push({
      title: `Maintenance History — Equipment ${eqId}`,
      content: `# Maintenance History for Equipment ${eqId}\n\n${orders.length} work orders imported from AMOS.\n\n${lines.join("\n\n---\n\n")}`,
      metadata: {
        entityType: "work_order_history",
        equipmentId: eqId,
        workOrderCount: orders.length,
        dateRange: {
          earliest: orders[orders.length - 1]?.["createdAt"],
          latest: orders[0]?.["createdAt"],
        },
      },
    });
  }

  // Also create a summary document
  const typeBreakdown = new Map<string, number>();
  for (const row of rows) {
    const type = (row["maintenanceType"] as string) || "unknown";
    typeBreakdown.set(type, (typeBreakdown.get(type) || 0) + 1);
  }

  const summary = [...typeBreakdown.entries()]
    .map(([type, count]) => `- ${type}: ${count} work orders`)
    .join("\n");

  docs.push({
    title: "AMOS Work Order Import Summary",
    content: `# AMOS Work Order Import Summary\n\nImported ${rows.length} work orders from AMOS.\n\nBreakdown by type:\n${summary}\n\nThis data covers maintenance history that can be used for failure pattern analysis, MTBF calculations, and predictive maintenance model training.`,
    metadata: {
      entityType: "import_summary",
      totalWorkOrders: rows.length,
      typeBreakdown: Object.fromEntries(typeBreakdown),
    },
  });

  return docs;
}

function generatePartsRagDocs(
  rows: Record<string, unknown>[]
): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
  // Group by category
  const byCategory = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const cat = (row["category"] as string) || "General";
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(row);
  }

  return [...byCategory.entries()].map(([category, items]) => {
    const lines = items.map(
      (part) =>
        `- **${part["partNo"]}**: ${part["name"]}${part["manufacturer"] ? ` (${part["manufacturer"]})` : ""}${part["criticality"] ? ` [${part["criticality"]}]` : ""}`
    );

    return {
      title: `Spare Parts Catalog — ${category}`,
      content: `# Spare Parts: ${category}\n\n${items.length} parts in this category:\n\n${lines.join("\n")}`,
      metadata: {
        entityType: "parts_catalog",
        category,
        partCount: items.length,
      },
    };
  });
}

function generateMaintenancePlanRagDocs(
  rows: Record<string, unknown>[]
): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
  return rows.map((plan) => ({
    title: `Maintenance Plan: ${plan["title"] || plan["templateCode"]}`,
    content: [
      `# Maintenance Plan: ${plan["title"]}`,
      `Code: ${plan["templateCode"]}`,
      `Equipment: ${plan["equipmentId"] || "N/A"}`,
      plan["frequencyDays"] && `Interval: Every ${plan["frequencyDays"]} days`,
      plan["frequencyHours"] && `Running Hour Interval: Every ${plan["frequencyHours"]} hours`,
      plan["maintenanceType"] && `Type: ${plan["maintenanceType"]}`,
      plan["estimatedHours"] && `Estimated Duration: ${plan["estimatedHours"]} hours`,
      plan["description"] && `\nDescription:\n${plan["description"]}`,
      plan["_tasks"] && `\nTasks:\n${plan["_tasks"]}`,
      plan["_requiredParts"] && `\nRequired Parts:\n${plan["_requiredParts"]}`,
      plan["_requiredSkills"] && `\nRequired Skills:\n${plan["_requiredSkills"]}`,
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      entityType: "maintenance_plan",
      templateCode: plan["templateCode"],
      equipmentId: plan["equipmentId"],
    },
  }));
}
