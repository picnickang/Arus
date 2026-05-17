// @ts-nocheck
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
  return !!(process.env.REPL_ID || process.env.REPL_SLUG || process.env.REPLIT_DB_URL);
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
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
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
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
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
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });

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
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  // Check if object storage is properly configured
  async isConfigured(): Promise<boolean> {
    const client = await getObjectStorageClient();
    return !!(client && (process.env.PUBLIC_OBJECT_SEARCH_PATHS || process.env.PRIVATE_OBJECT_DIR));
  }

  // Check if running in Replit environment
  isReplitEnvironment(): boolean {
    return isReplitEnvironment();
  }
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

  const bucketName = pathParts[1];
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
