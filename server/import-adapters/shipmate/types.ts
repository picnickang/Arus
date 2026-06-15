import type { ShipmateModuleType } from "./field-mapping";

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

export interface PendingEquipmentProjection {
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

export type ShipmateUpsertResult = "inserted" | "updated" | "skipped";

export interface ShipmateRagDocument {
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}
