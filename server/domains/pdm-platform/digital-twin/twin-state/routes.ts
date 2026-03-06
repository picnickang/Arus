import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { TwinStateService } from "./twin-state.service";
import { TwinStateAdapter } from "./adapter";
import { TwinDefinitionAdapter } from "../twin-definition/adapter";
import { TelemetryAdapter } from "../../feature-store/telemetry-adapter";

const router = Router();
const stateAdapter = new TwinStateAdapter();
const definitionAdapter = new TwinDefinitionAdapter();
const telemetryAdapter = new TelemetryAdapter();
const stateService = new TwinStateService(stateAdapter, definitionAdapter, telemetryAdapter);

const computeSchema = z.object({
  twinId: z.string().min(1),
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await stateService.computeState(orgId, parsed.data.twinId);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/latest/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    const result = await stateService.getLatestState(orgId, twinId);
    if (!result) return res.status(404).json({ error: "No state found for twin" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

router.get("/history/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    const parsed = historyQuerySchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : undefined;
    const result = await stateService.getStateHistory(orgId, twinId, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as twinStateRouter };
