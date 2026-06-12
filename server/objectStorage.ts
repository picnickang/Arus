import { Response } from "express";
import { randomUUID } from "node:crypto";
import { createLogger } from "./lib/structured-logger";
import { getObjectStorageClient, isReplitEnvironment } from "./objectStorage-client";
import { pickSafeContentType, sniffMimeFamily } from "./objectStorage-content-type";
import { parseObjectPath, signObjectURL } from "./objectStorage-paths";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const logger = createLogger("ObjectStorage");

// Type imports (these don't execute code at module level)
type File = import("@google-cloud/storage").File;

export { getObjectStorageClient } from "./objectStorage-client";
export { pickSafeContentType, sniffMimeFamily } from "./objectStorage-content-type";

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
    const pathsStr = process.env["PUBLIC_OBJECT_SEARCH_PATHS"] || "";
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
    const dir = process.env["PRIVATE_OBJECT_DIR"] || "";
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
  //   4. `auditCtx.orgId` is REQUIRED for fail-closed cross-org
  //      enforcement. When provided, `assertObjectOwnedByOrg` runs
  //      INSIDE `downloadObject` and writes a 403 directly if the
  //      caller's org doesn't own the object — so the guarantee no
  //      longer depends on every route layer remembering to call the
  //      helper. The route layer may still call `assertObjectOwnedByOrg`
  //      earlier (e.g. to avoid touching GCS at all on a mismatch), but
  //      `downloadObject` is now the fail-closed perimeter. Callers
  //      that omit `auditCtx.orgId` fall through with a warning so
  //      legacy paths keep working but are observable.
  async downloadObject(
    file: File,
    res: Response,
    cacheTtlSec: number = 3600,
    auditCtx?: { orgId?: string | undefined; userId?: string | undefined }
  ) {
    try {
      // LR-3.5 / TEN-5: fail-closed ownership check at the leaf.
      if (auditCtx?.orgId) {
        const ownership = this.assertObjectOwnedByOrg(file, auditCtx.orgId);
        if (!ownership.allowed) {
          if (!res.headersSent) {
            res.status(403).json({
              message: "Object belongs to a different organization",
              code: "OBJECT_CROSS_ORG_FORBIDDEN",
            });
          }
          return;
        }
      } else {
        logger.warn(
          "downloadObject called without auditCtx.orgId — fail-closed ownership check skipped",
          {
            objectName: file.name,
          }
        );
      }

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
  //
  // LR-3.5 / TEN-5: an `orgId` argument now seeds the storage path
  // (`uploads/orgs/<orgId>/<uuid>`), so the object's owning tenant is
  // structurally encoded in the path. `assertObjectOwnedByOrg` reads
  // this segment on download and rejects mismatches with 403. Callers
  // that omit `orgId` still get the legacy `uploads/<uuid>` layout
  // for backward compatibility; those objects are treated as legacy
  // (no enforced ownership) by the download check. NEW upload code
  // paths MUST pass orgId.
  async getObjectEntityUploadURL(orgId?: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not configured. Please set up object storage in the Replit environment."
      );
    }

    const objectId = randomUUID();
    const orgSegment = orgId && /^[A-Za-z0-9_\-]+$/.test(orgId) ? `orgs/${orgId}/` : "";
    const fullPath = `${privateObjectDir}/uploads/${orgSegment}${objectId}`;

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

  // LR-3.5 / TEN-5: structural object-to-org ownership check.
  //
  // The new upload layout is `${privateObjectDir}/uploads/orgs/<orgId>/<uuid>`.
  // This helper parses the file's full GCS path (`bucket/object`) and:
  //   - if the path matches the `orgs/<id>/` segment AND `<id>` does
  //     not equal `callerOrgId`, returns `{ allowed: false, ownerOrgId }`
  //     so the route handler can answer 403,
  //   - if the path is the legacy `uploads/<uuid>` layout (no
  //     `orgs/` segment), returns `{ allowed: true, ownerOrgId: null,
  //     legacy: true }` and emits a single redacted audit log line so
  //     ops can quantify how much legacy data is still in circulation,
  //   - otherwise returns `{ allowed: true }`.
  //
  // This is a path-only check (no DB lookup) so it is cheap, has no
  // failure mode beyond "could not parse path", and is impossible to
  // bypass without also bypassing the upload signer.
  assertObjectOwnedByOrg(
    file: File,
    callerOrgId: string
  ): { allowed: boolean; ownerOrgId: string | null; legacy: boolean } {
    // file.name is the object-within-bucket path. With our upload
    // layout it includes the `uploads/orgs/<id>/<uuid>` suffix.
    const objectName = file.name ?? "";
    const match = objectName.match(/(?:^|\/)uploads\/orgs\/([^/]+)\//);
    if (match) {
      const ownerOrgId = match[1] ?? null;
      if (ownerOrgId && ownerOrgId !== callerOrgId) {
        logger.warn("Object download cross-org rejection", {
          callerOrgId,
          ownerOrgId,
          objectName,
        });
        return { allowed: false, ownerOrgId, legacy: false };
      }
      return { allowed: true, ownerOrgId, legacy: false };
    }
    // Legacy: no `orgs/` segment in path → cannot verify ownership.
    if (/(?:^|\/)uploads\//.test(objectName)) {
      logger.warn("Object download against legacy ownership-less path", {
        callerOrgId,
        objectName,
      });
      return { allowed: true, ownerOrgId: null, legacy: true };
    }
    return { allowed: true, ownerOrgId: null, legacy: false };
  }

  // Check if object storage is properly configured
  async isConfigured(): Promise<boolean> {
    const client = await getObjectStorageClient();
    return !!(
      client &&
      (process.env["PUBLIC_OBJECT_SEARCH_PATHS"] || process.env["PRIVATE_OBJECT_DIR"])
    );
  }

  // Check if running in Replit environment
  isReplitEnvironment(): boolean {
    return isReplitEnvironment();
  }
}
