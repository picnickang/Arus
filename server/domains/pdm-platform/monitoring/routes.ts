import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ModelMonitoringAdapter } from "./adapter";

const router = Router();
const monitoring = new ModelMonitoringAdapter();

const computeDriftSchema = z.object({
  windowDays: z.number().int().positive().optional(),
});

router.post("/:modelVersionId/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeDriftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { windowDays } = parsed.data;
    const result = await monitoring.computeDrift(orgId, req.params.modelVersionId, windowDays);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelVersionId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await monitoring.getDrift(orgId, req.params.modelVersionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as monitoringRouter };
