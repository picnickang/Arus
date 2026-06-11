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

import { parseAmosFile } from "./parser";
import {
  applyMapping,
  EQUIPMENT_FIELD_MAP,
  WORK_ORDER_FIELD_MAP,
  PARTS_FIELD_MAP,
  MAINTENANCE_PLAN_FIELD_MAP,
  type FieldMapping,
} from "./field-mapping";
import { feedAmosRowsToRag } from "./rag-docs";
import { topologicalSortAmosRows, upsertAmosRow } from "./row-upserts";
import type { ImportError, ImportOptions, ImportResult, ImportType } from "./types";
import { createLogger } from "../../lib/structured-logger";

export type { ImportError, ImportOptions, ImportResult, ImportType } from "./types";

const logger = createLogger("amos-import");

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
        errors: [
          {
            row: 0,
            message: `No data rows found in file. ${parsed.warnings.join("; ") || "Check file format."}`,
          },
        ],
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

    const sortedRows =
      options.type === "equipment" ? topologicalSortAmosRows(validRows) : validRows;

    for (const row of sortedRows) {
      try {
        const result = await upsertAmosRow(orgId, options.type, row.data, options.vesselId);
        if (result === "inserted") {
          imported++;
        } else if (result === "updated") {
          updated++;
        } else {
          skipped++;
        }
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
    if (options.feedToRag !== false && imported + updated > 0) {
      try {
        ragDocumentsCreated = await feedAmosRowsToRag(
          orgId,
          options.type,
          validRows.map((r) => r.data),
          options.filename
        );
      } catch (err) {
        logger.error("RAG ingestion failed (non-fatal)", { error: err });
        parsed.warnings.push(
          `RAG ingestion failed: ${err instanceof Error ? err.message : String(err)}`
        );
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
      case "equipment":
        return EQUIPMENT_FIELD_MAP;
      case "work_orders":
        return WORK_ORDER_FIELD_MAP;
      case "parts":
        return PARTS_FIELD_MAP;
      case "maintenance_plans":
        return MAINTENANCE_PLAN_FIELD_MAP;
      default:
        throw new Error(`Unknown import type: ${type}`);
    }
  }
}

export const amosImportService = new AmosImportService();
export default AmosImportService;
