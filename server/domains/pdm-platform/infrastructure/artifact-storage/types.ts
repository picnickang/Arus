/**
 * Artifact Storage Port (#108 prod-hardening)
 * ============================================
 *
 * Pluggable storage abstraction for trained ML model artifacts
 * (ONNX serving + native UBJ for TreeSHAP). The default deployment
 * uses Replit App Storage (GCS-backed) so artifacts survive across
 * scaled instances; legacy single-instance deployments can keep
 * "local" disk mode. An S3 adapter slot is reserved for bring-your-
 * own buckets without further refactor.
 *
 * URI scheme: `arus-artifact://<backend>/<key>`
 *   - `arus-artifact://local/models/bearing-<modelId>.onnx`
 *     → resolves to a local filesystem path under MODELS_DIR
 *   - `arus-artifact://replit-object-storage/models/bearing-<modelId>.onnx`
 *     → resolves to the bucket+key inside Replit App Storage
 *
 * Backward compatibility: paths that don't match the scheme (e.g.
 * raw `models/bearing-xxx.onnx` written by the legacy trainer) are
 * treated as `arus-artifact://local/<path>` so existing rows keep
 * resolving without a migration.
 */

export type ArtifactBackend = "local" | "replit-object-storage";

export const ARTIFACT_URI_SCHEME = "arus-artifact://";

export interface ArtifactRef {
  /** Canonical `arus-artifact://...` URI persisted in ml_models. */
  uri: string;
  /** Backend that produced the URI. */
  backend: ArtifactBackend;
  /** Backend-relative key (e.g. `models/bearing-<id>.onnx`). */
  key: string;
}

export interface ArtifactStoragePort {
  readonly backend: ArtifactBackend;

  /**
   * Upload a locally-staged file to the backend. Returns a canonical
   * `arus-artifact://` URI to persist in ml_models.training_metrics.
   *
   * `key` is the logical path inside the backend, e.g.
   * `models/bearing-<modelId>.onnx`. Implementations are responsible
   * for any backend-specific prefixing.
   */
  put(localPath: string, key: string): Promise<ArtifactRef>;

  /**
   * Materialize an artifact to a local filesystem path so existing
   * ONNX/UBJ readers (`onnxruntime-node`, `xgboost.Booster`, the
   * Python tree_shap sidecar) can mmap it without changes.
   *
   * Implementations MUST cache to avoid re-downloading on every
   * inference. Returns the local path of the materialized artifact.
   */
  materializeToLocal(uri: string): Promise<string>;

  /** Best-effort existence check; never throws on transient errors. */
  exists(uri: string): Promise<boolean>;
}

/** Parse an `arus-artifact://backend/key` URI. */
export function parseArtifactUri(uri: string): ArtifactRef {
  if (!uri.startsWith(ARTIFACT_URI_SCHEME)) {
    // Backward-compat: legacy local-path values map to local backend.
    return { uri: `${ARTIFACT_URI_SCHEME}local/${uri}`, backend: "local", key: uri };
  }
  const rest = uri.slice(ARTIFACT_URI_SCHEME.length);
  const slash = rest.indexOf("/");
  if (slash === -1) {
    throw new Error(`Invalid artifact URI (no key): ${uri}`);
  }
  const backend = rest.slice(0, slash) as ArtifactBackend;
  const key = rest.slice(slash + 1);
  if (backend !== "local" && backend !== "replit-object-storage") {
    throw new Error(`Unknown artifact backend: ${backend}`);
  }
  return { uri, backend, key };
}

export function formatArtifactUri(backend: ArtifactBackend, key: string): string {
  return `${ARTIFACT_URI_SCHEME}${backend}/${key}`;
}
