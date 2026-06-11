/**
 * Per-org manifest read/write/merge.
 *
 * One JSON object per org listing every Parquet export that exists for it,
 * so the data team can detect gaps without listing the bucket. The
 * manifest is kept in sort-order by `date` (descending) so the most recent
 * exports are easy to eyeball.
 */

import { objectStorageClient } from "../../replit_integrations/object_storage";
import { createLogger } from "../../lib/structured-logger";
import { resolveWarehouseStorageTarget, warehouseManifestKey } from "./storage-config";
import type { WarehouseExportEntry, WarehouseManifest } from "./types";

const logger = createLogger("TelemetryWarehouseExport:Manifest");

export async function loadManifest(orgId: string): Promise<WarehouseManifest> {
  const target = resolveWarehouseStorageTarget();
  const bucket = objectStorageClient.bucket(target.bucketName);
  const file = bucket.file(warehouseManifestKey(orgId));
  try {
    const [exists] = await file.exists();
    if (!exists) {
      return { orgId, updatedAt: new Date().toISOString(), exports: [] };
    }
    const [buf] = await file.download();
    const parsed = JSON.parse(buf.toString("utf-8")) as WarehouseManifest;
    if (parsed.orgId !== orgId) {
      logger.warn("Manifest orgId mismatch — replacing with fresh manifest", {
        orgId,
        found: parsed.orgId,
      });
      return { orgId, updatedAt: new Date().toISOString(), exports: [] };
    }
    return {
      orgId,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      exports: Array.isArray(parsed.exports) ? parsed.exports : [],
    };
  } catch (err) {
    logger.warn("Failed to load manifest — starting fresh", {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { orgId, updatedAt: new Date().toISOString(), exports: [] };
  }
}

export async function saveManifest(manifest: WarehouseManifest): Promise<void> {
  const target = resolveWarehouseStorageTarget();
  const bucket = objectStorageClient.bucket(target.bucketName);
  const file = bucket.file(warehouseManifestKey(manifest.orgId));
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  // file.save() options vary slightly across @google-cloud/storage versions;
  // cast to keep the call site compatible with the v7 typings in this repo.
  await file.save(body, {
    metadata: {
      contentType: "application/json",
      metadata: {
        orgId: manifest.orgId,
        entryCount: String(manifest.exports.length),
      },
    },
  } as object as Parameters<typeof file.save>[1]);
}

/**
 * Merge a fresh export entry into an existing manifest. Idempotent — if a
 * row for the same date already exists, it's replaced (re-runs of the same
 * day overwrite without duplicating the manifest entry).
 */
export function mergeEntry(
  manifest: WarehouseManifest,
  entry: WarehouseExportEntry
): WarehouseManifest {
  const others = manifest.exports.filter((e) => e.date !== entry.date);
  const next = [...others, entry].sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    orgId: manifest.orgId,
    updatedAt: new Date().toISOString(),
    exports: next,
  };
}

/** Remove manifest entries whose `date` is older than `cutoffDate` (inclusive). */
export function pruneEntries(
  manifest: WarehouseManifest,
  cutoffDate: string
): { manifest: WarehouseManifest; removed: WarehouseExportEntry[] } {
  const kept: WarehouseExportEntry[] = [];
  const removed: WarehouseExportEntry[] = [];
  for (const e of manifest.exports) {
    if (e.date < cutoffDate) {
      removed.push(e);
    } else {
      kept.push(e);
    }
  }
  return {
    manifest: {
      orgId: manifest.orgId,
      updatedAt: new Date().toISOString(),
      exports: kept,
    },
    removed,
  };
}
