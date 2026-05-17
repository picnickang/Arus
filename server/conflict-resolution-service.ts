/**
 * Legacy conflict-resolution service shim.
 */

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflicts: ConflictRecord[];
}

export interface ConflictRecord {
  conflictId: string;
  table: string;
  recordId: string;
  field: string;
  serverValue: unknown;
  clientValue: unknown;
  detectedAt: Date;
}

export async function detectConflicts(
  _table: string,
  _recordId: string,
  _data: unknown,
  _version: number,
  _timestamp: Date
): Promise<ConflictDetectionResult> {
  return { hasConflict: false, conflicts: [] };
}

export async function logConflict(_conflict: ConflictRecord): Promise<void> {
  // no-op
}

export async function getPendingConflicts(
  _orgId: string
): Promise<ConflictRecord[]> {
  return [];
}

export async function manuallyResolveConflict(
  _conflictId: string,
  _resolvedValue: unknown,
  _resolvedBy: string
): Promise<void> {
  // no-op
}
