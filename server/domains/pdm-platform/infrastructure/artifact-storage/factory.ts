import { createLogger } from "../../../../lib/structured-logger";
import { LocalDiskArtifactStorage } from "./local-disk-adapter";

const logger = createLogger("ArtifactStorageFactory");
import { ReplitObjectStorageArtifactStorage } from "./replit-object-storage-adapter";
import { ArtifactBackend, ArtifactStoragePort, parseArtifactUri } from "./types";

/**
 * Admin-controlled artifact-storage selection.
 *
 *  - Persisted by the system-admin domain (the factory is decoupled
 *    via the injected `ArtifactBackendSettingPort` — see
 *    `configureArtifactBackendSettingPort`). Concretely, today, the
 *    port reads/writes `admin_system_settings`
 *    (orgId=`system`, category=`ml-artifact-storage`, key=`backend`).
 *  - Default is `replit-object-storage` whenever the env vars
 *    indicate App Storage is provisioned; otherwise `local`.
 *  - The runtime resolver ALWAYS uses the backend baked into the
 *    URI it's reading, so flipping the setting only affects NEW
 *    writes — existing models keep resolving from wherever they
 *    were originally stored.
 */

/**
 * Port for persisting the admin-selected write backend. The factory
 * lives in pdm-platform but the setting is owned by system-admin —
 * the port inverts the dependency so this module does not import
 * any system-admin internals (enforced by `check:domain-leaks`).
 */
export interface ArtifactBackendSettingPort {
  read(): Promise<ArtifactBackend | null>;
  write(backend: ArtifactBackend): Promise<void>;
}

let settingPort: ArtifactBackendSettingPort | null = null;

/**
 * Wire the persistence port. Called once at boot by system-admin's
 * composition layer (`server/domains/system-admin/routes/settings-routes.ts`).
 * Until configured, the factory falls back to env-derived defaults
 * and `setArtifactBackendSetting` throws.
 */
export function configureArtifactBackendSettingPort(port: ArtifactBackendSettingPort): void {
  settingPort = port;
  // Drop the cached default so a late port configuration is not
  // shadowed by an earlier `getWriteAdapter()` call that warmed the
  // cache with the env-derived default.
  cachedWriteBackend = null;
}

const VALID: readonly ArtifactBackend[] = ["local", "replit-object-storage"] as const;

function defaultBackend(): ArtifactBackend {
  return process.env['DEFAULT_OBJECT_STORAGE_BUCKET_ID'] && process.env['PRIVATE_OBJECT_DIR']
    ? "replit-object-storage"
    : "local";
}

let cachedWriteBackend: ArtifactBackend | null = null;
const adapterCache = new Map<ArtifactBackend, ArtifactStoragePort>();

function buildAdapter(backend: ArtifactBackend): ArtifactStoragePort {
  let a = adapterCache.get(backend);
  if (a) {return a;}
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
  if (cachedWriteBackend) {return buildAdapter(cachedWriteBackend);}
  if (!settingPort) {
    cachedWriteBackend = defaultBackend();
    return buildAdapter(cachedWriteBackend);
  }
  try {
    const value = await settingPort.read();
    cachedWriteBackend = value ?? defaultBackend();
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
  if (!settingPort) {
    throw new Error(
      "ArtifactBackendSettingPort not configured — call configureArtifactBackendSettingPort at boot",
    );
  }
  await settingPort.write(backend);
  cachedWriteBackend = backend;
}

export async function getArtifactBackendSetting(): Promise<{
  backend: ArtifactBackend;
  source: "admin-setting" | "default";
  available: ArtifactBackend[];
}> {
  if (settingPort) {
    try {
      const value = await settingPort.read();
      if (value) {
        return { backend: value, source: "admin-setting", available: [...VALID] };
      }
    } catch {
      // fall through to default
    }
  }
  return { backend: defaultBackend(), source: "default", available: [...VALID] };
}

/** Test-only — drop the port so the next configure call wins fresh. */
export function _resetArtifactBackendSettingPortForTest(): void {
  settingPort = null;
}

/** Test-only — drops the in-process write cache so tests can flip setting. */
export function _resetArtifactStorageCacheForTest(): void {
  cachedWriteBackend = null;
  adapterCache.clear();
}
