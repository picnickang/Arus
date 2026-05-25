import { promises as fs, createWriteStream } from "fs";
import path from "path";
import os from "os";
import { createHash } from "crypto";
import { pipeline } from "stream/promises";
import { objectStorageClient } from "../../../../replit_integrations/object_storage";
import {
  ArtifactBackend,
  ArtifactRef,
  ArtifactStoragePort,
  formatArtifactUri,
  parseArtifactUri,
} from "./types";
import { createLogger } from "../../../../lib/structured-logger";

const logger = createLogger("ReplitObjectStorageArtifact");

/**
 * Replit App Storage adapter (GCS-backed).
 *
 * Uses the bucket configured via `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
 * and prefixes all keys under `PRIVATE_OBJECT_DIR` (parsed from
 * `/<bucket>/.private/...`). Artifacts are stored under
 * `<privatePrefix>/ml-artifacts/<key>` so they don't collide with
 * other app uploads.
 *
 * On read, downloads to a local cache directory and reuses the cached
 * copy for subsequent calls — onnxruntime + xgboost both expect a
 * local filesystem path, so we materialize once and let the OS page
 * cache do the rest.
 */
export class ReplitObjectStorageArtifactStorage implements ArtifactStoragePort {
  readonly backend: ArtifactBackend = "replit-object-storage";

  private readonly bucketName: string;
  private readonly privatePrefix: string;
  private readonly cacheDir: string;

  constructor(opts?: { cacheDir?: string }) {
    const privateDir = process.env['PRIVATE_OBJECT_DIR'];
    if (!privateDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR is not set — Replit App Storage not provisioned. " +
          "Run setup_object_storage or fall back to the local-disk adapter."
      );
    }
    // PRIVATE_OBJECT_DIR is "/<bucket-id>/.private" — split into
    // bucket and prefix.
    const trimmed = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
    const slash = trimmed.indexOf("/");
    if (slash === -1) {
      throw new Error(`Malformed PRIVATE_OBJECT_DIR: ${privateDir}`);
    }
    this.bucketName = trimmed.slice(0, slash);
    this.privatePrefix = trimmed.slice(slash + 1); // ".private"
    this.cacheDir = opts?.cacheDir ?? path.join(os.tmpdir(), "arus-ml-artifacts");
  }

  private objectName(key: string): string {
    return `${this.privatePrefix}/ml-artifacts/${key}`;
  }

  private cachePath(uri: string): string {
    // Cache by sha256 of URI so two backends can never collide.
    const h = createHash("sha256").update(uri).digest("hex").slice(0, 16);
    const base = path.basename(parseArtifactUri(uri).key);
    return path.join(this.cacheDir, `${h}-${base}`);
  }

  async put(localPath: string, key: string): Promise<ArtifactRef> {
    const bucket = objectStorageClient.bucket(this.bucketName);
    // The narrow upload({destination}) overload exposed by the v7
    // types in this project doesn't surface `resumable`, but the
    // small (<10MB typical) ONNX artifacts hit the single-shot path
    // by default — no special flag needed.
    await bucket.upload(localPath, {
      destination: this.objectName(key),
    });
    const size = (await fs.stat(localPath)).size;
    logger.info("Uploaded ML artifact to Replit App Storage", {
      key,
      bucket: this.bucketName,
      size,
    });
    return {
      uri: formatArtifactUri("replit-object-storage", key),
      backend: "replit-object-storage",
      key,
    };
  }

  async materializeToLocal(uri: string): Promise<string> {
    const ref = parseArtifactUri(uri);
    const cached = this.cachePath(uri);
    try {
      await fs.access(cached);
      return cached;
    } catch {
      // miss — download below
    }
    await fs.mkdir(path.dirname(cached), { recursive: true });
    const bucket = objectStorageClient.bucket(this.bucketName);
    const file = bucket.file(this.objectName(ref.key));
    // Download to a temp path then rename — avoids torn reads if a
    // concurrent inference materializes the same artifact mid-write.
    // Streaming pipeline (instead of file.download({destination}))
    // because the destination overload isn't surfaced in the v7 types
    // here.
    const tmp = `${cached}.${process.pid}.tmp`;
    await pipeline(file.createReadStream(), createWriteStream(tmp));
    await fs.rename(tmp, cached);
    logger.info("Materialized ML artifact from Replit App Storage", {
      key: ref.key,
      cached,
    });
    return cached;
  }

  async exists(uri: string): Promise<boolean> {
    try {
      const ref = parseArtifactUri(uri);
      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(this.objectName(ref.key));
      const [ok] = await file.exists();
      return ok;
    } catch (err) {
      logger.warn("Replit App Storage exists() failed — returning false", {
        uri,
        err: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }
}
