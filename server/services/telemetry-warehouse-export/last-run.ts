/**
 * In-memory ring buffer of the most recent warehouse export job runs.
 * Used by the admin status endpoint — survives until process restart,
 * which is fine for an operator-glance view (the manifest in object
 * storage is the durable record).
 */

import type { WarehouseExportJobSummary } from "./types";

const CAPACITY = 14;
const recent: WarehouseExportJobSummary[] = [];

export function recordRun(summary: WarehouseExportJobSummary): void {
  recent.push(summary);
  if (recent.length > CAPACITY) {
    recent.splice(0, recent.length - CAPACITY);
  }
}

export function getRecentRuns(limit = CAPACITY): WarehouseExportJobSummary[] {
  const n = Math.max(1, Math.min(limit, recent.length));
  return recent.slice(-n).reverse();
}
