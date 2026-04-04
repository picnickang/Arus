/**
 * SHIPMATE Import Service
 *
 * Extends the generic AMOS import service with SHIPMATE-specific logic:
 *   - Component number dot notation → parent-child hierarchy
 *   - Header normalization for SHIPMATE CSV variations
 *   - Vessel name → vessel ID resolution
 *   - Running hours synchronization
 *   - Cross-module linking (parts → equipment via component number)
 *   - RAG ingestion tuned for SHIPMATE data structure
 *
 * This is the primary integration point between SHIPMATE (the system of
 * record for PMS, stores, and crew) and ARUS (the AI/analytics layer).
 *
 * ARUS does NOT replace SHIPMATE. It reads SHIPMATE data to provide:
 *   - Predictive maintenance from telemetry + maintenance history
 *   - AI-powered equipment health scoring
 *   - Knowledge base search over maintenance history
 *   - Analytics dashboards (CII, cost trends, MTBF)
 *
 * Usage:
 *   const result = await shipmateImport.importFile(orgId, csvContent, {
 *     module: "pms_equipment",
 *     vesselName: "Green Belait",
 *   });
 */

import { parseAmosCSV, type ParseResult } from "../amos/parser";
import { applyMapping, type FieldMapping } from "../amos/field-mapping";
import {
  getShipmateMapping,
  normalizeShipmateHeaders,
  type ShipmateModuleType,
} from "./field-mapping";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import { equipment, workOrders, parts, stock, vessels } from "@shared/schema";
import { createLogger } from "../../lib/structured-logger";

const logger = createLogger("shipmate-import");

// ============================================================================
// Types
// ============================================================================

export interface ShipmateImportOptions {
  module: ShipmateModuleType;
  vesselName?: string;
  vesselId?: string;
  filename?: string;
  dryRun?: boolean;
  feedToRag?: boolean;
  delimiter?: string;
  syncRunningHours?: boolean;
}

export interface ShipmateImportResult {
  success: boolean;
  module: ShipmateModuleType;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string; data?: Record<string, unknown> }>;
  warnings: string[];
  ragDocumentsCreated: number;
  vesselResolved: string | null;
  hierarchyLevelsDetected: number;
  dryRun: boolean;
  duration: number;
}

// ============================================================================
// Vessel name → ID resolver (cached)
// ============================================================================

const vesselCache = new Map<string, string>();

async function resolveVesselId(
  orgId: string,
  vesselName?: string,
  vesselId?: string
): Promise<string | null> {
  if (vesselId) return vesselId;
  if (!vesselName) return null;

  const cacheKey = `${orgId}:${vesselName.toLowerCase()}`;
  if (vesselCache.has(cacheKey)) return vesselCache.get(cacheKey)!;

  try {
    const [vessel] = await db
      .select({ id: vessels.id })
      .from(vessels)
      .where(
        and(
          eq(vessels.orgId, orgId),
          sql`LOWER(${vessels.name}) = LOWER(${vesselName})`
        )
      )
      .limit(1);

    if (vessel) {
      vesselCache.set(cacheKey, vessel.id);
      return vessel.id;
    }

    // Try partial match (SHIPMATE sometimes abbreviates vessel names)
    const [partial] = await db
      .select({ id: vessels.id })
      .from(vessels)
      .where(
        and(
          eq(vessels.orgId, orgId),
          sql`LOWER(${vessels.name}) LIKE LOWER(${'%' + vesselName + '%'})`
        )
      )
      .limit(1);

    if (partial) {
      vesselCache.set(cacheKey, partial.id);
      return partial.id;
    }
  } catch (err) {
    logger.warn("Vessel lookup failed", { vesselName, error: err });
  }

  return null;
}

// ============================================================================
// SHIPMATE Import Service
// ============================================================================

class ShipmateImportService {

  async importFile(
    orgId: string,
    fileContent: string,
    options: ShipmateImportOptions
  ): Promise<ShipmateImportResult> {
    const startTime = Date.now();

    logger.info("Starting SHIPMATE import", {
      orgId,
      module: options.module,
      vesselName: options.vesselName,
      filename: options.filename,
    });

    // Step 1: Parse CSV (SHIPMATE exports are CSV)
    const parsed = parseAmosCSV(fileContent, { delimiter: options.delimiter });

    if (parsed.rowCount === 0) {
      return this.errorResult(options, parsed.warnings, startTime);
    }

    // Step 2: Normalize headers (SHIPMATE has inconsistent naming)
    const normalizedHeaders = normalizeShipmateHeaders(parsed.headers);
    const normalizedRows = parsed.rows.map((row) => {
      const normalized: Record<string, string> = {};
      const originalHeaders = Object.keys(row);
      for (let i = 0; i < originalHeaders.length; i++) {
        const newKey = normalizedHeaders[i] || originalHeaders[i];
        normalized[newKey] = row[originalHeaders[i]];
      }
      return normalized;
    });

    // Step 3: Resolve vessel
    const resolvedVesselId = await resolveVesselId(
      orgId,
      options.vesselName || this.extractVesselNameFromRows(normalizedRows),
      options.vesselId
    );

    if (!resolvedVesselId && options.vesselName) {
      parsed.warnings.push(
        `Vessel "${options.vesselName}" not found in ARUS. ` +
        `Create the vessel first, or data will import without a vessel link.`
      );
    }

    // Step 4: Get field mapping for this SHIPMATE module
    const mapping = getShipmateMapping(options.module);

    // Step 5: Map all rows
    const mappedRows = normalizedRows.map((row, i) => {
      const { data, errors, warnings } = applyMapping(row, mapping);
      data.orgId = orgId;
      if (resolvedVesselId && !data.vesselId) data.vesselId = resolvedVesselId;

      // For equipment: resolve vessel name from row if not set globally
      if (data._vesselName && !data.vesselId) {
        // Defer resolution — we'll batch this later
      }

      return { rowNum: i + 2, data, errors, warnings };
    });

    // Step 6: Detect hierarchy depth (equipment imports)
    let hierarchyLevelsDetected = 0;
    if (options.module === "pms_equipment") {
      const depths = normalizedRows
        .map((r) => (r["Component No"] || r["Component Number"] || "").split(".").length)
        .filter((d) => d > 0);
      hierarchyLevelsDetected = Math.max(0, ...depths);
    }

    // Step 7: Validate
    const importErrors: ShipmateImportResult["errors"] = [];
    const validRows: Array<{ rowNum: number; data: Record<string, unknown> }> = [];

    for (const row of mappedRows) {
      if (row.errors.length > 0) {
        importErrors.push({ row: row.rowNum, message: row.errors.join("; "), data: row.data });
      } else {
        validRows.push({ rowNum: row.rowNum, data: row.data });
      }
    }

    if (options.dryRun) {
      return {
        success: validRows.length > 0,
        module: options.module,
        totalRows: parsed.rowCount,
        imported: validRows.length,
        updated: 0,
        skipped: importErrors.length,
        errors: importErrors.slice(0, 50),
        warnings: parsed.warnings.concat(mappedRows.flatMap((r) => r.warnings)),
        ragDocumentsCreated: 0,
        vesselResolved: resolvedVesselId,
        hierarchyLevelsDetected,
        dryRun: true,
        duration: Date.now() - startTime,
      };
    }

    // Step 8: Topological sort for equipment hierarchy
    if (options.module === "pms_equipment") {
      this.sortByHierarchy(validRows);
    }

    // Step 9: Upsert into database
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of validRows) {
      try {
        const result = await this.upsertRow(orgId, options.module, row.data);
        if (result === "inserted") imported++;
        else if (result === "updated") updated++;
        else skipped++;
      } catch (err) {
        importErrors.push({
          row: row.rowNum,
          message: `DB error: ${err instanceof Error ? err.message : String(err)}`,
        });
        skipped++;
      }
    }

    // Step 10: Sync running hours if requested
    if (options.syncRunningHours && options.module === "pms_equipment") {
      await this.syncRunningHours(orgId, validRows.map((r) => r.data));
    }

    // Step 11: Feed to RAG
    let ragDocumentsCreated = 0;
    if (options.feedToRag !== false && (imported + updated) > 0) {
      ragDocumentsCreated = await this.feedToRag(
        orgId,
        options.module,
        validRows.map((r) => r.data),
        options.vesselName || "Unknown Vessel",
        options.filename
      );
    }

    const result: ShipmateImportResult = {
      success: imported > 0 || updated > 0,
      module: options.module,
      totalRows: parsed.rowCount,
      imported,
      updated,
      skipped,
      errors: importErrors.slice(0, 50),
      warnings: parsed.warnings.concat(mappedRows.flatMap((r) => r.warnings)),
      ragDocumentsCreated,
      vesselResolved: resolvedVesselId,
      hierarchyLevelsDetected,
      dryRun: false,
      duration: Date.now() - startTime,
    };

    logger.info("SHIPMATE import complete", {
      module: options.module,
      imported, updated, skipped,
      ragDocs: ragDocumentsCreated,
      hierarchyLevels: hierarchyLevelsDetected,
      durationMs: result.duration,
    });

    return result;
  }

  // ============================================================================
  // Hierarchy sort (parents before children)
  // ============================================================================

  private sortByHierarchy(
    rows: Array<{ rowNum: number; data: Record<string, unknown> }>
  ): void {
    rows.sort((a, b) => {
      const aId = (a.data.id as string) || "";
      const bId = (b.data.id as string) || "";
      const aDepth = aId.split(".").length;
      const bDepth = bId.split(".").length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return aId.localeCompare(bId);
    });
  }

  // ============================================================================
  // Database upsert per module type
  // ============================================================================

  private async upsertRow(
    orgId: string,
    module: ShipmateModuleType,
    data: Record<string, unknown>
  ): Promise<"inserted" | "updated" | "skipped"> {
    switch (module) {
      case "pms_equipment": return this.upsertEquipment(orgId, data);
      case "pms_jobs": return this.upsertJob(orgId, data);
      case "sps_stores": return this.upsertPart(orgId, data);
      case "cms_crew_certs":
      case "cms_rest_hours":
        // Crew data is read-only in ARUS — we ingest it for analytics
        // but don't write back to avoid conflicting with SHIPMATE
        logger.debug("Crew data ingested for analytics (read-only)", {
          module, id: data.employeeId,
        });
        return "skipped";
      default:
        return "skipped";
    }
  }

  private async upsertEquipment(
    orgId: string,
    data: Record<string, unknown>
  ): Promise<"inserted" | "updated" | "skipped"> {
    const specifications: Record<string, unknown> = {};
    const cleanData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_spec_") && value != null) {
        specifications[key.replace("_spec_", "")] = value;
      } else if (key === "_vesselName") {
        // Skip — used only for resolution
      } else if (!key.startsWith("_")) {
        cleanData[key] = value;
      }
    }

    if (Object.keys(specifications).length > 0) {
      cleanData.specifications = specifications;
    }

    cleanData.orgId = orgId;
    // Tag as SHIPMATE-sourced for data provenance
    cleanData.sourceSystem = "shipmate";

    const equipmentId = cleanData.id as string;
    if (!equipmentId) return "skipped";

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

  private async upsertJob(
    orgId: string,
    data: Record<string, unknown>
  ): Promise<"inserted" | "updated" | "skipped"> {
    const cleanData: Record<string, unknown> = {};
    const metadata: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_")) {
        if (value != null) metadata[key.replace("_", "")] = value;
      } else {
        cleanData[key] = value;
      }
    }

    cleanData.orgId = orgId;
    cleanData.sourceSystem = "shipmate";
    if (Object.keys(metadata).length > 0) {
      cleanData.metadata = metadata;
    }

    const woNumber = cleanData.woNumber as string;
    if (!woNumber) return "skipped";

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
      } else if (!key.startsWith("_")) {
        cleanData[key] = value;
      }
    }

    cleanData.orgId = orgId;
    cleanData.sourceSystem = "shipmate";

    const partNo = cleanData.partNo as string;
    if (!partNo) return "skipped";

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

    // Upsert stock
    if (Object.keys(stockData).length > 0) {
      const location = (stockData.location as string) || "MAIN";

      const [existingStock] = await db
        .select({ id: stock.id })
        .from(stock)
        .where(
          and(eq(stock.orgId, orgId), eq(stock.partId, partId), eq(stock.location, location))
        )
        .limit(1);

      if (existingStock) {
        await db.update(stock).set({
          quantityOnHand: stockData.quantityOnHand as number ?? 0,
          unitCost: stockData.unitCost as number ?? 0,
          updatedAt: new Date(),
        }).where(eq(stock.id, existingStock.id));
      } else {
        await db.insert(stock).values({
          orgId, partId, partNo, location,
          quantityOnHand: stockData.quantityOnHand as number ?? 0,
          unitCost: stockData.unitCost as number ?? 0,
          createdAt: new Date(), updatedAt: new Date(),
        } as any);
      }
    }

    return existing ? "updated" : "inserted";
  }

  // ============================================================================
  // Running hours sync
  // ============================================================================

  private async syncRunningHours(
    orgId: string,
    rows: Record<string, unknown>[]
  ): Promise<void> {
    let synced = 0;
    for (const row of rows) {
      const id = row.id as string;
      const hours = row.runningHours as number;
      if (!id || hours == null) continue;

      try {
        await db
          .update(equipment)
          .set({ runningHours: hours, updatedAt: new Date() })
          .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId)));
        synced++;
      } catch {
        // Non-fatal — running hours are supplemental
      }
    }
    if (synced > 0) {
      logger.info("Running hours synced from SHIPMATE", { orgId, count: synced });
    }
  }

  // ============================================================================
  // RAG Knowledge Base Integration
  // ============================================================================

  private async feedToRag(
    orgId: string,
    module: ShipmateModuleType,
    rows: Record<string, unknown>[],
    vesselName: string,
    filename?: string
  ): Promise<number> {
    const docs = this.generateRagDocs(module, rows, vesselName);
    if (docs.length === 0) return 0;

    let created = 0;
    try {
      for (const doc of docs) {
        try {
          const res = await fetch("http://localhost:5000/api/kb/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-org-id": orgId },
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
          if (res.ok) created++;
        } catch {
          // Non-fatal — KB may not be configured yet
        }
      }
    } catch {
      logger.warn("RAG ingestion unavailable");
    }

    return created;
  }

  private generateRagDocs(
    module: ShipmateModuleType,
    rows: Record<string, unknown>[],
    vesselName: string
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    switch (module) {
      case "pms_equipment":
        return this.generateEquipmentDocs(rows, vesselName);
      case "pms_jobs":
        return this.generateJobDocs(rows, vesselName);
      case "sps_stores":
        return this.generateStoresDocs(rows, vesselName);
      default:
        return [];
    }
  }

  private generateEquipmentDocs(
    rows: Record<string, unknown>[],
    vesselName: string
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    // Group by system type
    const bySystem = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const system = (row.systemType as string) || "General";
      if (!bySystem.has(system)) bySystem.set(system, []);
      bySystem.get(system)!.push(row);
    }

    return [...bySystem.entries()].map(([system, items]) => ({
      title: `${vesselName} — Equipment: ${system}`,
      content: [
        `# Equipment Register: ${system} (${vesselName})`,
        `Source: SHIPMATE PMS. ${items.length} components.`,
        "",
        ...items.map((item) => [
          `## ${item.id}: ${item.name}`,
          item.manufacturer && `Maker: ${item.manufacturer}`,
          item.model && `Model: ${item.model}`,
          item.serialNumber && `Serial: ${item.serialNumber}`,
          item.criticalityLevel && `Criticality: ${item.criticalityLevel}`,
          item.runningHours && `Running Hours: ${item.runningHours}`,
          item.location && `Location: ${item.location}`,
        ].filter(Boolean).join("\n")),
      ].join("\n"),
      metadata: { entityType: "equipment", system, count: items.length, vessel: vesselName },
    }));
  }

  private generateJobDocs(
    rows: Record<string, unknown>[],
    vesselName: string
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    // Group by equipment
    const byEquipment = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const eqId = (row.equipmentId as string) || "unknown";
      if (!byEquipment.has(eqId)) byEquipment.set(eqId, []);
      byEquipment.get(eqId)!.push(row);
    }

    const docs = [...byEquipment.entries()].map(([eqId, jobs]) => {
      jobs.sort((a, b) => {
        const da = a.completedAt ? new Date(a.completedAt as string).getTime() : 0;
        const db = b.completedAt ? new Date(b.completedAt as string).getTime() : 0;
        return db - da;
      });

      return {
        title: `${vesselName} — Maintenance History: ${eqId}`,
        content: [
          `# Maintenance History: Component ${eqId} (${vesselName})`,
          `Source: SHIPMATE PMS. ${jobs.length} job records.`,
          "",
          ...jobs.slice(0, 50).map((job) => [
            `## ${job.woNumber}: ${job.title}`,
            `Type: ${job.maintenanceType || "N/A"} | Status: ${job.status || "N/A"}`,
            job.completedAt && `Completed: ${new Date(job.completedAt as string).toLocaleDateString()}`,
            job.actualHours && `Hours: ${job.actualHours}`,
            job.notes && `Notes: ${job.notes}`,
          ].filter(Boolean).join("\n")),
        ].join("\n\n"),
        metadata: {
          entityType: "maintenance_history",
          equipmentId: eqId,
          jobCount: jobs.length,
          vessel: vesselName,
        },
      };
    });

    return docs;
  }

  private generateStoresDocs(
    rows: Record<string, unknown>[],
    vesselName: string
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    const byCategory = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const cat = (row.category as string) || "General";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(row);
    }

    return [...byCategory.entries()].map(([category, items]) => ({
      title: `${vesselName} — Stores: ${category}`,
      content: [
        `# Stores Inventory: ${category} (${vesselName})`,
        `Source: SHIPMATE SPS. ${items.length} items.`,
        "",
        ...items.map((item) =>
          `- **${item.partNo}**: ${item.name}` +
          (item.manufacturer ? ` (${item.manufacturer})` : "") +
          (item.criticality ? ` [${item.criticality}]` : "")
        ),
      ].join("\n"),
      metadata: { entityType: "stores", category, count: items.length, vessel: vesselName },
    }));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private extractVesselNameFromRows(rows: Record<string, string>[]): string | undefined {
    for (const row of rows) {
      const name = row["Vessel"] || row["Vessel Name"] || row["Vessel Code"];
      if (name && name.trim()) return name.trim();
    }
    return undefined;
  }

  private errorResult(
    options: ShipmateImportOptions,
    warnings: string[],
    startTime: number
  ): ShipmateImportResult {
    return {
      success: false,
      module: options.module,
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, message: "No data rows found. " + warnings.join("; ") }],
      warnings,
      ragDocumentsCreated: 0,
      vesselResolved: null,
      hierarchyLevelsDetected: 0,
      dryRun: options.dryRun ?? false,
      duration: Date.now() - startTime,
    };
  }
}

export const shipmateImport = new ShipmateImportService();
export default ShipmateImportService;
