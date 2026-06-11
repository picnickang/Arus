import { createLogger } from "../../lib/structured-logger";
import type { ShipmateModuleType } from "./field-mapping";
import type { ShipmateRagDocument } from "./types";

const logger = createLogger("shipmate-import");

export async function feedShipmateRowsToRag(
  orgId: string,
  module: ShipmateModuleType,
  rows: Record<string, unknown>[],
  vesselName: string,
  filename?: string
): Promise<number> {
  const docs = generateRagDocs(module, rows, vesselName);
  if (docs.length === 0) {
    return 0;
  }

  let created = 0;
  try {
    for (const doc of docs) {
      try {
        const res = await fetch("http://localhost:5000/api/kb/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-org-id": orgId,
          },
          body: JSON.stringify({
            title: doc.title,
            content: doc.content,
            source: `SHIPMATE Import: ${filename || module}`,
            metadata: {
              ...doc.metadata,
              sourceSystem: "shipmate",
              module,
              importedAt: new Date().toISOString(),
              vessel: vesselName,
            },
          }),
        });
        if (res.ok) {
          created++;
        }
      } catch {
        // Non-fatal
      }
    }
  } catch {
    logger.warn("RAG ingestion unavailable");
  }

  return created;
}

function generateRagDocs(
  module: ShipmateModuleType,
  rows: Record<string, unknown>[],
  vesselName: string
): ShipmateRagDocument[] {
  switch (module) {
    case "pms_equipment":
      return generateEquipmentDocs(rows, vesselName);
    case "pms_jobs":
      return generateJobDocs(rows, vesselName);
    case "sps_stores":
      return generateStoresDocs(rows, vesselName);
    default:
      return [];
  }
}

function generateEquipmentDocs(
  rows: Record<string, unknown>[],
  vesselName: string
): ShipmateRagDocument[] {
  const bySystem = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const system = (row["systemType"] as string) || "General";
    if (!bySystem.has(system)) {
      bySystem.set(system, []);
    }
    bySystem.get(system)!.push(row);
  }

  return [...bySystem.entries()].map(([system, items]) => ({
    title: `${vesselName} — Equipment: ${system}`,
    content: [
      `# Equipment Register: ${system} (${vesselName})`,
      `Source: SHIPMATE PMS. ${items.length} components.`,
      "",
      ...items.map((item) =>
        [
          `## ${item["id"]}: ${item["name"]}`,
          item["manufacturer"] && `Maker: ${item["manufacturer"]}`,
          item["model"] && `Model: ${item["model"]}`,
          item["serialNumber"] && `Serial: ${item["serialNumber"]}`,
          item["criticalityLevel"] && `Criticality: ${item["criticalityLevel"]}`,
          item["runningHours"] && `Running Hours: ${item["runningHours"]}`,
          item["location"] && `Location: ${item["location"]}`,
        ]
          .filter(Boolean)
          .join("\n")
      ),
    ].join("\n"),
    metadata: {
      entityType: "equipment",
      system,
      count: items.length,
      vessel: vesselName,
    },
  }));
}

function generateJobDocs(
  rows: Record<string, unknown>[],
  vesselName: string
): ShipmateRagDocument[] {
  const byEquipment = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const eqId = (row["equipmentId"] as string) || "unknown";
    if (!byEquipment.has(eqId)) {
      byEquipment.set(eqId, []);
    }
    byEquipment.get(eqId)!.push(row);
  }

  return [...byEquipment.entries()].map(([eqId, jobs]) => {
    jobs.sort((a, b) => {
      const da = a["completedAt"] ? new Date(a["completedAt"] as string).getTime() : 0;
      const dbTime = b["completedAt"] ? new Date(b["completedAt"] as string).getTime() : 0;
      return dbTime - da;
    });

    return {
      title: `${vesselName} — Maintenance History: ${eqId}`,
      content: [
        `# Maintenance History: Component ${eqId} (${vesselName})`,
        `Source: SHIPMATE PMS. ${jobs.length} job records.`,
        "",
        ...jobs
          .slice(0, 50)
          .map((job) =>
            [
              `## ${job["woNumber"]}: ${job["title"]}`,
              `Type: ${job["maintenanceType"] || "N/A"} | Status: ${job["status"] || "N/A"}`,
              job["completedAt"] &&
                `Completed: ${new Date(job["completedAt"] as string).toLocaleDateString()}`,
              job["actualHours"] && `Hours: ${job["actualHours"]}`,
              job["notes"] && `Notes: ${job["notes"]}`,
            ]
              .filter(Boolean)
              .join("\n")
          ),
      ].join("\n\n"),
      metadata: {
        entityType: "maintenance_history",
        equipmentId: eqId,
        jobCount: jobs.length,
        vessel: vesselName,
      },
    };
  });
}

function generateStoresDocs(
  rows: Record<string, unknown>[],
  vesselName: string
): ShipmateRagDocument[] {
  const byCategory = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const cat = (row["category"] as string) || "General";
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(row);
  }

  return [...byCategory.entries()].map(([category, items]) => ({
    title: `${vesselName} — Stores: ${category}`,
    content: [
      `# Stores Inventory: ${category} (${vesselName})`,
      `Source: SHIPMATE SPS. ${items.length} items.`,
      "",
      ...items.map(
        (item) =>
          `- **${item["partNo"]}**: ${item["name"]}${
            item["manufacturer"] ? ` (${item["manufacturer"]})` : ""
          }${item["criticality"] ? ` [${item["criticality"]}]` : ""}`
      ),
    ].join("\n"),
    metadata: {
      entityType: "stores",
      category,
      count: items.length,
      vessel: vesselName,
    },
  }));
}
