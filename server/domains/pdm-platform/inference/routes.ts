import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../../../db";
import { predictionExplanations } from "@shared/schema";
import { StubInferenceRunner } from "./stub-runner";

const router = Router();
const inferenceRunner = new StubInferenceRunner();

const inferSchema = z.object({
  equipmentId: z.string().min(1),
  modelVersionId: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = inferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { equipmentId, modelVersionId } = parsed.data;
    const result = await inferenceRunner.runInference(orgId, equipmentId, modelVersionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/predictions/:predictionId/explanations", async (req: Request, res: Response) => {
  try {
    const predictionId = parseInt(req.params.predictionId);
    if (isNaN(predictionId)) return res.status(400).json({ error: "Invalid predictionId" });
    const result = await db.select()
      .from(predictionExplanations)
      .where(eq(predictionExplanations.predictionId, predictionId))
      .orderBy(desc(predictionExplanations.importance));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as inferenceRouter };
