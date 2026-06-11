/**
 * SHIPMATE Import Service
 *
 * Extends the generic AMOS import service with SHIPMATE-specific logic:
 *   - Component number dot notation → parent-child hierarchy
 *   - Header normalization for SHIPMATE CSV variations
 *   - Vessel name → vessel ID resolution (EXACT match only — see Fix #1)
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
 *     vesselName: "Green Belait",  // exact match required
 *     // OR:
 *     vesselId: "vessel-uuid-here",
 *   });
 *
 * ============================================================================
 * LAUNCH P0 FIXES APPLIED (Fix #1 + Fix #2):
 * ============================================================================
 *
 * Fix #1 — Vessel resolver: EXACT case-insensitive match only.
 *   Previously used `LIKE %name%` as a fallback, which silently matched
 *   "MV Sentinel" to "MV Sentinel II" → cross-vessel data corruption.
 *   Now:
 *     - vesselId passed → used directly (no lookup)
 *     - vesselName passed → exact case-insensitive match
 *     - Multiple matches → throw (should be impossible, but defensive)
 *     - No match → throw with clear error message listing candidates
 *   The caller (the import UI / API) should require the user to pick a
 *   vessel from a dropdown, not free-type. If free-type is kept, the
 *   failure is loud rather than silent.
 *
 * Fix #2 — Transactional wrapping + import manifest.
 *   Each module import is now wrapped in db.transaction(). A manifest row
 *   is inserted at the start, updated with final counts at the end, or
 *   rolled back with the rest if the transaction fails.
 *   A committed manifest row means: "every row below this count is safely
 *   in the DB." A missing or status='failed'/'rolled_back' manifest means:
 *   "nothing from this file got in — safe to re-try."
 * ============================================================================
 */

import { parseAmosCSV } from "../amos/parser";
import { applyMapping } from "../amos/field-mapping";
import { randomUUID } from "node:crypto";
import {
  getShipmateMapping,
  normalizeShipmateHeaders,
} from "./field-mapping";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { importManifest } from "@shared/schema";
import { createLogger } from "../../lib/structured-logger";
import { projectEquipment, retractInstalledOn } from "../../graph/projector";
import { feedShipmateRowsToRag } from "./rag-docs";
import { upsertShipmateRow } from "./row-upserts";
import { syncShipmateRunningHours } from "./running-hours";
import type {
  PendingEquipmentProjection,
  ShipmateImportOptions,
  ShipmateImportResult,
} from "./types";
import { resolveVesselId } from "./vessel-resolver";

export { VesselResolutionError } from "./types";
export type { ShipmateImportOptions, ShipmateImportResult } from "./types";

const logger = createLogger("shipmate-import");

class ShipmateImportService {
  async importFile(
    orgId: string,
    fileContent: string,
    options: ShipmateImportOptions
  ): Promise<ShipmateImportResult> {
    const startTime = Date.now();
    // Task #81 — Equipment snapshots captured INSIDE the import
    // transaction and drained ONLY after the tx commits, so a
    // rollback never leaks projector writes into the graph.
    // Request-scoped (local `const`) so overlapping `importFile()`
    // calls on the singleton service cannot bleed/race each other.
    const pendingEquipmentProjections: PendingEquipmentProjection[] = [];

    logger.info("Starting SHIPMATE import", {
      orgId,
      module: options.module,
      vesselName: options.vesselName,
      filename: options.filename,
    });

    // Step 1: Parse CSV
    const parsed = parseAmosCSV(fileContent, { delimiter: options.delimiter });

    if (parsed.rowCount === 0) {
      return this.errorResult(options, parsed.warnings, startTime);
    }

    // Step 2: Normalize headers
    const normalizedHeaders = normalizeShipmateHeaders(parsed.headers);
    const normalizedRows = parsed.rows.map((row) => {
      const normalized: Record<string, string> = {};
      const originalHeaders = Object.keys(row);
      for (let i = 0; i < originalHeaders.length; i++) {
        const origKey = originalHeaders[i];
        if (!origKey) {
          continue;
        }
        const newKey = normalizedHeaders[i] || origKey;
        normalized[newKey] = row[origKey] ?? "";
      }
      return normalized;
    });

    // Step 3: Resolve vessel. May throw VesselResolutionError — let it
    // propagate so the caller's HTTP handler returns a clear 4xx error.
    // Do NOT catch-and-swallow; that was the bug.
    const resolvedVesselId = await resolveVesselId(
      orgId,
      options.vesselName || this.extractVesselNameFromRows(normalizedRows),
      options.vesselId
    );

    // Step 4: Get field mapping for this SHIPMATE module
    const mapping = getShipmateMapping(options.module);

    // Step 5: Map all rows
    const mappedRows = normalizedRows.map((row, i) => {
      const { data, errors, warnings } = applyMapping(row, mapping);
      data["orgId"] = orgId;
      if (resolvedVesselId && !data["vesselId"]) {
        data["vesselId"] = resolvedVesselId;
      }
      return { rowNum: i + 2, data, errors, warnings };
    });

    // Step 6: Detect hierarchy depth
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
        importErrors.push({
          row: row.rowNum,
          message: row.errors.join("; "),
          data: row.data,
        });
      } else {
        validRows.push({ rowNum: row.rowNum, data: row.data });
      }
    }

    // Dry-run short-circuit: no DB writes, no manifest row.
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
        manifestId: null,
      };
    }

    // Step 8: Topological sort for equipment hierarchy
    if (options.module === "pms_equipment") {
      this.sortByHierarchy(validRows);
    }

    // Step 9: Transactional upsert.
    // Everything from here through the counts-update happens in ONE
    // transaction. If the transaction throws, Postgres rolls it all back
    // — including the manifest row. If it commits, the manifest row is
    // the audit trail for what just happened.
    let manifestId: string = "";
    let imported = 0;
    let updated = 0;
    let skipped = importErrors.length; // pre-validation failures

    try {
      await db.transaction(async (tx) => {
        // Insert manifest row inside the transaction. If the transaction
        // rolls back, this row disappears too — which is what we want:
        // a manifest row only exists if the import succeeded or partially
        // succeeded enough to record status='failed' in the catch below.
        const [manifest] = await tx
          .insert(importManifest)
          .values({
            id: randomUUID(),
            orgId,
            sourceSystem: "shipmate",
            module: options.module,
            filename: options.filename ?? null,
            vesselId: resolvedVesselId,
            vesselNameRequested: options.vesselName ?? null,
            status: "running",
            startedAt: new Date(),
            rowsTotal: parsed.rowCount,
            rowsImported: 0,
            rowsUpdated: 0,
            rowsSkipped: skipped,
            firstErrors: importErrors.length > 0 ? importErrors.slice(0, 20) : null,
            initiatedBy: options.initiatedBy ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: importManifest.id });

        if (!manifest) {
          throw new Error("import: manifest insert returned no row");
        }
        manifestId = manifest.id;

        // Upsert each valid row within the same transaction.
        for (const row of validRows) {
          try {
            const result = await upsertShipmateRow(
              tx as object as typeof db,
              orgId,
              options.module,
              row.data,
              pendingEquipmentProjections
            );
            if (result === "inserted") {
              imported++;
            } else if (result === "updated") {
              updated++;
            } else {
              skipped++;
            }
          } catch (err) {
            // Row-level error. Two options:
            //   (a) Record and continue (best-effort import)
            //   (b) Abort the whole transaction (all-or-nothing)
            //
            // We choose (b) for SHIPMATE imports: it's a maritime audit
            // system; partial imports with undocumented gaps are worse
            // than "try again after fixing the bad row." The caller
            // gets a clear error in the result and can re-upload.
            const errMsg = err instanceof Error ? err.message : String(err);
            importErrors.push({
              row: row.rowNum,
              message: `DB error: ${errMsg}`,
            });
            throw new Error(
              `Row ${row.rowNum} failed: ${errMsg}. Transaction rolled back; no data imported.`
            );
          }
        }

        // Update manifest with final counts inside the same transaction.
        await tx
          .update(importManifest)
          .set({
            status: "committed",
            completedAt: new Date(),
            rowsImported: imported,
            rowsUpdated: updated,
            rowsSkipped: skipped,
            updatedAt: new Date(),
          })
          .where(eq(importManifest.id, manifestId));
      });
      // Task #81 — tx committed cleanly; drain equipment projections.
      // Best-effort per item; projectEquipment is internally wrapped
      // in `safe()` and never throws. Running here (after the await
      // resolves) guarantees the graph only sees committed rows.
      // `pendingEquipmentProjections` is request-scoped (local), so
      // a rollback in another concurrent import does not affect this
      // drain (and vice versa).
      if (pendingEquipmentProjections.length > 0) {
        await Promise.all(
          pendingEquipmentProjections.map(async (p) => {
            // Retract stale INSTALLED_ON when vessel changed on update.
            if (p.priorVesselId && p.priorVesselId !== p.vesselId) {
              await retractInstalledOn(p.orgId, p.id, p.priorVesselId);
            }
            await projectEquipment(p.orgId, {
              id: p.id,
              name: p.name,
              type: p.type,
              vesselId: p.vesselId,
              systemType: p.systemType,
            });
          })
        );
      }
    } catch (txError) {
      // tx rolled back: nothing in `pendingEquipmentProjections` is
      // committed — discard by letting the local list fall out of
      // scope (no projection runs).
      // Transaction rolled back. Record a terminal manifest row OUTSIDE
      // the rolled-back transaction so the operator can see the attempt.
      // Use a separate insert (not update), since the running row was
      // rolled back with everything else.
      const errMsg = txError instanceof Error ? txError.message : String(txError);
      logger.error("SHIPMATE import transaction failed", {
        orgId,
        module: options.module,
        error: errMsg,
      });

      try {
        const [failedManifest] = await db
          .insert(importManifest)
          .values({
            id: randomUUID(),
            orgId,
            sourceSystem: "shipmate",
            module: options.module,
            filename: options.filename ?? null,
            vesselId: resolvedVesselId,
            vesselNameRequested: options.vesselName ?? null,
            status: "failed",
            startedAt: new Date(),
            completedAt: new Date(),
            rowsTotal: parsed.rowCount,
            rowsImported: 0,
            rowsUpdated: 0,
            rowsSkipped: parsed.rowCount,
            errorMessage: errMsg,
            firstErrors: importErrors.slice(0, 20),
            initiatedBy: options.initiatedBy ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: importManifest.id });
        if (!failedManifest) {
          throw new Error("import: failed-manifest insert returned no row");
        }
        manifestId = failedManifest.id;
      } catch (manifestErr) {
        // Can't even record the failure — log and carry on so the caller
        // gets a response. This shouldn't happen unless the manifest
        // table itself is broken.
        logger.error("Failed to record import failure in manifest", {
          error: manifestErr instanceof Error ? manifestErr.message : String(manifestErr),
        });
      }

      return {
        success: false,
        module: options.module,
        totalRows: parsed.rowCount,
        imported: 0,
        updated: 0,
        skipped: parsed.rowCount,
        errors: importErrors
          .slice(0, 50)
          .concat([{ row: 0, message: `Transaction rolled back: ${errMsg}` }]),
        warnings: parsed.warnings.concat(mappedRows.flatMap((r) => r.warnings)),
        ragDocumentsCreated: 0,
        vesselResolved: resolvedVesselId,
        hierarchyLevelsDetected,
        dryRun: false,
        duration: Date.now() - startTime,
        manifestId: manifestId || null,
      };
    }

    // Step 10: Sync running hours (outside the transaction — non-critical)
    if (options.syncRunningHours && options.module === "pms_equipment") {
      await syncShipmateRunningHours(
        orgId,
        validRows.map((r) => r.data)
      );
    }

    // Step 11: Feed to RAG (outside the transaction — it hits an external API)
    let ragDocumentsCreated = 0;
    if (options.feedToRag !== false && imported + updated > 0) {
      ragDocumentsCreated = await feedShipmateRowsToRag(
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
      manifestId: manifestId || null,
    };

    logger.info("SHIPMATE import complete", {
      module: options.module,
      manifestId,
      imported,
      updated,
      skipped,
      ragDocs: ragDocumentsCreated,
      hierarchyLevels: hierarchyLevelsDetected,
      durationMs: result.duration,
    });

    return result;
  }

  // ============================================================================
  // Hierarchy sort (parents before children)
  // ============================================================================

  private sortByHierarchy(rows: Array<{ rowNum: number; data: Record<string, unknown> }>): void {
    rows.sort((a, b) => {
      const aId = (a.data["id"] as string) || "";
      const bId = (b.data["id"] as string) || "";
      const aDepth = aId.split(".").length;
      const bDepth = bId.split(".").length;
      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }
      return aId.localeCompare(bId);
    });
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private extractVesselNameFromRows(rows: Record<string, string>[]): string | undefined {
    for (const row of rows) {
      const name = row["Vessel"] || row["Vessel Name"] || row["Vessel Code"];
      if (name && name.trim()) {
        return name.trim();
      }
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
      errors: [{ row: 0, message: `No data rows found. ${warnings.join("; ")}` }],
      warnings,
      ragDocumentsCreated: 0,
      vesselResolved: null,
      hierarchyLevelsDetected: 0,
      dryRun: options.dryRun ?? false,
      duration: Date.now() - startTime,
      manifestId: null,
    };
  }
}

export const shipmateImport = new ShipmateImportService();
export default ShipmateImportService;
