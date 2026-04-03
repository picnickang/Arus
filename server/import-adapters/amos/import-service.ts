/**
 * AMOS Import Service
 *
 * Orchestrates the full import pipeline:
 *   1. Parse AMOS CSV/XML file
 *   2. Map fields to ARUS schema
 *   3. Validate and deduplicate
 *   4. Upsert into PostgreSQL (equipment, work orders, parts, maintenance plans)
 *   5. Feed imported data into RAG knowledge base for AI-searchable context
 *
 * The RAG integration is the key differentiator: imported maintenance history
 * becomes searchable via the AI assistant. A chief engineer can ask
 * "What was the last failure mode for the main engine turbocharger?"
 * and get an answer from the imported AMOS data.
 *
 * Usage:
 *   const result = await amosImportService.importFile(orgId, fileContent, {
 *     type: "equipment",
 *     filename: "equipment-register.csv",
 *     dryRun: false,
 *     feedToRag: true,
 *   });
 */

import { parseAmosFile, type ParseResult } from "./parser";
import {
  applyMapping,
  EQUIPMENT_FIELD_MAP,
  WORK_ORDER_FIELD_MAP,
  PARTS_FIELD_MAP,
  MAINTENANCE_PLAN_FIELD_MAP,
  type FieldMapping,
} from "./field-mapping";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import { equipment, workOrders, parts, stock } from "@shared/schema";
import { createLogger } from "../../lib/structured-logger";

const logger = createLogger("amos-import");

// ============================================================================
// Types
// ============================================================================

export type ImportType = "equipment" | "work_orders" | "parts" | "maintenance_plans";

export interface ImportOptions {
  type: ImportType;
  filename?: string;
  dryRun?: boolean;
  feedToRag?: boolean;
  vesselId?: string;
  delimiter?: string;
}

export interface ImportResult {
  success: boolean;
  type: ImportType;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  warnings: string[];
  ragDocumentsCreated: number;
  dryRun: boolean;
  duration: number;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Import Service
// ============================================================================

class AmosImportService {

  async importFile(
    orgId: string,
    fileContent: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const startTime = Date.now();

    logger.info("Starting AMOS import", {
      orgId,
      type: options.type,
      filename: options.filename,
      dryRun: options.dryRun,
    });

    // Step 1: Parse
    const parsed = parseAmosFile(fileContent, options.filename);
    if (parsed.rowCount === 0) {
      return {
        success: false,
        type: options.type,
        totalRows: 0,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, message: "No data rows found in file. " + (parsed.warnings.join("; ") || "Check file format.") }],
        warnings: parsed.warnings,
        ragDocumentsCreated: 0,
        dryRun: options.dryRun ?? false,
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Get field mapping
    const mapping = this.getMappingForType(options.type);

    // Step 3: Map all rows
    const mappedRows: Array<{
      rowNum: number;
      data: Record<string, unknown>;
      errors: string[];
      warnings: string[];
    }> = parsed.rows.map((row, i) => {
      const { data, errors, warnings } = applyMapping(row, mapping);
      return { rowNum: i + 2, data: { ...data, orgId }, errors, warnings };
    });

    // Step 4: Validate
    const importErrors: ImportError[] = [];
    const validRows: Array<{ rowNum: number; data: Record<string, unknown> }> = [];

    for (const row of mappedRows) {
      if (row.errors.length > 0) {
        importErrors.push({
          row: row.rowNum,
          message: row.errors.join("; "),
          data: row.data,
        });
      } else {
        validRows.push({ rowNum: row.rowNum, data: row.data });
      }
    }

    if (options.dryRun) {
      return {
        success: importErrors.length === 0 || validRows.length > 0,
        type: options.type,
        totalRows: parsed.rowCount,
        imported: validRows.length,
        updated: 0,
        skipped: importErrors.length,
        errors: importErrors.slice(0, 50), // Cap error output
        warnings: parsed.warnings.concat(mappedRows.flatMap((r) => r.warnings)),
        ragDocumentsCreated: 0,
        dryRun: true,
        duration: Date.now() - startTime,
      };
    }

    // Step 5: Upsert into database (topological order for equipment hierarchy)
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const sortedRows = options.type === "equipment"
      ? this.topologicalSort(validRows)
      : validRows;

    for (const row of sortedRows) {
      try {
        const result = await this.upsertRow(orgId, options.type, row.data, options.vesselId);
        if (result === "inserted") imported++;
        else if (result === "updated") updated++;
        else skipped++;
      } catch (err) {
        importErrors.push({
          row: row.rowNum,
          message: `DB error: ${err instanceof Error ? err.message : String(err)}`,
          data: row.data,
        });
        skipped++;
      }
    }

    // Step 6: Feed to RAG knowledge base
    let ragDocumentsCreated = 0;
    if (options.feedToRag !== false && (imported + updated) > 0) {
      try {
        ragDocumentsCreated = await this.feedToRag(
          orgId,
          options.type,
          validRows.map((r) => r.data),
          options.filename
        );
      } catch (err) {
        logger.error("RAG ingestion failed (non-fatal)", { error: err });
        parsed.warnings.push("RAG ingestion failed: " + (err instanceof Error ? err.message : String(err)));
      }
    }

    const result: ImportResult = {
      success: importErrors.length === 0 || imported > 0 || updated > 0,
      type: options.type,
      totalRows: parsed.rowCount,
      imported,
      updated,
      skipped,
      errors: importErrors.slice(0, 50),
      warnings: parsed.warnings.concat(mappedRows.flatMap((r) => r.warnings)),
      ragDocumentsCreated,
      dryRun: false,
      duration: Date.now() - startTime,
    };

    logger.info("AMOS import complete", {
      orgId,
      type: options.type,
      imported,
      updated,
      skipped,
      errors: importErrors.length,
      ragDocs: ragDocumentsCreated,
      durationMs: result.duration,
    });

    return result;
  }

  // ============================================================================
  // Mapping selector
  // ============================================================================

  private getMappingForType(type: ImportType): FieldMapping[] {
    switch (type) {
      case "equipment": return EQUIPMENT_FIELD_MAP;
      case "work_orders": return WORK_ORDER_FIELD_MAP;
      case "parts": return PARTS_FIELD_MAP;
      case "maintenance_plans": return MAINTENANCE_PLAN_FIELD_MAP;
      default: throw new Error(`Unknown import type: ${type}`);
    }
  }

  // ============================================================================
  // Database upsert per type
  // ============================================================================

  private async upsertRow(
    orgId: string,
    type: ImportType,
    data: Record<string, unknown>,
    vesselId?: string
  ): Promise<"inserted" | "updated" | "skipped"> {
    switch (type) {
      case "equipment": return this.upsertEquipment(orgId, data, vesselId);
      case "work_orders": return this.upsertWorkOrder(orgId, data, vesselId);
      case "parts": return this.upsertPart(orgId, data);
      case "maintenance_plans": return this.upsertMaintenancePlan(orgId, data);
      default: return "skipped";
    }
  }

  private topologicalSort(
    rows: Array<{ rowNum: number; data: Record<string, unknown> }>
  ): Array<{ rowNum: number; data: Record<string, unknown> }> {
    const idMap = new Map<string, { rowNum: number; data: Record<string, unknown> }>();
    const roots: Array<{ rowNum: number; data: Record<string, unknown> }> = [];
    const children: Array<{ rowNum: number; data: Record<string, unknown> }> = [];

    for (const row of rows) {
      const id = row.data.id as string;
      if (id) idMap.set(id, row);
      const parentId = row.data.parentEquipmentId as string | undefined;
      if (!parentId) {
        roots.push(row);
      } else {
        children.push(row);
      }
    }

    const sorted = [...roots];
    const insertedIds = new Set(roots.map((r) => r.data.id as string));
    let remaining = [...children];
    let maxPasses = remaining.length + 1;

    while (remaining.length > 0 && maxPasses-- > 0) {
      const next: typeof remaining = [];
      for (const row of remaining) {
        const parentId = row.data.parentEquipmentId as string;
        if (insertedIds.has(parentId)) {
          sorted.push(row);
          insertedIds.add(row.data.id as string);
        } else {
          next.push(row);
        }
      }
      if (next.length === remaining.length) break;
      remaining = next;
    }

    sorted.push(...remaining);
    return sorted;
  }

  private async upsertEquipment(
    orgId: string,
    data: Record<string, unknown>,
    vesselId?: string
  ): Promise<"inserted" | "updated" | "skipped"> {
    // Pack _spec_ prefixed fields into specifications JSONB
    const specifications: Record<string, unknown> = {};
    const cleanData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_spec_") && value != null) {
        specifications[key.replace("_spec_", "")] = value;
      } else if (!key.startsWith("_")) {
        cleanData[key] = value;
      }
    }

    if (Object.keys(specifications).length > 0) {
      cleanData.specifications = specifications;
    }

    cleanData.orgId = orgId;
    if (vesselId && !cleanData.vesselId) cleanData.vesselId = vesselId;
    if (!cleanData.type) cleanData.type = (cleanData.systemType as string) || "general";

    const equipmentId = cleanData.id as string;
    if (!equipmentId) return "skipped";

    // Check if exists
    const [existing] = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .limit(1);

    if (existing) {
      await db
        .update(equipment)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)));
      return "updated";
    }

    await db.insert(equipment).values({
      ...cleanData,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    return "inserted";
  }

  private async upsertWorkOrder(
    orgId: string,
    data: Record<string, unknown>,
    vesselId?: string
  ): Promise<"inserted" | "updated" | "skipped"> {
    const cleanData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("_")) cleanData[key] = value;
    }

    cleanData.orgId = orgId;
    if (vesselId && !cleanData.vesselId) cleanData.vesselId = vesselId;

    const woNumber = cleanData.woNumber as string;
    if (!woNumber) return "skipped";

    // Check if exists by woNumber
    const [existing] = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)))
      .limit(1);

    if (existing) {
      await db
        .update(workOrders)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)));
      return "updated";
    }

    await db.insert(workOrders).values({
      ...cleanData,
      createdAt: cleanData.createdAt ?? new Date(),
      updatedAt: new Date(),
    } as any);
    return "inserted";
  }

  private async upsertPart(
    orgId: string,
    data: Record<string, unknown>
  ): Promise<"inserted" | "updated" | "skipped"> {
    const cleanData: Record<string, unknown> = {};
    const stockData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_stock_")) {
        stockData[key.replace("_stock_", "")] = value;
      } else if (key.startsWith("_supplier_")) {
        // Handle supplier linking separately
      } else if (!key.startsWith("_")) {
        cleanData[key] = value;
      }
    }

    cleanData.orgId = orgId;
    const partNo = cleanData.partNo as string;
    if (!partNo) return "skipped";

    // Check if exists
    const [existing] = await db
      .select({ id: parts.id })
      .from(parts)
      .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)))
      .limit(1);

    let partId: string;

    if (existing) {
      await db
        .update(parts)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)));
      partId = existing.id;
    } else {
      const [inserted] = await db.insert(parts).values({
        ...cleanData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any).returning({ id: parts.id });
      partId = inserted.id;
    }

    // Upsert stock record if we have stock data
    if (Object.keys(stockData).length > 0) {
      const location = (stockData.location as string) || "MAIN";

      const [existingStock] = await db
        .select({ id: stock.id })
        .from(stock)
        .where(
          and(
            eq(stock.orgId, orgId),
            eq(stock.partId, partId),
            eq(stock.location, location)
          )
        )
        .limit(1);

      if (existingStock) {
        await db
          .update(stock)
          .set({
            quantityOnHand: stockData.quantityOnHand as number ?? 0,
            unitCost: stockData.unitCost as number ?? 0,
            binLocation: stockData.binLocation as string ?? null,
            updatedAt: new Date(),
          })
          .where(eq(stock.id, existingStock.id));
      } else {
        await db.insert(stock).values({
          orgId,
          partId,
          partNo,
          location,
          quantityOnHand: stockData.quantityOnHand as number ?? 0,
          unitCost: stockData.unitCost as number ?? 0,
          binLocation: stockData.binLocation as string ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }
    }

    return existing ? "updated" : "inserted";
  }

  private async upsertMaintenancePlan(
    orgId: string,
    data: Record<string, unknown>
  ): Promise<"inserted" | "updated" | "skipped"> {
    // Maintenance plans map to maintenance_templates in ARUS
    // This is a simplified upsert — full implementation would parse
    // task lists and required parts from the AMOS format
    const cleanData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("_")) cleanData[key] = value;
    }

    cleanData.orgId = orgId;

    // For now, store as a generic upsert
    // TODO: Map to maintenance_templates table when it exists with templateCode unique constraint
    logger.info("Maintenance plan import (stub)", { templateCode: cleanData.templateCode });
    return "skipped";
  }

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
  private async feedToRag(
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
        ragDocuments = this.generateEquipmentRagDocs(rows);
        break;
      case "work_orders":
        ragDocuments = this.generateWorkOrderRagDocs(rows);
        break;
      case "parts":
        ragDocuments = this.generatePartsRagDocs(rows);
        break;
      case "maintenance_plans":
        ragDocuments = this.generateMaintenancePlanRagDocs(rows);
        break;
    }

    if (ragDocuments.length === 0) return 0;

    // Batch ingest into knowledge base
    let created = 0;
    try {
      const { ingestDocuments } = await import("../../services/kb-ingest");

      for (const doc of ragDocuments) {
        try {
          await ingestDocuments({
            orgId,
            documents: [{
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
            }],
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

          if (res.ok) created++;
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

  private generateEquipmentRagDocs(
    rows: Record<string, unknown>[]
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    // Group equipment by system type for more useful documents
    const bySystem = new Map<string, Record<string, unknown>[]>();

    for (const row of rows) {
      const system = (row.systemType as string) || "General";
      if (!bySystem.has(system)) bySystem.set(system, []);
      bySystem.get(system)!.push(row);
    }

    const docs: Array<{ title: string; content: string; metadata: Record<string, unknown> }> = [];

    for (const [system, items] of bySystem) {
      const lines = items.map((item) => {
        const parts = [
          `- ${item.name}`,
          item.manufacturer && `  Manufacturer: ${item.manufacturer}`,
          item.model && `  Model: ${item.model}`,
          item.serialNumber && `  Serial: ${item.serialNumber}`,
          item.location && `  Location: ${item.location}`,
          item.criticalityLevel && `  Criticality: ${item.criticalityLevel}`,
          item.runningHours && `  Running Hours: ${item.runningHours}`,
          item.description && `  Notes: ${item.description}`,
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

  private generateWorkOrderRagDocs(
    rows: Record<string, unknown>[]
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    const docs: Array<{ title: string; content: string; metadata: Record<string, unknown> }> = [];

    // Generate per-equipment maintenance history summaries
    const byEquipment = new Map<string, Record<string, unknown>[]>();

    for (const row of rows) {
      const eqId = (row.equipmentId as string) || "unknown";
      if (!byEquipment.has(eqId)) byEquipment.set(eqId, []);
      byEquipment.get(eqId)!.push(row);
    }

    for (const [eqId, orders] of byEquipment) {
      // Sort by date descending
      orders.sort((a, b) => {
        const da = a.completedAt ? new Date(a.completedAt as string).getTime() : 0;
        const db = b.completedAt ? new Date(b.completedAt as string).getTime() : 0;
        return db - da;
      });

      const lines = orders.slice(0, 50).map((wo) => {
        const parts = [
          `## ${wo.woNumber}: ${wo.title}`,
          `Type: ${wo.maintenanceType || "N/A"} | Status: ${wo.status || "N/A"} | Priority: ${wo.priority || "N/A"}`,
          wo.description && `Description: ${wo.description}`,
          wo.completedAt && `Completed: ${new Date(wo.completedAt as string).toLocaleDateString()}`,
          wo.actualHours && `Hours: ${wo.actualHours}`,
          wo.notes && `Notes: ${wo.notes}`,
          wo.assignedTo && `Performed by: ${wo.assignedTo}`,
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
            earliest: orders[orders.length - 1]?.createdAt,
            latest: orders[0]?.createdAt,
          },
        },
      });
    }

    // Also create a summary document
    const typeBreakdown = new Map<string, number>();
    for (const row of rows) {
      const type = (row.maintenanceType as string) || "unknown";
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

  private generatePartsRagDocs(
    rows: Record<string, unknown>[]
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    // Group by category
    const byCategory = new Map<string, Record<string, unknown>[]>();

    for (const row of rows) {
      const cat = (row.category as string) || "General";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(row);
    }

    return [...byCategory.entries()].map(([category, items]) => {
      const lines = items.map((part) =>
        `- **${part.partNo}**: ${part.name}${part.manufacturer ? ` (${part.manufacturer})` : ""}${part.criticality ? ` [${part.criticality}]` : ""}`
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

  private generateMaintenancePlanRagDocs(
    rows: Record<string, unknown>[]
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    return rows.map((plan) => ({
      title: `Maintenance Plan: ${plan.title || plan.templateCode}`,
      content: [
        `# Maintenance Plan: ${plan.title}`,
        `Code: ${plan.templateCode}`,
        `Equipment: ${plan.equipmentId || "N/A"}`,
        plan.frequencyDays && `Interval: Every ${plan.frequencyDays} days`,
        plan.frequencyHours && `Running Hour Interval: Every ${plan.frequencyHours} hours`,
        plan.maintenanceType && `Type: ${plan.maintenanceType}`,
        plan.estimatedHours && `Estimated Duration: ${plan.estimatedHours} hours`,
        plan.description && `\nDescription:\n${plan.description}`,
        plan._tasks && `\nTasks:\n${plan._tasks}`,
        plan._requiredParts && `\nRequired Parts:\n${plan._requiredParts}`,
        plan._requiredSkills && `\nRequired Skills:\n${plan._requiredSkills}`,
      ].filter(Boolean).join("\n"),
      metadata: {
        entityType: "maintenance_plan",
        templateCode: plan.templateCode,
        equipmentId: plan.equipmentId,
      },
    }));
  }
}

export const amosImportService = new AmosImportService();
export default AmosImportService;
