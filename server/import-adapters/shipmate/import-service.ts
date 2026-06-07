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
import {
  getShipmateMapping,
  normalizeShipmateHeaders,
  type ShipmateModuleType,
} from "./field-mapping";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import { equipment, workOrders, parts, stock, vessels } from "@shared/schema";
import { importManifest } from "@shared/schema";
import { createLogger } from "../../lib/structured-logger";
import { projectEquipment, retractInstalledOn } from "../../graph/projector";

const logger = createLogger("shipmate-import");

// ============================================================================
// Types
// ============================================================================

export interface ShipmateImportOptions {
  module: ShipmateModuleType;
  /**
   * Exact vessel name (case-insensitive). Must match exactly one vessel in
   * the org. If ambiguous or no match, import fails loudly.
   * Prefer passing `vesselId` directly when known.
   */
  vesselName?: string | undefined;
  /**
   * Explicit vessel ID. Bypasses name lookup. Recommended for UI flows
   * where the user picks from a dropdown.
   */
  vesselId?: string | undefined;
  filename?: string | undefined;
  dryRun?: boolean | undefined;
  feedToRag?: boolean;
  delimiter?: string;
  syncRunningHours?: boolean;
  /**
   * User who initiated the import. Recorded in the manifest for audit.
   */
  initiatedBy?: string;
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
  /**
   * Import manifest row ID. Non-null on non-dry-run imports. Use this to
   * query the manifest for audit ("what did import X actually do?").
   */
  manifestId: string | null;
}

/**
 * Thrown when vessel name resolution fails in a way the caller should know
 * about. Caller should surface the message to the UI rather than swallowing.
 */
export class VesselResolutionError extends Error {
  constructor(
    message: string,
    public readonly candidates: string[] = []
  ) {
    super(message);
    this.name = "VesselResolutionError";
  }
}

// ============================================================================
// Vessel name → ID resolver (no cache — correctness over speed)
// ============================================================================
//
// The previous implementation cached by name. We've removed the cache to
// keep the resolution logic simple and because:
//   - Imports are slow anyway (I/O bound); a few extra SELECTs don't matter
//   - Cached bugs are the worst kind of bugs; a stale cache would silently
//     attach data to a renamed/deleted vessel
// If this becomes a real performance issue, add a per-import cache scoped
// to the importFile() call, not a process-wide cache.
// ============================================================================

async function resolveVesselId(
  orgId: string,
  vesselName?: string,
  vesselId?: string
): Promise<string | null> {
  // Explicit vessel ID wins — caller took responsibility.
  if (vesselId) {
    return vesselId;
  }

  // No name supplied → no resolution possible. Not an error; some
  // imports legitimately have no vessel scope.
  if (!vesselName) {
    return null;
  }

  const trimmedName = vesselName.trim();
  if (!trimmedName) {
    return null;
  }

  // EXACT case-insensitive match only. No LIKE, no partial, no substring.
  const matches = await db
    .select({ id: vessels.id, name: vessels.name })
    .from(vessels)
    .where(and(eq(vessels.orgId, orgId), sql`LOWER(${vessels.name}) = LOWER(${trimmedName})`));

  if (matches.length === 1 && matches[0]) {
    return matches[0].id;
  }

  if (matches.length === 0) {
    // Give the caller a useful error: include candidates that share a
    // prefix/substring so they can tell whether the name was a typo or
    // whether the vessel genuinely doesn't exist yet.
    const candidates = await db
      .select({ name: vessels.name })
      .from(vessels)
      .where(
        and(eq(vessels.orgId, orgId), sql`LOWER(${vessels.name}) LIKE LOWER(${`%${trimmedName}%`})`)
      )
      .limit(10);

    const candidateNames = candidates.map((c) => c.name);
    const hint =
      candidateNames.length > 0
        ? ` Similar vessels in this org: ${candidateNames.join(", ")}.`
        : " No similar vessels found — create the vessel in ARUS before importing.";

    throw new VesselResolutionError(`Vessel "${vesselName}" not found.${hint}`, candidateNames);
  }

  // matches.length > 1 — should be rare but possible if the name column
  // has no unique constraint. Fail loudly rather than picking the first.
  const matchNames = matches.map((m) => m.name);
  throw new VesselResolutionError(
    `Vessel name "${vesselName}" is ambiguous — matched ${matches.length} vessels. ` +
      `Pass an explicit vesselId instead. Candidates: ${matchNames.join(", ")}.`,
    matchNames
  );
}

// ============================================================================
// SHIPMATE Import Service
// ============================================================================

interface PendingEquipmentProjection {
  orgId: string;
  id: string;
  name: string | null;
  type: string | null;
  vesselId: string | null;
  systemType: string | null;
  // Task #81 — prior vesselId for INSTALLED_ON retraction on update
  // paths. `null` (insert) or `same as vesselId` (no change) means
  // no retraction; otherwise the drainer retracts the stale edge
  // before re-projecting.
  priorVesselId: string | null;
}

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
        if (!origKey) {continue;}
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
      data['orgId'] = orgId;
      if (resolvedVesselId && !data['vesselId']) {
        data['vesselId'] = resolvedVesselId;
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
            orgId,
            sourceSystem: "shipmate",
            module: options.module,
            filename: options.filename ?? null,
            vesselId: resolvedVesselId,
            vesselNameRequested: options.vesselName ?? null,
            status: "running",
            rowsTotal: parsed.rowCount,
            rowsImported: 0,
            rowsUpdated: 0,
            rowsSkipped: skipped,
            firstErrors: importErrors.length > 0 ? importErrors.slice(0, 20) : null,
            initiatedBy: options.initiatedBy ?? null,
          })
          .returning({ id: importManifest.id });

        if (!manifest) {throw new Error("import: manifest insert returned no row");}
        manifestId = manifest.id;

        // Upsert each valid row within the same transaction.
        for (const row of validRows) {
          try {
            const result = await this.upsertRow(
              tx as object as Parameters<typeof this.upsertRow>[0],
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
            orgId,
            sourceSystem: "shipmate",
            module: options.module,
            filename: options.filename ?? null,
            vesselId: resolvedVesselId,
            vesselNameRequested: options.vesselName ?? null,
            status: "failed",
            completedAt: new Date(),
            rowsTotal: parsed.rowCount,
            rowsImported: 0,
            rowsUpdated: 0,
            rowsSkipped: parsed.rowCount,
            errorMessage: errMsg,
            firstErrors: importErrors.slice(0, 20),
            initiatedBy: options.initiatedBy ?? null,
          })
          .returning({ id: importManifest.id });
        if (!failedManifest) {throw new Error("import: failed-manifest insert returned no row");}
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
      await this.syncRunningHours(
        orgId,
        validRows.map((r) => r.data)
      );
    }

    // Step 11: Feed to RAG (outside the transaction — it hits an external API)
    let ragDocumentsCreated = 0;
    if (options.feedToRag !== false && imported + updated > 0) {
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
      const aId = (a.data['id'] as string) || "";
      const bId = (b.data['id'] as string) || "";
      const aDepth = aId.split(".").length;
      const bDepth = bId.split(".").length;
      if (aDepth !== bDepth) {
        return aDepth - bDepth;
      }
      return aId.localeCompare(bId);
    });
  }

  // ============================================================================
  // Database upsert per module type
  // Each method now accepts a transaction handle instead of using global `db`.
  // ============================================================================

  private async upsertRow(
    tx: typeof db,
    orgId: string,
    module: ShipmateModuleType,
    data: Record<string, unknown>,
    pendingEquipmentProjections: PendingEquipmentProjection[]
  ): Promise<"inserted" | "updated" | "skipped"> {
    switch (module) {
      case "pms_equipment":
        return this.upsertEquipment(tx, orgId, data, pendingEquipmentProjections);
      case "pms_jobs":
        return this.upsertJob(tx, orgId, data);
      case "sps_stores":
        return this.upsertPart(tx, orgId, data);
      case "cms_crew_certs":
      case "cms_rest_hours":
        logger.debug("Crew data ingested for analytics (read-only)", {
          module,
          id: data['employeeId'],
        });
        return "skipped";
      default:
        return "skipped";
    }
  }

  private async upsertEquipment(
    tx: typeof db,
    orgId: string,
    data: Record<string, unknown>,
    pendingEquipmentProjections: PendingEquipmentProjection[]
  ): Promise<"inserted" | "updated" | "skipped"> {
    const specifications: Record<string, unknown> = {};
    const cleanData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_spec_") && value != null) {
        specifications[key.replace("_spec_", "")] = value;
      } else if (key === "_vesselName") {
        // skip
      } else if (!key.startsWith("_")) {
        cleanData[key] = value;
      }
    }

    if (Object.keys(specifications).length > 0) {
      cleanData['specifications'] = specifications;
    }

    cleanData['orgId'] = orgId;
    cleanData['sourceSystem'] = "shipmate";

    const equipmentId = cleanData['id'] as string;
    if (!equipmentId) {
      return "skipped";
    }

    const [existing] = await tx
      .select({ id: equipment.id, vesselId: equipment.vesselId })
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .limit(1);

    // Task #81 — Capture an equipment snapshot for post-commit graph
    // projection (both insert and update branches). We MUST NOT call
    // projectEquipment here: this method runs inside
    // `db.transaction(...)`, and firing pre-commit (even via
    // queueMicrotask) risks the graph leading relational truth when
    // the surrounding tx rolls back. `pendingEquipmentProjections`
    // is drained by `importFile` after the tx commits successfully.
    //
    // Effective field values are taken from the row that was actually
    // persisted (`.returning(...)`), NOT from `cleanData`. A partial
    // import update may omit `vesselId`/`name`/`type`/`systemType`,
    // and treating an omitted field as `null` would cause spurious
    // retractions (e.g. `INSTALLED_ON` would be torn down even though
    // the relational vessel assignment was unchanged).
    const enqueueProjection = (
      persisted: {
        id: string;
        name: string | null;
        type: string | null;
        vesselId: string | null;
        systemType: string | null;
      },
      priorVesselId: string | null
    ) => {
      if (!orgId) {return;}
      pendingEquipmentProjections.push({
        orgId,
        id: persisted.id,
        name: persisted.name,
        type: persisted.type,
        vesselId: persisted.vesselId,
        systemType: persisted.systemType,
        priorVesselId,
      });
    };

    if (existing) {
      const [updatedRow] = await tx
        .update(equipment)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
        .returning({
          id: equipment.id,
          name: equipment.name,
          type: equipment.type,
          vesselId: equipment.vesselId,
          systemType: equipment.systemType,
        });
      if (updatedRow) {
        enqueueProjection(updatedRow, existing.vesselId ?? null);
      }
      return "updated";
    }

    const [insertedRow] = await tx
      .insert(equipment)
      .values({
        ...cleanData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as object as never)
      .returning({
        id: equipment.id,
        name: equipment.name,
        type: equipment.type,
        vesselId: equipment.vesselId,
        systemType: equipment.systemType,
      });
    if (insertedRow) {
      enqueueProjection(insertedRow, null);
    }
    return "inserted";
  }

  private async upsertJob(
    tx: typeof db,
    orgId: string,
    data: Record<string, unknown>
  ): Promise<"inserted" | "updated" | "skipped"> {
    const cleanData: Record<string, unknown> = {};
    const metadata: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_")) {
        if (value != null) {
          metadata[key.replace("_", "")] = value;
        }
      } else {
        cleanData[key] = value;
      }
    }

    cleanData['orgId'] = orgId;
    cleanData['sourceSystem'] = "shipmate";
    if (Object.keys(metadata).length > 0) {
      cleanData['metadata'] = metadata;
    }

    const woNumber = cleanData['woNumber'] as string;
    if (!woNumber) {
      return "skipped";
    }

    const [existing] = await tx
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)))
      .limit(1);

    if (existing) {
      await tx
        .update(workOrders)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(and(eq(workOrders.woNumber, woNumber), eq(workOrders.orgId, orgId)));
      return "updated";
    }

    await tx.insert(workOrders).values({
      ...cleanData,
      createdAt: cleanData['createdAt'] ?? new Date(),
      updatedAt: new Date(),
    } as object as never);
    return "inserted";
  }

  private async upsertPart(
    tx: typeof db,
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

    cleanData['orgId'] = orgId;
    cleanData['sourceSystem'] = "shipmate";

    const partNo = cleanData['partNo'] as string;
    if (!partNo) {
      return "skipped";
    }

    const [existing] = await tx
      .select({ id: parts.id })
      .from(parts)
      .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)))
      .limit(1);

    let partId: string;

    if (existing) {
      await tx
        .update(parts)
        .set({ ...cleanData, updatedAt: new Date() })
        .where(and(eq(parts.partNo, partNo), eq(parts.orgId, orgId)));
      partId = existing.id;
    } else {
      const [inserted] = await tx
        .insert(parts)
        .values({
          ...cleanData,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as object as never)
        .returning({ id: parts.id });
      if (!inserted) {throw new Error("import: parts insert returned no row");}
      partId = inserted.id;
    }

    // Upsert stock (inside the same transaction)
    if (Object.keys(stockData).length > 0) {
      const location = (stockData['location'] as string) || "MAIN";

      const [existingStock] = await tx
        .select({ id: stock.id })
        .from(stock)
        .where(and(eq(stock.orgId, orgId), eq(stock.partId, partId), eq(stock.location, location)))
        .limit(1);

      if (existingStock) {
        await tx
          .update(stock)
          .set({
            quantityOnHand: (stockData['quantityOnHand'] as number) ?? 0,
            unitCost: (stockData['unitCost'] as number) ?? 0,
            updatedAt: new Date(),
          })
          .where(eq(stock.id, existingStock.id));
      } else {
        await tx.insert(stock).values({
          orgId,
          partId,
          partNo,
          location,
          quantityOnHand: (stockData['quantityOnHand'] as number) ?? 0,
          unitCost: (stockData['unitCost'] as number) ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as object as never);
      }
    }

    return existing ? "updated" : "inserted";
  }

  // ============================================================================
  // Running hours sync (non-transactional — supplemental data)
  // ============================================================================

  private async syncRunningHours(orgId: string, rows: Record<string, unknown>[]): Promise<void> {
    let synced = 0;
    for (const row of rows) {
      const id = row['id'] as string;
      const hours = row['runningHours'] as number;
      if (!id || hours == null) {
        continue;
      }

      try {
        await db
          .update(equipment)
          .set({ runningHours: hours, updatedAt: new Date() } as object as never)
          .where(and(eq(equipment.id, id), eq(equipment.orgId, orgId)));
        synced++;
      } catch {
        // Non-fatal
      }
    }
    if (synced > 0) {
      logger.info("Running hours synced from SHIPMATE", { orgId, count: synced });
    }
  }

  // ============================================================================
  // RAG Knowledge Base Integration (unchanged from original)
  // ============================================================================

  private async feedToRag(
    orgId: string,
    module: ShipmateModuleType,
    rows: Record<string, unknown>[],
    vesselName: string,
    filename?: string
  ): Promise<number> {
    const docs = this.generateRagDocs(module, rows, vesselName);
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
    const bySystem = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const system = (row['systemType'] as string) || "General";
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
            `## ${item['id']}: ${item['name']}`,
            item['manufacturer'] && `Maker: ${item['manufacturer']}`,
            item['model'] && `Model: ${item['model']}`,
            item['serialNumber'] && `Serial: ${item['serialNumber']}`,
            item['criticalityLevel'] && `Criticality: ${item['criticalityLevel']}`,
            item['runningHours'] && `Running Hours: ${item['runningHours']}`,
            item['location'] && `Location: ${item['location']}`,
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

  private generateJobDocs(
    rows: Record<string, unknown>[],
    vesselName: string
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    const byEquipment = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const eqId = (row['equipmentId'] as string) || "unknown";
      if (!byEquipment.has(eqId)) {
        byEquipment.set(eqId, []);
      }
      byEquipment.get(eqId)!.push(row);
    }

    return [...byEquipment.entries()].map(([eqId, jobs]) => {
      jobs.sort((a, b) => {
        const da = a['completedAt'] ? new Date(a['completedAt'] as string).getTime() : 0;
        const dbTime = b['completedAt'] ? new Date(b['completedAt'] as string).getTime() : 0;
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
                `## ${job['woNumber']}: ${job['title']}`,
                `Type: ${job['maintenanceType'] || "N/A"} | Status: ${job['status'] || "N/A"}`,
                job['completedAt'] &&
                  `Completed: ${new Date(job['completedAt'] as string).toLocaleDateString()}`,
                job['actualHours'] && `Hours: ${job['actualHours']}`,
                job['notes'] && `Notes: ${job['notes']}`,
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

  private generateStoresDocs(
    rows: Record<string, unknown>[],
    vesselName: string
  ): Array<{ title: string; content: string; metadata: Record<string, unknown> }> {
    const byCategory = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const cat = (row['category'] as string) || "General";
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
            `- **${item['partNo']}**: ${item['name']}${
              item['manufacturer'] ? ` (${item['manufacturer']})` : ""
            }${item['criticality'] ? ` [${item['criticality']}]` : ""}`
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
