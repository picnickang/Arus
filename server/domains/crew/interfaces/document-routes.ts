/**
 * Crew Routes - Documents
 * Document management and expiry alerts
 */

import multer from "multer";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { insertCrewDocumentSchema } from "@shared/schema-runtime";
import { crewAppService as crewService } from "../application/index.js";
import { authenticatedRequest, requireOrgId,
  requireOrgIdAndValidateBody, } from "../../../middleware/auth";
import { requirePermission } from "../../../lib/permissions/middleware.js";
import {
  withErrorHandling,
  sendCreated,
  sendDeleted,
  sendNotFound,
} from "../../../lib/route-utils.js";
import { enforceQuota } from "../../../middleware/tenant-quota.js";
import { quotaService } from "../../../tenancy/quota-service.js";
import { ObjectStorageService } from "../../../replit_integrations/object_storage/objectStorage.js";
import {
  validateImageMagicBytes,
  isAllowedImageMimeType,
} from "../../../lib/image-magic-bytes.js";
import type { CrewRouteDeps } from "./types.js";
import { getExpiryUrgencyLevel } from "./types.js";

// Allowed document scans: the same images the avatar route accepts, plus PDF.
const PDF_MIME_TYPE = "application/pdf";
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function isAllowedDocumentMimeType(mimetype: string): boolean {
  return mimetype === PDF_MIME_TYPE || isAllowedImageMimeType(mimetype);
}

// Re-verify the leading bytes — the client Content-Type is spoofable.
function validateDocumentMagicBytes(buf: Buffer, mimetype: string): boolean {
  if (mimetype === PDF_MIME_TYPE) {
    return (
      buf.length >= PDF_MAGIC_BYTES.length &&
      PDF_MAGIC_BYTES.every((b, i) => buf[i] === b)
    );
  }
  return validateImageMagicBytes(buf, mimetype);
}

// In-memory multer for crew document scans. 10MB ceiling — a scanned PDF or
// photo of a certificate fits comfortably and keeps the storage quota honest.
const docFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedDocumentMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, PNG and JPEG files are allowed."));
    }
  },
});

/**
 * Best-effort delete a crew document object, optionally reclaiming the freed
 * bytes to the org's storage quota. Mirrors the crew-photo reclaim helper.
 * Never throws — a missing object is a no-op.
 */
async function deleteCrewDocumentObject(
  objectStorage: ObjectStorageService,
  filePath: string,
  orgId: string,
  reclaimQuota: boolean,
): Promise<void> {
  try {
    const objectFile = await objectStorage.getObjectEntityFile(filePath);
    const [metadata] = await objectFile.getMetadata();
    const freed = Number(metadata.size ?? 0);
    await objectFile.delete();
    if (reclaimQuota && freed > 0) {
      void quotaService.incrementUsage(orgId, "storage_bytes", -freed);
    }
  } catch {
    // Object already gone or unreadable — nothing to reclaim.
  }
}

const crewIdParamSchema = z.object({ crewId: z.string().min(1) });
const crewDocFileParamSchema = z.object({
  crewId: z.string().min(1),
  id: z.string().min(1),
});
const idParamSchema = z.object({ id: z.string().min(1) });
const expiringDocsQuerySchema = z.object({
  daysAhead: z.coerce.number().int().optional(),
  includeAcknowledged: z.enum(["true", "false"]).optional(),
});
const rawBodySchema = jsonRecordSchema;

export function registerDocumentRoutes({ app, rateLimit }: CrewRouteDeps): void {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  app.get(
    "/api/crew/:crewId/documents",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch crew documents", async (req, res) => {
      const { crewId } = crewIdParamSchema.parse(req.params);
      const documents = await crewService.getCrewDocuments(crewId, req.orgId);
      res.json(documents);
    })
  );

  app.post(
    "/api/crew/:crewId/documents",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create crew document", async (req, res) => {
      const orgId = req.orgId;
      const { crewId } = crewIdParamSchema.parse(req.params);
      const body: Record<string, unknown> = { ...rawBodySchema.parse(req.body ?? {}) };

      if (body['issuedAt'] && typeof body['issuedAt'] === "string") {
        body['issuedAt'] = new Date(body['issuedAt']);
      }

      if (body['expiresAt'] && typeof body['expiresAt'] === "string") {
        body['expiresAt'] = new Date(body['expiresAt']);
      }

      const docData = insertCrewDocumentSchema.parse({
        ...body,
        orgId,
        crewId,
      });
      const document = await crewService.createCrewDocument(docData, req.user?.id);
      sendCreated(res, document);
    })
  );

  // Upload (or replace) a scan of a crew document. Multipart field name:
  // "file". The buffer is magic-byte validated, streamed to object storage
  // with a private ACL owned by the uploader, and the normalized /objects/...
  // path is stored on the document row. Mirrors the crew-photo upload route.
  app.post(
    "/api/crew/:crewId/documents/:id/file",
    requireOrgId,
    requirePermission("crew_members", "edit"),
    writeOperationRateLimit,
    enforceQuota("storage_bytes"),
    docFileUpload.single("file"),
    withErrorHandling("upload crew document file", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const userId = req.user?.id;
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "A document file is required (multipart field 'file')." });
        return;
      }
      if (!validateDocumentMagicBytes(file.buffer, file.mimetype)) {
        res
          .status(400)
          .json({ error: "File contents do not match a valid PDF, PNG or JPEG document." });
        return;
      }
      const { crewId, id } = crewDocFileParamSchema.parse(req.params);
      const docs = (await crewService.getCrewDocuments(crewId, orgId)) as Array<{
        id: string;
        filePath?: string | null;
      }>;
      const existing = docs.find((d) => d.id === id);
      if (!existing) {
        sendNotFound(res, "Crew document");
        return;
      }
      const previousPath = existing.filePath ?? null;

      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL(orgId);
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file.buffer,
        headers: { "Content-Type": file.mimetype },
      });
      if (!putRes.ok) {
        throw new Error(`Failed to store crew document (object storage status ${putRes.status})`);
      }
      const filePath = await objectStorage.trySetObjectEntityAclPolicy(uploadURL, {
        owner: userId ?? "",
        visibility: "private",
      });

      let updated;
      try {
        updated = await crewService.updateCrewDocument(id, { filePath }, userId, orgId);
      } catch (err) {
        // DB write failed after the object landed — remove the orphan. No quota
        // was charged yet, so don't reclaim (reclaimQuota: false).
        await deleteCrewDocumentObject(objectStorage, filePath, orgId, false);
        throw err;
      }

      // New bytes committed: charge the quota, then reclaim the replaced scan's
      // bytes (best effort) so repeated replacements don't drift the quota.
      void quotaService.incrementUsage(orgId, "storage_bytes", file.size);
      if (previousPath && previousPath !== filePath) {
        await deleteCrewDocumentObject(objectStorage, previousPath, orgId, true);
      }
      res.json(updated);
    })
  );

  app.put(
    "/api/crew-documents/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update crew document", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const body: Record<string, unknown> = { ...rawBodySchema.parse(req.body ?? {}) };

      if (body['issuedAt'] && typeof body['issuedAt'] === "string") {
        body['issuedAt'] = new Date(body['issuedAt']);
      }

      if (body['expiresAt'] && typeof body['expiresAt'] === "string") {
        body['expiresAt'] = new Date(body['expiresAt']);
      }

      const docData = insertCrewDocumentSchema.partial().parse(body);
      const document = await crewService.updateCrewDocument(
        id,
        docData,
        req.user?.id,
        req.orgId
      );
      res.json(document);
    })
  );

  app.delete(
    "/api/crew-documents/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete crew document", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      await crewService.deleteCrewDocument(id, req.user?.id, req.orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/crew-documents/expiring",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch expiring documents", async (req, res) => {
      const orgId = req.orgId;
      const q = expiringDocsQuerySchema.parse(req.query);
      const daysAhead = q.daysAhead ?? 90;
      const includeAcknowledged = q.includeAcknowledged === "true";

      const expiringDocs = await crewService.getDocumentsExpiring(
        orgId,
        daysAhead,
        includeAcknowledged
      );

      const enrichedDocs = await Promise.all(
        expiringDocs.map(async (doc: Record<string, unknown> & { crewId: string }) => {
          const crewMember = await crewService.getCrewById(doc.crewId);
          return {
            ...doc,
            crewMemberName: crewMember?.name || "Unknown",
            crewMemberRank: crewMember?.rank || "Unknown",
            daysUntilExpiry: typeof doc['expiresAt'] === "string" || doc['expiresAt'] instanceof Date
              ? Math.ceil((new Date(doc['expiresAt'] as string | Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null,
            urgencyLevel: typeof doc['expiresAt'] === "string" || doc['expiresAt'] instanceof Date
              ? getExpiryUrgencyLevel(doc['expiresAt'] as string | Date)
              : null,
          };
        })
      );

      res.json({
        documents: enrichedDocs,
        summary: {
          total: enrichedDocs.length,
          critical: enrichedDocs.filter((d) => d.urgencyLevel === "critical").length,
          warning: enrichedDocs.filter((d) => d.urgencyLevel === "warning").length,
          notice: enrichedDocs.filter((d) => d.urgencyLevel === "notice").length,
        },
      });
    })
  );

  const acknowledgeDocAlertSchema = z.object({
    notes: z.string().max(1000).optional(),
  });

  app.post(
    "/api/crew-documents/:id/acknowledge-alert",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("acknowledge document alert", async (req, res) => {
      const { id: docId } = idParamSchema.parse(req.params);
      const userId = req.user?.id;
      const { notes } = acknowledgeDocAlertSchema.parse(req.body);

      const doc = await crewService.acknowledgeDocumentAlert(docId, userId, notes);
      res.json(doc);
    })
  );

  app.post(
    "/api/crew-documents/scan-expiry",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("scan for expiring documents", async (req, res) => {
      const orgId = req.orgId;
      const result = await crewService.scanAndFlagExpiringDocuments(orgId);
      res.json(result);
    })
  );
}
