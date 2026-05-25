import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { TwinStateService } from "./twin-state.service";
import { TwinStateAdapter } from "./adapter";
import { TwinDefinitionAdapter } from "../twin-definition/adapter";
import { TelemetryAdapter } from "../../feature-store/telemetry-adapter";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

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
    const orgId = DEFAULT_ORG_ID;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const result = await stateService.computeState(orgId, parsed.data.twinId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

router.get("/latest/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { twinId = '' } = req.params;
    const result = await stateService.getLatestState(orgId, twinId);
    if (!result) {
      return res.status(404).json({ error: "No state found for twin" });
    }
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  // ISO timestamp — return only snapshots at/after this point. Used by the
  // 3D twin viewer's replay scrubber to cap the window to last N hours.
  since: z.string().datetime().optional(),
});

router.get("/history/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const { twinId = '' } = req.params;
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      // Reject bad query params explicitly so callers cannot trigger an
      // accidentally-unbounded scan by malforming `since` or `limit`.
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const limit = parsed.data.limit;
    const since = parsed.data.since ? new Date(parsed.data.since) : undefined;
    const result = await stateService.getStateHistory(orgId, twinId, limit, since);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

export { router as twinStateRouter };
