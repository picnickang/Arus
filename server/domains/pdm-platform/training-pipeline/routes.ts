import { Router, type Response } from "express";
import { z } from "zod";
import { TrainingPipelineService } from "./training-pipeline.service";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role-auth";

const router = Router();
const service = new TrainingPipelineService();

const createDatasetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceType: z.string().min(1),
  sourceConfig: z.record(z.unknown()).optional(),
  featureColumns: z.array(z.string()).optional(),
  labelColumn: z.string().optional(),
  targetType: z.string().optional(),
  timeRangeStart: z.string().datetime().optional(),
  timeRangeEnd: z.string().datetime().optional(),
  rowCount: z.number().int().positive().optional(),
  splitConfig: z.record(z.unknown()).optional(),
  createdBy: z.string().optional(),
});

const startRunSchema = z.object({
  datasetId: z.string().min(1),
  config: z.record(z.unknown()).optional().default({}),
  hyperparameters: z.record(z.unknown()).optional().default({}),
  initiatedBy: z.string().optional(),
});

const promoteSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  changelog: z.string().optional(),
});

const statusQuerySchema = z.object({ status: z.string().optional() });
const runsListQuerySchema = z.object({
  status: z.string().optional(),
  datasetId: z.string().optional(),
});
const idParamSchema = z.object({ id: z.string().min(1) });
const artifactsQuerySchema = z.object({ modelVersionId: z.string().optional() });

// LR-3.5 / PdM tenancy hardening: `requireOrgId` is mounted on this router
// in `server/routes/domain-router-registry.ts` (mountPath `/api/pdm/training`).
// That middleware (a) rejects unauthenticated requests with 401
// UNAUTHENTICATED, (b) rejects authenticated users missing an org claim
// with 401 TENANT_CLAIM_MISSING, and (c) populates `req.orgId`. Handlers
// therefore read `orgId` exclusively from the authenticated request
// context — no single-tenant constant fallback — and a missing claim
// cannot reach this layer.
function getOrgId(req: AuthenticatedRequest): string {
  return req.orgId;
}

router.post("/datasets", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = createDatasetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const data = {
      ...parsed.data,
      orgId,
      timeRangeStart: parsed.data.timeRangeStart ? new Date(parsed.data.timeRangeStart) : undefined,
      timeRangeEnd: parsed.data.timeRangeEnd ? new Date(parsed.data.timeRangeEnd) : undefined,
    };
    const result = await service.createDataset(data);
    return res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/datasets", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { status } = statusQuerySchema.parse(req.query);
    const result = await service.listDatasets(orgId, status);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/datasets/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = idParamSchema.parse(req.params);
    const result = await service.getDataset(orgId, id);
    if (!result) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.post("/runs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { datasetId, config, hyperparameters, initiatedBy } = parsed.data;
    const result = await service.startTrainingRun(
      orgId,
      datasetId,
      config,
      hyperparameters,
      initiatedBy
    );
    return res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if ((message).includes("not found")) {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

router.get("/runs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { status, datasetId } = runsListQuerySchema.parse(req.query);
    const result = await service.listRuns(orgId, {
      ...(status !== undefined && { status }),
      ...(datasetId !== undefined && { datasetId }),
    });
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/runs/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { id } = idParamSchema.parse(req.params);
    const result = await service.getRunStatus(orgId, id);
    if (!result) {
      return res.status(404).json({ error: "Training run not found" });
    }
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

// LR-3.5 / ML-1: model promotion is a write-once production swap; gate
// behind admin/chief_engineer (parallel to /api/ml/models/:id/promote).
router.post("/runs/:id/promote", requireRole("admin", "chief_engineer"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const parsed = promoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { modelId, version, changelog } = parsed.data;
    const { id } = idParamSchema.parse(req.params);
    const result = await service.promoteModelVersion(
      orgId,
      id,
      modelId,
      version,
      changelog
    );
    return res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if ((message).includes("not found") || (message).includes("not completed")) {
      return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

router.get("/artifacts", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { modelVersionId } = artifactsQuerySchema.parse(req.query);
    if (!modelVersionId) {
      return res.status(400).json({ error: "modelVersionId query param required" });
    }
    const result = await service.listArtifacts(orgId, modelVersionId);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

export { router as trainingPipelineRouter };
