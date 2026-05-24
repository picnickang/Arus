import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ModelMonitoringAdapter } from "./adapter";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const router = Router();
const monitoring = new ModelMonitoringAdapter();

router.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const summary = await monitoring.getDriftSummary(orgId);
    return res.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

const computeDriftSchema = z.object({
  windowDays: z.number().int().positive().optional(),
});

router.post("/:modelVersionId/compute", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = computeDriftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { windowDays } = parsed.data;
    const result = await monitoring.computeDrift(orgId, req.params.modelVersionId, windowDays);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/:modelVersionId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await monitoring.getDrift(orgId, req.params.modelVersionId);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

export { router as monitoringRouter };
