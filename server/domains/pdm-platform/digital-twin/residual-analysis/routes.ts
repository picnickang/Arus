import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ResidualAnalysisService } from "./residual-analysis.service";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const router = Router();
const service = new ResidualAnalysisService();

const computeSchema = z.object({
  twinId: z.string().min(1),
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const result = await service.computeResiduals(orgId, parsed.data.twinId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

router.get("/twin/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = limitSchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : undefined;
    const result = await service.getResidualsByTwin(orgId, req.params['twinId'], limit);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/rankings", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await service.getResidualRankings(orgId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

export { router as residualAnalysisRouter };
