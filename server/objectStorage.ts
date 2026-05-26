// CRITICAL FIX: Lazy import @google-cloud/storage to prevent module-load crashes in non-Replit environments
// The @google-cloud/storage package has native dependencies that fail in some Docker environments
// By using dynamic imports, we only load it when actually needed (Replit environment only)
import { Response } from "express";
import { randomUUID } from "node:crypto";
import { createLogger } from "./lib/structured-logger";
const logger = createLogger("ObjectStorage");
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Type imports (these don't execute code at module level)
type Storage = import("@google-cloud/storage").Storage;
type File = import("@google-cloud/storage").File;

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.1:1106";

// Environment detection
function isReplitEnvironment(): boolean {
  return !!(process.env['REPL_ID'] || process.env['REPL_SLUG'] || process.env['REPLIT_DB_URL']);
}

// Lazy-initialized storage client
let _objectStorageClient: Storage | null = null;
let _clientInitAttempted = false;
let _clientInitError: Error | null = null;

async function getObjectStorageClient(): Promise<Storage | null> {
  if (_clientInitAttempted) {
    return _objectStorageClient;
  }

  _clientInitAttempted = true;

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
      logger.info("ℹ Object storage not initialized (non-Replit environment). GCS features disabled.");
    }
  } catch (error) {
    _clientInitError = error as Error;
    logger.warn("⚠ Failed to initialize object storage client:", { details: error });
  }

  return _objectStorageClient;
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

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env['PUBLIC_OBJECT_SEARCH_PATHS'] || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      logger.warn("PUBLIC_OBJECT_SEARCH_PATHS not set. Object storage features may be limited.");
      return [];
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env['PRIVATE_OBJECT_DIR'] || "";
    if (!dir) {
      logger.warn("PRIVATE_OBJECT_DIR not set. Private object storage features may be limited.");
      return "";
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    const client = await getObjectStorageClient();
    if (!client) {
      logger.warn("Object storage client not available. Cannot search for public objects.");
      return null;
    }

    // S5443: Block path traversal attempts
    if (filePath.includes("..") || filePath.includes("\0")) {
      logger.warn(`[ObjectStorage] Blocked path traversal attempt: ${filePath}`);
      return null;
    }

    const searchPaths = this.getPublicObjectSearchPaths();
    if (searchPaths.length === 0) {
      return null;
    }

    for (const searchPath of searchPaths) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = client.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  //
  // LR-3.5 / OBJ-2 + TEN-5: the previous implementation set
  // `Content-Type` straight from the stored metadata that the
  // uploader controlled, with no `X-Content-Type-Options` header.
  // An attacker who uploaded HTML/SVG/JS labelled as `image/jpeg`
  // could serve it back from this origin and execute script in
  // the dashboard's session. Defences added here:
  //   1. Always emit `X-Content-Type-Options: nosniff` so browsers
  //      respect the served Content-Type.
  //   2. Read the first 512 bytes and magic-byte-sniff the family.
  //      If the claimed type and the sniffed type disagree, force
  //      `application/octet-stream` + `Content-Disposition: attachment`
  //      so the browser downloads rather than executing inline.
  //   3. Treat unknown / explicitly hostile MIME families (html, svg,
  //      javascript, xml) as attachments unconditionally.
  //   4. `orgId` (optional) is logged for audit so we have a paper
  //      trail of who downloaded what. The structural ownership
  //      check (is this object actually in this org's namespace?) is
  //      enforced at the route layer; downloadObject is a leaf-level
  //      streamer and cannot reconstruct the path-to-org mapping on
  //      its own.
  async downloadObject(
    file: File,
    res: Response,
    cacheTtlSec: number = 3600,
    auditCtx?: { orgId?: string; userId?: string },
  ) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";

      const claimed = (metadata.contentType || "application/octet-stream").toLowerCase();

      // Pull a small head buffer for magic-byte sniffing. The GCS
      // type definitions bundled with this project don't expose the
      // `createReadStream(options?)` overload, but the runtime fully
      // supports it. We narrow through a local structural type so we
      // don't reach for `any`.
      let head: Buffer = Buffer.alloc(0);
      try {
        type RangedRead = {
          createReadStream: (opts?: { start?: number; end?: number }) => NodeJS.ReadableStream;
        };
        const sniff = (file as unknown as RangedRead).createReadStream({ start: 0, end: 511 });
        const chunks: Buffer[] = [];
        for await (const c of sniff as AsyncIterable<Buffer>) {
          chunks.push(c);
        }
        head = Buffer.concat(chunks);
      } catch (sniffErr) {
        logger.warn("Magic-byte sniff failed; defaulting to attachment", { details: sniffErr });
      }

      const sniffed = sniffMimeFamily(head);
      const { safeContentType, forceAttachment } = pickSafeContentType(claimed, sniffed);

      if (auditCtx?.orgId) {
        logger.info("Object download", {
          orgId: auditCtx.orgId,
          userId: auditCtx.userId,
          claimed,
          sniffed,
          served: safeContentType,
          forceAttachment,
          bytes: metadata.size,
        });
      }

      const headers: Record<string, string | number | undefined> = {
        "Content-Type": safeContentType,
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
        "X-Content-Type-Options": "nosniff",
      };
      if (forceAttachment) {
        headers["Content-Disposition"] = "attachment";
      }
      res.set(headers as Record<string, string>);

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err: Error) => {
        logger.error("Stream error:", undefined, err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      logger.error("Error downloading file:", undefined, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not configured. Please set up object storage in the Replit environment."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    const client = await getObjectStorageClient();
    if (!client) {
      throw new Error("Object storage not available in this environment");
    }

    // S5443: Block path traversal attempts
    if (objectPath.includes("..") || objectPath.includes("\0")) {
      throw new ObjectNotFoundError();
    }

    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir) {
      throw new ObjectNotFoundError();
    }

    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = client.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir) {
      return rawObjectPath;
    }
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (normalizedPath.startsWith("/")) {
      const objectFile = await this.getObjectEntityFile(normalizedPath);
      await setObjectAclPolicy(objectFile, aclPolicy);
    }
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      file: objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    } as never);
  }

  // Check if object storage is properly configured
  async isConfigured(): Promise<boolean> {
    const client = await getObjectStorageClient();
    return !!(client && (process.env['PUBLIC_OBJECT_SEARCH_PATHS'] || process.env['PRIVATE_OBJECT_DIR']));
  }

  // Check if running in Replit environment
  isReplitEnvironment(): boolean {
    return isReplitEnvironment();
  }
}

/**
 * LR-3.5 / OBJ-2: extremely small magic-byte sniffer covering the
 * file families this app stores (images, audio/video, PDFs, GLB, ZIP,
 * Office). Returns a coarse "family" string used by
 * `pickSafeContentType` to decide whether to honour the claimed
 * Content-Type or force a safe one. Kept inline (no new dep) — we
 * only need to distinguish safe families from "everything else".
 */
export function sniffMimeFamily(head: Buffer): string {
  if (head.length === 0) return "unknown";
  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  // PNG
  if (
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) return "image/png";
  // GIF
  if (head.slice(0, 6).toString("ascii") === "GIF87a" || head.slice(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  // WebP (RIFF....WEBP)
  if (head.slice(0, 4).toString("ascii") === "RIFF" && head.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  // PDF
  if (head.slice(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  // GLB (glTF binary)
  if (head.slice(0, 4).toString("ascii") === "glTF") return "model/gltf-binary";
  // ZIP family (covers .zip, .docx, .xlsx, .pptx)
  if (head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)) return "application/zip";
  // MP4 (ftyp box at offset 4)
  if (head.slice(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  // OGG
  if (head.slice(0, 4).toString("ascii") === "OggS") return "audio/ogg";
  // MP3 (ID3 or sync frame)
  if (head.slice(0, 3).toString("ascii") === "ID3") return "audio/mpeg";
  if (head[0] === 0xff && (head[1] !== undefined && (head[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  // Text-looking head (HTML/SVG/XML/JSON/plain) — return generic
  // "text" so pickSafeContentType can force attachment defensively.
  const printable = head.slice(0, 64).every((b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e));
  if (printable) return "text";
  return "unknown";
}

const SAFE_MIME_FAMILIES: ReadonlyArray<{ prefix: string; sniffed: ReadonlyArray<string> }> = [
  { prefix: "image/jpeg", sniffed: ["image/jpeg"] },
  { prefix: "image/png", sniffed: ["image/png"] },
  { prefix: "image/gif", sniffed: ["image/gif"] },
  { prefix: "image/webp", sniffed: ["image/webp"] },
  { prefix: "application/pdf", sniffed: ["application/pdf"] },
  { prefix: "model/gltf-binary", sniffed: ["model/gltf-binary"] },
  { prefix: "video/mp4", sniffed: ["video/mp4"] },
  { prefix: "audio/mpeg", sniffed: ["audio/mpeg"] },
  { prefix: "audio/ogg", sniffed: ["audio/ogg"] },
  // ZIP-family (.docx, .xlsx, .pptx) — all sniff as application/zip.
  { prefix: "application/zip", sniffed: ["application/zip"] },
  {
    prefix: "application/vnd.openxmlformats-officedocument.",
    sniffed: ["application/zip"],
  },
  { prefix: "application/vnd.ms-", sniffed: ["application/zip"] },
];

export function pickSafeContentType(
  claimed: string,
  sniffed: string,
): { safeContentType: string; forceAttachment: boolean } {
  const lower = claimed.toLowerCase();
  // Hostile families: never honour them, always force attachment.
  if (
    lower.startsWith("text/html") ||
    lower.startsWith("image/svg") ||
    lower.startsWith("application/xhtml") ||
    lower.startsWith("application/javascript") ||
    lower.startsWith("text/javascript") ||
    lower.startsWith("application/xml") ||
    lower.startsWith("text/xml")
  ) {
    return { safeContentType: "application/octet-stream", forceAttachment: true };
  }

  for (const entry of SAFE_MIME_FAMILIES) {
    if (lower.startsWith(entry.prefix) && entry.sniffed.includes(sniffed)) {
      return { safeContentType: claimed, forceAttachment: false };
    }
  }

  // Claimed type is not in the safe-list, or the sniff disagrees.
  // Serve as an opaque attachment.
  return { safeContentType: "application/octet-stream", forceAttachment: true };
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1] ?? '';
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  if (!isReplitEnvironment()) {
    throw new Error(
      "Object URL signing requires Replit environment. " +
        "This feature is not available when running outside Replit."
    );
  }

  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };

  try {
    const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to sign object URL, errorcode: ${response.status}, ` +
          `make sure you're running on Replit and object storage is configured`
      );
    }

    const { signed_url: signedURL } = await response.json();
    return signedURL;
  } catch (error) {
    throw new Error(
      `Object URL signing failed: ${error}. ` +
        `This feature requires Replit environment with sidecar access.`
    );
  }
}
