/**
 * ML Governance API Routes
 * Endpoints for model lineage, provenance chain verification, and audit logs
 *
 * SINGLE-TENANT SYSTEM: Uses default-org-id for all queries
 */

import { Router } from "express";
import { generalApiRateLimit } from "../middleware/rate-limiters";
import { z } from "zod";
import { getLineageRecords, getModelLineage, compareModels, recordPromotion } from "./lineage.js";
import { getProvenanceEvents, verifyChain } from "./provenance.js";
import type { DeploymentStage, ModelFamily } from "./types.js";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { requireRole } from "../middleware/role-auth";
import { authenticatedRequest } from "../middleware/auth";

const router = Router();

// Rate-limit every handler on this router (CWE-770). No-op in tests/dev relax.
router.use(generalApiRateLimit);

// Validation schemas
const lineageQuerySchema = z.object({
  profile: z.string().optional(),
  family: z.enum(["lstm", "xgboost", "rf"]).optional(),
  stage: z.enum(["dev", "staging", "production"]).optional(),
  vesselId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const promotionSchema = z.object({
  modelId: z.string().min(1),
  stage: z.enum(["dev", "staging", "production"]),
  promotedBy: z.string().min(1),
});

const compareSchema = z.object({
  model1: z.string().min(1),
  model2: z.string().min(1),
});

const provenanceQuerySchema = z.object({
  type: z.enum(["prediction", "alert", "anomaly", "work_order", "training"]).optional(),
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  modelId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  orgId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const verifyChainSchema = z.object({
  orgId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * GET /api/governance/model/lineage
 * Get model lineage records with optional filters
 */
router.get("/model/lineage", async (req, res, next) => {
  try {
    const query = lineageQuerySchema.parse(req.query);

    const filters = {
      orgId: DEFAULT_ORG_ID,
      ...(query.profile !== undefined && { profile: query.profile }),
      ...(query.family !== undefined && { family: query.family as ModelFamily }),
      ...(query.stage !== undefined && { stage: query.stage as DeploymentStage }),
      ...(query.vesselId !== undefined && { vesselId: query.vesselId }),
      ...(query.from !== undefined && { from: new Date(query.from) }),
      ...(query.to !== undefined && { to: new Date(query.to) }),
    };

    const records = await getLineageRecords(filters);

    // Optional safety cap: when limit/offset are supplied, `count` is the
    // pre-slice total (mirrors the provenance endpoint's `total`); without
    // them the response is identical to the historical uncapped behavior.
    const offset = query.offset ?? 0;
    const paginated =
      query.limit !== undefined || query.offset !== undefined
        ? records.slice(offset, offset + (query.limit ?? records.length))
        : records;

    return res.json({
      success: true,
      count: records.length,
      records: paginated,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/governance/model/lineage/:modelId
 * Get lineage for a specific model
 */
router.get("/model/lineage/:modelId", async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const record = await getModelLineage(modelId, DEFAULT_ORG_ID);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Model not found",
      });
    }

    return res.json({
      success: true,
      record,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/governance/model/compare
 * Compare two models
 */
router.get("/model/compare", async (req, res, next) => {
  try {
    const query = compareSchema.parse(req.query);
    const comparison = await compareModels(query.model1, query.model2, DEFAULT_ORG_ID);

    return res.json({
      success: true,
      comparison,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/governance/model/promote
 * Promote a model to a new deployment stage
 * RBAC: Manager or Admin only
 */
// LR-3.5 / ML-1: defence-in-depth — mount the standard requireRole middleware
// on top of the existing inline RBAC check so the gate cannot regress if the
// inline check is refactored away. The inline check is preserved to keep the
// legacy "Manager"/"Admin" string roles working alongside the canonical
// CrewRole set ("admin", "chief_engineer").
router.post("/model/promote", requireRole("admin", "chief_engineer"), async (req, res, next) => {
  try {
    const user = authenticatedRequest(req).user;
    if (!user || !["Manager", "Admin", "admin", "chief_engineer"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: "Only Managers and Admins can promote models",
      });
    }

    const body = promotionSchema.parse(req.body);

    await recordPromotion({
      modelId: body.modelId,
      orgId: DEFAULT_ORG_ID,
      stage: body.stage,
      promotedBy: body.promotedBy,
    });

    return res.json({
      success: true,
      message: `Model ${body.modelId} promoted to ${body.stage}`,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/governance/provenance/events
 * Get provenance events with filters and pagination
 */
router.get("/provenance/events", async (req, res, next) => {
  try {
    const query = provenanceQuerySchema.parse(req.query);

    const filters = {
      type: query.type,
      vesselId: query.vesselId,
      equipmentId: query.equipmentId,
      modelId: query.modelId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      orgId: DEFAULT_ORG_ID,
      limit: query.limit,
      offset: query.offset,
    };

    const result = await getProvenanceEvents(filters);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/governance/provenance/verify
 * Verify provenance chain integrity
 */
router.post("/provenance/verify", async (req, res, next) => {
  try {
    const body = verifyChainSchema.parse(req.body);

    const result = await verifyChain(
      DEFAULT_ORG_ID,
      body.from ? new Date(body.from) : undefined,
      body.to ? new Date(body.to) : undefined
    );

    return res.json({
      success: true,
      verification: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/governance/health
 * Health check for governance subsystem
 */
router.get("/health", async (_req, res) => {
  return res.json({
    success: true,
    status: "healthy",
    lineageFile: process.env["LINEAGE_FILE"] ?? "./checkpoints/lineage.jsonl",
    provenanceFile: process.env["PROVENANCE_FILE"] ?? "./checkpoints/provenance.jsonl",
  });
});

export default router;
