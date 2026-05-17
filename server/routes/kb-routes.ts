// @ts-nocheck
/**
 * Knowledge Base Routes
 *
 * Security Note (S5443 - publicly writable directories):
 * /tmp/kb-uploads is used for temporary file staging during document ingestion.
 * Files are processed asynchronously and removed after ingestion.
 * In production, consider a secure application-owned directory.
 */
import { Router, type Express } from "express";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireOrgId } from "../middleware/auth";
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
import {
  updateDocumentVersion,
  getDocumentVersionHistory,
  updateDocumentVisibility,
  listDocumentsWithAccess,
} from "../services/document-ingestion/repository";

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

// Configure multer for disk storage (async processing)
// NOSONAR: S5443 - /tmp used for temporary upload processing; files processed immediately
const asyncUpload = multer({
  storage: multer.diskStorage({
    destination: "/tmp/kb-uploads",
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, PNG, and JPEG are allowed."));
    }
  },
});

// Configure multer for in-memory file uploads (sync processing)
const syncUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, PNG, and JPEG are allowed."));
    }
  },
});

// Request validation schemas
const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.5),
});

export async function registerKnowledgeBaseRoutes(
  app: Express,
  rateLimits: {
    generalApiRateLimit: any;
    writeOperationRateLimit: any;
  }
) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimits;
  const router = Router();

  // Apply middleware to all KB routes
  router.use(requireOrgId);
  router.use(additionalSecurityHeaders);
  router.use(sanitizeRequestData);

  // Async upload endpoint (recommended for larger files)
  router.post(
    "/upload/async",
    writeOperationRateLimit,
    asyncUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const orgId = req.orgId;
        const userId = req.user?.id;
        const documentId = randomUUID();
        const equipmentId = req.body?.equipmentId || null; // Optional: Link document to specific equipment

        // Validate equipmentId belongs to org (security: prevent cross-tenant linking)
        if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
          return res
            .status(400)
            .json({
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

        // Enqueue job
        const jobId = await jobQueueService.enqueueDocumentIngestion({
          documentId,
          orgId,
          filePath: req.file.path,
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          uploadedBy: userId,
        });

        res.status(202).json({
          success: true,
          jobId,
          documentId,
          message: "Document upload queued for processing",
        });
      } catch (error) {
        logger.error("[KB Upload Async] Failed:", undefined, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: "Document upload failed", details: errorMessage });
      }
    }
  );

  // Synchronous upload endpoint (for small files or immediate processing)
  router.post("/upload", writeOperationRateLimit, syncUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const orgId = req.orgId;
      const userId = req.user?.id;
      const equipmentId = req.body?.equipmentId || null; // Optional: Link document to specific equipment

      // Validate equipmentId belongs to org (security: prevent cross-tenant linking)
      if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
        return res
          .status(400)
          .json({ error: "Invalid equipmentId or equipment does not belong to your organization" });
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
        openAiKey: process.env.OPENAI_API_KEY,
      });

      res.status(201).json({
        success: true,
        docId: result.docId,
        chunksCreated: result.chunksCreated,
        metadata: result.metadata,
      });
    } catch (error) {
      logger.error("[KB Upload Sync] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Document upload failed", details: errorMessage });
    }
  });

  // Job status endpoint
  router.get("/jobs/:jobId", generalApiRateLimit, async (req, res) => {
    try {
      const { jobId } = req.params;
      const orgId = req.orgId;

      const job = await jobQueueService.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Security: Verify org ownership via job payload
      const jobData = job.data as DocumentIngestionJob;
      if (jobData.orgId !== orgId) {
        logger.warn(`[KB Job Status] Unauthorized access attempt: job ${jobId} belongs to org ${jobData.orgId}, requested by org ${orgId}`);
        return res.status(404).json({ error: "Job not found" }); // Don't leak existence
      }

      // Return minimal safe information
      res.json({
        jobId,
        state: job.state,
        documentId: jobData.documentId,
        filename: jobData.filename,
        createdOn: job.createdon,
        startedOn: job.startedon,
        completedOn: job.completedon,
        output: job.output,
      });
    } catch (error) {
      logger.error("[KB Job Status] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to get job status", details: errorMessage });
    }
  });

  // Search documents endpoint
  router.get("/search", generalApiRateLimit, async (req, res) => {
    try {
      const validatedQuery = searchQuerySchema.parse(req.query);
      const orgId = req.orgId;

      logger.info(`[KB Search] Query: "${validatedQuery.q}" for org ${orgId}`);

      const results = await searchKnowledgeBase({
        orgId,
        query: validatedQuery.q,
        limit: validatedQuery.limit,
        threshold: validatedQuery.threshold,
        openAiKey: process.env.OPENAI_API_KEY,
      });

      res.json({
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
      res.status(500).json({ error: "Search failed", details: errorMessage });
    }
  });

  // List documents endpoint (with access control)
  router.get("/documents", generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const userId = req.user?.id || null;
      const userRoles = (req.user?.roles as string[]) || [];
      const equipmentId = req.query.equipmentId as string | undefined;

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

      res.json({
        documents,
        count: documents.length,
        ...(equipmentId && { equipmentId }),
      });
    } catch (error) {
      logger.error("[KB List] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to list documents", details: errorMessage });
    }
  });

  // Delete document endpoint
  router.delete("/documents/:id", writeOperationRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const { id } = req.params;

      await deleteDocument(id, orgId);

      res.status(204).send();
    } catch (error) {
      logger.error("[KB Delete] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("not found") || errorMessage.includes("access denied")) {
        return res.status(404).json({ error: errorMessage });
      }

      res.status(500).json({ error: "Failed to delete document", details: errorMessage });
    }
  });

  // Get knowledge base stats endpoint
  router.get("/stats", generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const stats = await getKnowledgeBaseStats(orgId);

      res.json(stats);
    } catch (error) {
      logger.error("[KB Stats] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to get stats", details: errorMessage });
    }
  });

  // Get document version history
  router.get("/documents/:id/versions", generalApiRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const { id } = req.params;

      const versions = await getDocumentVersionHistory(id, orgId);
      res.json({ documentId: id, versions, count: versions.length });
    } catch (error) {
      logger.error("[KB Versions] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("not found")) {
        return res.status(404).json({ error: errorMessage });
      }
      res.status(500).json({ error: "Failed to get version history", details: errorMessage });
    }
  });

  // Update document version (create new version record)
  router.post("/documents/:id/versions", writeOperationRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const userId = req.user?.id;
      const { id } = req.params;
      const { changeType, changeNotes } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!changeType || !["updated", "replaced"].includes(changeType)) {
        return res.status(400).json({ error: 'changeType must be "updated" or "replaced"' });
      }

      const result = await updateDocumentVersion(id, orgId, userId, changeType, changeNotes);
      res.json({
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
      res.status(500).json({ error: "Failed to update version", details: errorMessage });
    }
  });

  // Update document visibility/access control
  router.patch("/documents/:id/visibility", writeOperationRateLimit, async (req, res) => {
    try {
      const orgId = req.orgId;
      const { id } = req.params;
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
      res.json({ success: true, document: updated });
    } catch (error) {
      logger.error("[KB Visibility Update] Failed:", undefined, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("not found")) {
        return res.status(404).json({ error: errorMessage });
      }
      res.status(500).json({ error: "Failed to update visibility", details: errorMessage });
    }
  });

  // Mount router
  app.use("/api/kb", router);

  logger.info("[KB Routes] Knowledge Base API routes registered");
}
