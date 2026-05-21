/**
 * Recent warehouse export job runs.
 *
 * The most recent ~14 run summaries are kept in an in-process ring buffer
 * (cheap reads for the admin status endpoint) and mirrored to a single
 * JSON object next to the per-org manifests:
 *
 *   <warehousePrefix>/_recent-runs.json
 *
 * On the first read after process start we lazily hydrate the ring buffer
 * from that object, so a deploy or container restart no longer wipes the
 * "Recent runs" history that admins use to investigate yesterday's
 * success/failure counts. The per-org `_manifest.json` files remain the
 * authoritative durable record of which Parquet partitions exist — this
 * file is purely an operator-glance run log.
 *
 * Persistence is best-effort: if object storage isn't available (e.g. the
 * env var isn't set in a dev shell) the ring buffer still works in memory.
 */

import { objectStorageClient } from "../../replit_integrations/object_storage";
import { createLogger } from "../../lib/structured-logger";
import { resolveWarehouseStorageTarget } from "./storage-config";
import type { WarehouseExportJobSummary } from "./types";

const logger = createLogger("TelemetryWarehouseExport:LastRun");

const CAPACITY = 14;
const RECENT_RUNS_OBJECT = "_recent-runs.json";

interface PersistedRecentRuns {
  updatedAt: string;
  runs: WarehouseExportJobSummary[];
}

const recent: WarehouseExportJobSummary[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

function recentRunsKey(): string {
  const { warehousePrefix } = resolveWarehouseStorageTarget();
  return `${warehousePrefix}/${RECENT_RUNS_OBJECT}`;
}

async function loadPersisted(): Promise<WarehouseExportJobSummary[]> {
  const target = resolveWarehouseStorageTarget();
  const bucket = objectStorageClient.bucket(target.bucketName);
  const file = bucket.file(recentRunsKey());
  const [exists] = await file.exists();
  if (!exists) return [];
  const [buf] = await file.download();
  const parsed = JSON.parse(buf.toString("utf-8")) as Partial<PersistedRecentRuns>;
  if (!parsed || !Array.isArray(parsed.runs)) return [];
  return parsed.runs.slice(-CAPACITY);
}

async function savePersisted(runs: WarehouseExportJobSummary[]): Promise<void> {
  const target = resolveWarehouseStorageTarget();
  const bucket = objectStorageClient.bucket(target.bucketName);
  const file = bucket.file(recentRunsKey());
  const body: PersistedRecentRuns = {
    updatedAt: new Date().toISOString(),
    runs: runs.slice(-CAPACITY),
  };
  await file.save(`${JSON.stringify(body, null, 2)}\n`, {
    metadata: {
      contentType: "application/json",
      metadata: {
        entryCount: String(body.runs.length),
      },
    },
  } as unknown as Parameters<typeof file.save>[1]);
}

async function ensureHydrated(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const loaded = await loadPersisted();
        // Merge: keep anything already recorded this process, prepend persisted
        // history that's not already present. Dedupe on (date + durationMs +
        // orgsTotal) which is a stable identity for a single run.
        const seen = new Set(
          recent.map((r) => `${r.date}|${r.durationMs}|${r.orgsTotal}`),
        );
        const merged: WarehouseExportJobSummary[] = [];
        for (const r of loaded) {
          const key = `${r.date}|${r.durationMs}|${r.orgsTotal}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(r);
          }
        }
        merged.push(...recent);
        const trimmed = merged.slice(-CAPACITY);
        recent.length = 0;
        recent.push(...trimmed);
      } catch (err) {
        logger.warn("Failed to hydrate recent runs from object storage", {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        hydrated = true;
      }
    })();
  }
  await hydratePromise;
}

export async function recordRun(summary: WarehouseExportJobSummary): Promise<void> {
  await ensureHydrated();
  recent.push(summary);
  if (recent.length > CAPACITY) {
    recent.splice(0, recent.length - CAPACITY);
  }
  try {
    await savePersisted(recent);
  } catch (err) {
    logger.warn("Failed to persist recent runs to object storage", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getRecentRuns(
  limit = CAPACITY,
): Promise<WarehouseExportJobSummary[]> {
  await ensureHydrated();
  if (recent.length === 0) return [];
  const n = Math.max(1, Math.min(limit, recent.length));
  return recent.slice(-n).reverse();
}

/** Test-only: clear in-memory state and force re-hydration on next call. */
export function __resetRecentRunsForTests(): void {
  recent.length = 0;
  hydrated = false;
  hydratePromise = null;
}
