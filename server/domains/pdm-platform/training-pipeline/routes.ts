import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { TrainingPipelineService } from "./training-pipeline.service";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

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

router.post("/datasets", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
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
    res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

router.get("/datasets", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { status } = statusQuerySchema.parse(req.query);
    const result = await service.listDatasets(orgId, status);
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

router.get("/datasets/:id", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { id } = idParamSchema.parse(req.params);
    const result = await service.getDataset(orgId, id);
    if (!result) {
      return res.status(404).json({ error: "Dataset not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

router.post("/runs", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
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
    res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if ((message).includes("not found")) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.get("/runs", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { status, datasetId } = runsListQuerySchema.parse(req.query);
    const result = await service.listRuns(orgId, { status, datasetId });
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

router.get("/runs/:id", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { id } = idParamSchema.parse(req.params);
    const result = await service.getRunStatus(orgId, id);
    if (!result) {
      return res.status(404).json({ error: "Training run not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

router.post("/runs/:id/promote", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
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
    res.status(201).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if ((message).includes("not found") || (message).includes("not completed")) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.get("/artifacts", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { modelVersionId } = artifactsQuerySchema.parse(req.query);
    if (!modelVersionId) {
      return res.status(400).json({ error: "modelVersionId query param required" });
    }
    const result = await service.listArtifacts(orgId, modelVersionId);
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

export { router as trainingPipelineRouter };
