import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ResidualAnalysisService } from "./residual-analysis.service";

const router = Router();
const service = new ResidualAnalysisService();

const computeSchema = z.object({
  twinId: z.string().min(1),
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success)
      {return res.status(400).json({ error: parsed.error.flatten().fieldErrors });}
    const result = await service.computeResiduals(orgId, parsed.data.twinId);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

router.get("/twin/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = limitSchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : undefined;
    const result = await service.getResidualsByTwin(
      orgId,
      req.params.twinId,
      limit
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/rankings", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await service.getResidualRankings(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as residualAnalysisRouter };
