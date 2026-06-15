/**
 * Knowledge Base Routes
 *
 * Security Note (S5443 - publicly writable directories):
 * /tmp/kb-uploads is used for temporary file staging during document ingestion.
 * Files are processed asynchronously and removed after ingestion.
 * In production, consider a secure application-owned directory.
 */
import { Router, type Express } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import fsPromises from "node:fs/promises";
import { requireOrgId } from "../middleware/auth";
import { generalApiRateLimit as apiRateLimit } from "../middleware/rate-limiters";
import { enforceQuota } from "../middleware/tenant-quota";
import { quotaService } from "../tenancy/quota-service";
import { additionalSecurityHeaders, sanitizeRequestData } from "../security";
import { ingestDocument, deleteDocument } from "../document-ingestion-service";
import { searchKnowledgeBase } from "../vector-search-service";
import { getKnowledgeBaseStats } from "../vector-search-service";
import { jobQueueService, type DocumentIngestionJob } from "../job-queue-service";
import { db } from "../db";
import { kbDocs, equipment } from "@shared/schema-runtime";
import { eq, and } from "drizzle-orm";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Routes:KbRoutes");
import { asyncUpload, handleSingleFileUpload, syncUpload } from "./kb-upload-middleware";
import {
  updateDocumentVersion,
  getDocumentVersionHistory,
  updateDocumentVisibility,
  listDocumentsWithAccess,
} from "../services/document-ingestion/repository";
import {
  validateMagicBytesFromBuffer,
  validateMagicBytesFromPath,
} from "../services/kb-upload-validation";

// Helper to validate equipmentId belongs to org (optional field validation)
async function validateEquipmentOwnership(
  equipmentId: string | null | undefined,
  orgId: string
): Promise<boolean> {
  if (!equipmentId) {
    return true; // No equipment specified is valid
  }

  const [equip] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
    .limit(1);

  return !!equip;
}

// Request validation schemas
const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.5),
});

export async function registerKnowledgeBaseRoutes(
  app: Express,
  rateLimits: {
    generalApiRateLimit: import("express").RequestHandler;
    writeOperationRateLimit: import("express").RequestHandler;
  }
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimits;
  const router = Router();

  // Apply middleware to all KB routes. The directly-imported limiter runs
  // first so CodeQL recognises every handler as rate-limited (CWE-770); the
  // DI'd generalApiRateLimit stays available for per-route use below.
  router.use(apiRateLimit);
  router.use(requireOrgId);
  router.use(additionalSecurityHeaders);
  router.use(sanitizeRequestData);

  // Async upload endpoint (recommended for larger files).
  // Task #89: enforceQuota("storage_bytes") soft-warns at 80% and hard-
  // 429s at 100%. The increment lands after the kbDocs row is persisted
  // so a failed insert doesn't pollute the usage counter.
  router.post(
    "/upload/async",
    writeOperationRateLimit,
    enforceQuota("storage_bytes"),
    handleSingleFileUpload(asyncUpload),
    async (req, res) => {
      // Track the staged file so any failure path (magic-byte
      // mismatch, validation throw, DB insert failure, enqueue
      // failure) can deterministically clean it up. Multer disk
      // storage has already persisted to /tmp/kb-uploads at this
      // point and will NOT auto-cleanup on handler errors.
      const stagedPath = req.file?.path;
      let enqueuedSuccessfully = false;
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // P2 #12 — magic-byte verification against declared mimetype.
        // Reject + delete the staged file on mismatch (415).
        const magicOk = await validateMagicBytesFromPath(req.file.path, req.file.mimetype);
        if (!magicOk) {
          return res.status(415).json({ error: "File content does not match declared type" });
        }
        // Restrict the staged file itself to owner-only.
        await fsPromises.chmod(req.file.path, 0o600).catch(() => {});

        const orgId = req.orgId;
        const userId = req.user?.id;
        const documentId = randomUUID();
        const equipmentId = req.body?.equipmentId || null; // Optional: Link document to specific equipment

        // Validate equipmentId belongs to org (security: prevent cross-tenant linking)
        if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
          return res.status(400).json({
            error: "Invalid equipmentId or equipment does not belong to your organization",
          });
        }

        logger.info(
          `[KB Upload Async] Enqueuing ${req.file.originalname} for org ${orgId}${equipmentId ? ` (equipment: ${equipmentId})` : ""}`
        );

        // Create document record with 'processing' status
        await db.insert(kbDocs).values({
          id: documentId,
          orgId,
          equipmentId,
          name: req.file.originalname,
          source: req.file.originalname,
          fileType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedBy: userId,
          status: "processing",
        });

        void quotaService.incrementUsage(orgId, "storage_bytes", req.file.size);

        // Enqueue job
        const jobId = await jobQueueService.enqueueDocumentIngestion({
          documentId,
          orgId,
          filePath: req.file.path,
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          uploadedBy: userId,
        });
        // Hand-off complete — the ingestion worker now owns the file.
        enqueuedSuccessfully = true;

        return res.status(202).json({
          success: true,
          jobId,
          documentId,
          message: "Document upload queued for processing",
        });
      } catch (error) {
        logger.error("[KB Upload Async] Failed:", undefined, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Document upload failed", details: errorMessage });
      } finally {
        // P2 #12 — Deterministic staged-file cleanup. Multer disk
        // storage does not auto-remove on handler errors / early
        // returns, so we unlink whenever the file was not handed off
        // to the ingestion worker (magic-byte mismatch, DB insert
        // failure, enqueue failure, validation throw, etc.).
        if (stagedPath && !enqueuedSuccessfully) {
          await fsPromises.unlink(stagedPath).catch(() => {});
        }
      }
    }
  );

  // Synchronous upload endpoint (for small files or immediate processing)
  router.post(
    "/upload",
    writeOperationRateLimit,
    enforceQuota("storage_bytes"),
    handleSingleFileUpload(syncUpload),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const orgId = req.orgId;
        const userId = req.user?.id;
        const equipmentId = req.body?.equipmentId || null; // Optional: Link document to specific equipment

        // Validate equipmentId belongs to org (security: prevent cross-tenant linking)
        if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
          return res.status(400).json({
            error: "Invalid equipmentId or equipment does not belong to your organization",
          });
        }

        // P2 #12 — magic-byte verification on the in-memory buffer.
        if (!validateMagicBytesFromBuffer(req.file.buffer, req.file.mimetype)) {
          return res.status(415).json({ error: "File content does not match declared type" });
        }

        // Determine file type from mimetype
        let fileType: "pdf" | "png" | "jpg" | "jpeg";
        if (req.file.mimetype === "application/pdf") {
          fileType = "pdf";
        } else if (req.file.mimetype === "image/png") {
          fileType = "png";
        } else if (req.file.mimetype === "image/jpeg") {
          fileType = "jpeg";
        } else {
          return res.status(400).json({ error: "Unsupported file type" });
        }

        logger.info(
          `[KB Upload Sync] Processing ${req.file.originalname} for org ${orgId}${equipmentId ? ` (equipment: ${equipmentId})` : ""}`
        );

        const result = await ingestDocument({
          orgId,
          fileName: req.file.originalname,
          fileBuffer: req.file.buffer,
          fileType,
          uploadedBy: userId,
          equipmentId,
          openAiKey: process.env["OPENAI_API_KEY"],
        });

        void quotaService.incrementUsage(orgId, "storage_bytes", req.file.size);

        return res.status(201).json({
          success: true,
          docId: result.docId,
          chunksCreated: result.chunksCreated,
          metadata: result.metadata,
        });
      } catch (error) {
        logger.error("[KB Upload Sync] Failed:", undefined, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: "Document upload failed", details: errorMessage });
      }
    }
  );

  // Job status endpoint
  router.get("/jobs/:jobId", generalApiRateLimit, async (req, res) => {
    try {
      const { jobId = "" } = req.params;
      const orgId = req.orgId;

      const job = await jobQueueService.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Security: Verify org ownership via job payload
      const jobData = job.data as DocumentIngestionJob;
      if (jobData.orgId !== orgId) {
        logger.warn(
          `[KB Job Status] Unauthorized access attempt: job ${jobId} belongs to org ${jobData.orgId}, requested by org ${orgId}`
        );
        return res.status(404).json({ error: "Job not found" }); // Don't leak existence
      }

      // Return minimal safe information
      return res.json({
        jobId,
        state: job.state,
        documentId: jobData.documentId,
        filename: jobData.filename,
        createdOn: job.createdOn,
        startedOn: job.startedOn,
        completedOn: job.completedOn,
        output: job.output,
      });
    } catch (error) {
      logger.error("[KB Job Status] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: "Failed to get job status", details: errorMessage });
    }
  });

  // Search documents endpoint
  router.get("/search", generalApiRateLimit, async (req, res) => {
    try {
      const validatedQuery = searchQuerySchema.parse(req.query);
      const orgId = req.orgId;

      logger.info(`[KB Search] Query: "${validatedQuery.q}" for org ${orgId}`);

      const results = await (
        searchKnowledgeBase as object as (
          opts: Record<string, unknown>
        ) => Promise<Array<Record<string, unknown>>>
      )({
        orgId,
        query: validatedQuery.q,
        limit: validatedQuery.limit,
        threshold: validatedQuery.threshold,
        openAiKey: process.env["OPENAI_API_KEY"],
      });

      return res.json({
        query: validatedQuery.q,
        results,
        count: results.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      logger.error("[KB Search] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: "Search failed", details: errorMessage });
    }
  });

  // List documents endpoint (with access control)
  router.get("/documents", generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const userId = req.user?.id || null;
      const userRoles = (req.user as { roles?: string[] } | undefined)?.roles || [];
      const equipmentId = req.query["equipmentId"] as string | undefined;

      // Validate equipmentId belongs to org if provided (security: prevent cross-tenant probing)
      if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
        return res
          .status(400)
          .json({ error: "Invalid equipmentId or equipment does not belong to your organization" });
      }

      // Get documents with access control filtering
      let documents = await listDocumentsWithAccess(orgId, userId, userRoles);

      // Further filter by equipmentId if provided
      if (equipmentId) {
        documents = documents.filter((doc) => doc.equipmentId === equipmentId);
      }

      return res.json({
        documents,
        count: documents.length,
        ...(equipmentId && { equipmentId }),
      });
    } catch (error) {
      logger.error("[KB List] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: "Failed to list documents", details: errorMessage });
    }
  });

  // Delete document endpoint.
  // Task #89: look up sizeBytes BEFORE the delete so we can decrement
  // storage_bytes by exactly the freed amount. Negative delta on
  // incrementUsage shrinks the counter (clamped at 0 by the SQL path).
  router.delete("/documents/:id", writeOperationRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const { id = "" } = req.params;

      const [docRow] = await db
        .select({ sizeBytes: kbDocs.sizeBytes })
        .from(kbDocs)
        .where(and(eq(kbDocs.id, id), eq(kbDocs.orgId, orgId)))
        .limit(1);

      await deleteDocument(id, orgId);

      const freed = Number(docRow?.sizeBytes ?? 0);
      if (Number.isFinite(freed) && freed > 0) {
        void quotaService.incrementUsage(orgId, "storage_bytes", -freed);
      }

      return res.status(204).send();
    } catch (error) {
      logger.error("[KB Delete] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("not found") || errorMessage.includes("access denied")) {
        return res.status(404).json({ error: errorMessage });
      }

      return res.status(500).json({ error: "Failed to delete document", details: errorMessage });
    }
  });

  // Get knowledge base stats endpoint
  router.get("/stats", generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const stats = await (getKnowledgeBaseStats as object as (orgId: string) => Promise<unknown>)(
        orgId
      );

      return res.json(stats);
    } catch (error) {
      logger.error("[KB Stats] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ error: "Failed to get stats", details: errorMessage });
    }
  });

  // Get document version history
  router.get("/documents/:id/versions", generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const { id = "" } = req.params;

      const versions = await getDocumentVersionHistory(id, orgId);
      return res.json({ documentId: id, versions, count: versions.length });
    } catch (error) {
      logger.error("[KB Versions] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("not found")) {
        return res.status(404).json({ error: errorMessage });
      }
      return res
        .status(500)
        .json({ error: "Failed to get version history", details: errorMessage });
    }
  });

  // Update document version (create new version record)
  router.post("/documents/:id/versions", writeOperationRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const userId = req.user?.id;
      const { id = "" } = req.params;
      const { changeType, changeNotes } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!changeType || !["updated", "replaced"].includes(changeType)) {
        return res.status(400).json({ error: 'changeType must be "updated" or "replaced"' });
      }

      const result = await updateDocumentVersion(id, orgId, userId, changeType, changeNotes);
      return res.json({
        success: true,
        document: result.doc,
        versionRecord: result.version,
      });
    } catch (error) {
      logger.error("[KB Version Update] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("not found")) {
        return res.status(404).json({ error: errorMessage });
      }
      return res.status(500).json({ error: "Failed to update version", details: errorMessage });
    }
  });

  // Update document visibility/access control
  router.patch("/documents/:id/visibility", writeOperationRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const { id = "" } = req.params;
      const { visibility, allowedRoles } = req.body;

      if (!visibility || !["org", "private", "role-based"].includes(visibility)) {
        return res
          .status(400)
          .json({ error: 'visibility must be "org", "private", or "role-based"' });
      }

      if (visibility === "role-based" && (!allowedRoles || !Array.isArray(allowedRoles))) {
        return res
          .status(400)
          .json({ error: "allowedRoles array required for role-based visibility" });
      }

      const updated = await updateDocumentVisibility(id, orgId, visibility, allowedRoles);
      return res.json({ success: true, document: updated });
    } catch (error) {
      logger.error("[KB Visibility Update] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("not found")) {
        return res.status(404).json({ error: errorMessage });
      }
      return res.status(500).json({ error: "Failed to update visibility", details: errorMessage });
    }
  });

  // Mount router
  app.use("/api/kb", router);

  logger.info("[KB Routes] Knowledge Base API routes registered");
}
