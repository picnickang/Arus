import { dbSystemAdminStorage } from "../../../../db/system-admin/index";
import { createLogger } from "../../../../lib/structured-logger";
import { LocalDiskArtifactStorage } from "./local-disk-adapter";

const logger = createLogger("ArtifactStorageFactory");
import { ReplitObjectStorageArtifactStorage } from "./replit-object-storage-adapter";
import { ArtifactBackend, ArtifactStoragePort, parseArtifactUri } from "./types";

/**
 * Admin-controlled artifact-storage selection.
 *
 *  - Persisted in `admin_system_settings` under
 *    (orgId=`system`, category=`ml-artifact-storage`, key=`backend`).
 *  - Default is `replit-object-storage` whenever the env vars
 *    indicate App Storage is provisioned; otherwise `local`.
 *  - The runtime resolver ALWAYS uses the backend baked into the
 *    URI it's reading, so flipping the setting only affects NEW
 *    writes — existing models keep resolving from wherever they
 *    were originally stored.
 */

const SETTING_ORG = "system";
const SETTING_CATEGORY = "ml-artifact-storage";
const SETTING_KEY = "backend";
const VALID: readonly ArtifactBackend[] = ["local", "replit-object-storage"] as const;

function defaultBackend(): ArtifactBackend {
  return process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID && process.env.PRIVATE_OBJECT_DIR
    ? "replit-object-storage"
    : "local";
}

let cachedWriteBackend: ArtifactBackend | null = null;
const adapterCache = new Map<ArtifactBackend, ArtifactStoragePort>();

function buildAdapter(backend: ArtifactBackend): ArtifactStoragePort {
  let a = adapterCache.get(backend);
  if (a) return a;
  if (backend === "replit-object-storage") {
    a = new ReplitObjectStorageArtifactStorage();
  } else {
    a = new LocalDiskArtifactStorage();
  }
  adapterCache.set(backend, a);
  return a;
}

/** Adapter selected for NEW artifact writes (admin setting). */
export async function getWriteAdapter(): Promise<ArtifactStoragePort> {
  if (cachedWriteBackend) return buildAdapter(cachedWriteBackend);
  try {
    const row = await dbSystemAdminStorage.getAdminSystemSetting(
      SETTING_ORG,
      SETTING_CATEGORY,
      SETTING_KEY,
    );
    const value = (row?.value as { backend?: string } | undefined)?.backend;
    if (value && (VALID as readonly string[]).includes(value)) {
      cachedWriteBackend = value as ArtifactBackend;
    } else {
      cachedWriteBackend = defaultBackend();
    }
  } catch (err) {
    logger.warn("ml-artifact-storage setting lookup failed — using default", {
      err: err instanceof Error ? err.message : String(err),
    });
    cachedWriteBackend = defaultBackend();
  }
  return buildAdapter(cachedWriteBackend);
}

/** Adapter that owns a specific URI (always matches the URI scheme). */
export function getReadAdapterForUri(uri: string): ArtifactStoragePort {
  const ref = parseArtifactUri(uri);
  return buildAdapter(ref.backend);
}

/** Admin write — persists the chosen backend and invalidates cache. */
export async function setArtifactBackendSetting(backend: ArtifactBackend): Promise<void> {
  if (!(VALID as readonly string[]).includes(backend)) {
    throw new Error(`Invalid backend: ${backend}`);
  }
  const existing = await dbSystemAdminStorage.getAdminSystemSetting(
    SETTING_ORG,
    SETTING_CATEGORY,
    SETTING_KEY,
  );
  if (existing) {
    await dbSystemAdminStorage.updateAdminSystemSetting(existing.id, {
      value: { backend },
    });
  } else {
    await dbSystemAdminStorage.createAdminSystemSetting({
      orgId: SETTING_ORG,
      category: SETTING_CATEGORY,
      key: SETTING_KEY,
      value: { backend },
      description: "Backend used for storing trained ML model artifacts",
    });
  }
  cachedWriteBackend = backend;
}

export async function getArtifactBackendSetting(): Promise<{
  backend: ArtifactBackend;
  source: "admin-setting" | "default";
  available: ArtifactBackend[];
}> {
  try {
    const row = await dbSystemAdminStorage.getAdminSystemSetting(
      SETTING_ORG,
      SETTING_CATEGORY,
      SETTING_KEY,
    );
    const value = (row?.value as { backend?: string } | undefined)?.backend;
    if (value && (VALID as readonly string[]).includes(value)) {
      return {
        backend: value as ArtifactBackend,
        source: "admin-setting",
        available: [...VALID],
      };
    }
  } catch {
    // fall through to default
  }
  return { backend: defaultBackend(), source: "default", available: [...VALID] };
}

/** Test-only — drops the in-process write cache so tests can flip setting. */
export function _resetArtifactStorageCacheForTest(): void {
  cachedWriteBackend = null;
  adapterCache.clear();
}
