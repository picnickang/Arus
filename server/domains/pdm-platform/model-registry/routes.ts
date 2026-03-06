import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ModelRegistryAdapter } from "./adapter";

const router = Router();
const registry = new ModelRegistryAdapter();

const createVersionSchema = z.object({
  version: z.string().min(1),
  artifactPath: z.string().optional(),
  changelog: z.string().optional(),
});

const deploySchema = z.object({
  modelVersionId: z.string().min(1),
  target: z.string().default("cloud"),
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.listModels(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.getModel(orgId, req.params.modelId);
    if (!result) return res.status(404).json({ error: "Model not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelId/versions", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.listVersions(orgId, req.params.modelId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:modelId/versions", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await registry.createVersion({
      orgId,
      modelId: req.params.modelId,
      ...parsed.data,
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelId/deployment", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.getActiveDeployment(orgId, req.params.modelId);
    res.json(result ?? { message: "No active deployment" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:modelId/deploy", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = deploySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { modelVersionId, target } = parsed.data;
    const result = await registry.deploy(orgId, req.params.modelId, modelVersionId, target);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/deployments/:deploymentId/rollback", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.rollback(orgId, parseInt(req.params.deploymentId));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as modelRegistryRouter };
