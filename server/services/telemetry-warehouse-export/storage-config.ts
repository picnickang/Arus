/**
 * Object-storage configuration for the telemetry warehouse export.
 *
 * Parses the Replit App Storage env vars once and exposes a typed target
 * (bucket name + key prefix) plus a key builder so every caller produces
 * exactly the same partition layout.
 */

const WAREHOUSE_SUBDIR = "telemetry-warehouse";

export interface WarehouseStorageTarget {
  bucketName: string;
  /** Prefix inside the bucket, e.g. `.private/telemetry-warehouse`. No trailing slash. */
  warehousePrefix: string;
}

/**
 * Resolve `PRIVATE_OBJECT_DIR` (format `/<bucket>/<prefix...>`) into a
 * bucket name and warehouse prefix. Throws if the env var is unset or
 * malformed — the job processor catches and logs.
 */
export function resolveWarehouseStorageTarget(): WarehouseStorageTarget {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"];
  if (!privateDir) {
    throw new Error(
      "PRIVATE_OBJECT_DIR is not set — Replit App Storage not provisioned. " +
        "Telemetry warehouse export requires object storage."
    );
  }
  const trimmed = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    throw new Error(`Malformed PRIVATE_OBJECT_DIR: ${privateDir}`);
  }
  const bucketName = trimmed.slice(0, slash);
  const privatePrefix = trimmed.slice(slash + 1).replace(/\/+$/, "");
  return {
    bucketName,
    warehousePrefix: `${privatePrefix}/${WAREHOUSE_SUBDIR}`,
  };
}

/** Object key for the Parquet file for an `(orgId, dateStr)` partition. */
export function warehouseObjectKey(orgId: string, dateStr: string): string {
  const { warehousePrefix } = resolveWarehouseStorageTarget();
  return `${warehousePrefix}/orgId=${encodeURIComponent(orgId)}/date=${dateStr}/part-0001.parquet`;
}

/** Prefix that holds every export for one org. */
export function warehouseOrgPrefix(orgId: string): string {
  const { warehousePrefix } = resolveWarehouseStorageTarget();
  return `${warehousePrefix}/orgId=${encodeURIComponent(orgId)}/`;
}

/** Manifest key for one org. */
export function warehouseManifestKey(orgId: string): string {
  return `${warehouseOrgPrefix(orgId)}_manifest.json`;
}
