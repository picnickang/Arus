import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { resolveInferenceRunner } from "./model-backed-runner";
import { PredictionEngineService } from "./prediction-engine.service";

const router = Router();
const runner = resolveInferenceRunner();
const predictionEngine = new PredictionEngineService(runner);

const inferSchema = z.object({
  equipmentId: z.string().min(1),
  modelVersionId: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId;
    const parsed = inferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { equipmentId, modelVersionId } = parsed.data;
    const result = await predictionEngine.predict(orgId, equipmentId, modelVersionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/predictions/:predictionId/explanations", async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId;
    const predictionId = parseInt(req.params.predictionId);
    if (isNaN(predictionId)) {
      return res.status(400).json({ error: "Invalid predictionId" });
    }
    const result = await predictionEngine.getExplanations(orgId, predictionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/predictions/:predictionId/lineage", async (req: Request, res: Response) => {
  try {
    const orgId = (req as AuthenticatedRequest).orgId;
    const predictionId = parseInt(req.params.predictionId);
    if (isNaN(predictionId)) {
      return res.status(400).json({ error: "Invalid predictionId" });
    }
    const result = await predictionEngine.getLineage(orgId, predictionId);
    if (!result) {
      return res.status(404).json({ error: "Prediction not found" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as inferenceRouter };
