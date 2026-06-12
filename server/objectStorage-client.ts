// CRITICAL FIX: Lazy import @google-cloud/storage to prevent module-load crashes in non-Replit environments
// The @google-cloud/storage package has native dependencies that fail in some Docker environments
// By using dynamic imports, we only load it when actually needed (Replit environment only)
import { createLogger } from "./lib/structured-logger";

const logger = createLogger("ObjectStorage");

// Type imports (these don't execute code at module level)
type Storage = import("@google-cloud/storage").Storage;

export const REPLIT_SIDECAR_ENDPOINT = "http://127.0.1:1106";

// Environment detection
export function isReplitEnvironment(): boolean {
  return !!(process.env["REPL_ID"] || process.env["REPL_SLUG"] || process.env["REPLIT_DB_URL"]);
}

// Lazy-initialized storage client.
//
// We memoize the in-flight initialization *promise* (not just a "started"
// boolean) so concurrent callers await the same async import. The earlier
// boolean guard set `_clientInitAttempted = true` synchronously before the
// `await import(...)` resolved, so a second request arriving during that
// window got a still-null client back and failed with "Object storage not
// available" - even though the client finished initializing milliseconds
// later. Sharing the promise removes that race.
let _objectStorageClient: Storage | null = null;
let _clientInitPromise: Promise<Storage | null> | null = null;
let _clientInitError: Error | null = null;

// Exported for regression testing of the promise-memoized init race
// (concurrent callers must share one in-flight init, never get a transient
// null client). Production callers go through the ObjectStorageService methods.
export async function getObjectStorageClient(): Promise<Storage | null> {
  if (_clientInitPromise) {
    return _clientInitPromise;
  }

  _clientInitPromise = (async () => {
    try {
      // Only initialize GCS client in Replit environment
      if (isReplitEnvironment()) {
        // LAZY IMPORT: Only load @google-cloud/storage when in Replit environment
        const { Storage } = await import("@google-cloud/storage");

        _objectStorageClient = new Storage({
          credentials: {
            audience: "replit",
            subject_token_type: "access_token",
            token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
            type: "external_account",
            credential_source: {
              url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
              format: {
                type: "json",
                subject_token_field_name: "access_token",
              },
            },
            universe_domain: "googleapis.com",
          },
          projectId: "",
        });
        logger.info("✓ Object storage client initialized (Replit environment)");
      } else {
        logger.info(
          "ℹ Object storage not initialized (non-Replit environment). GCS features disabled."
        );
      }
    } catch (error) {
      _clientInitError = error as Error;
      logger.warn("⚠ Failed to initialize object storage client:", { details: error });
    }

    return _objectStorageClient;
  })();

  return _clientInitPromise;
}

// Initialize client on first import (but now it's async and safe)
// S7785: Wrapped in async IIFE to avoid top-level await in non-module context
(async () => {
  if (isReplitEnvironment()) {
    try {
      await getObjectStorageClient();
    } catch (err) {
      logger.warn("⚠ Background object storage initialization failed:", { details: err });
    }
  }
})();
