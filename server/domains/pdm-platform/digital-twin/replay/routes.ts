import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { insertTwinEventSchema } from "@shared/schema";
import { ReplayAdapter } from "./adapter";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const router = Router();
const adapter = new ReplayAdapter();

router.post("/events", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = insertTwinEventSchema.safeParse({ ...req.body, orgId });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const result = await adapter.logEvent(parsed.data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const timelineQuerySchema = z.object({
  twinId: z.string().min(1),
  startTime: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid startTime"),
  endTime: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid endTime"),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = timelineQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { twinId, startTime, endTime, limit } = parsed.data;
    const result = await adapter.getTimeline({
      orgId,
      twinId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      limit,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const anomalyQuerySchema = z.object({
  twinId: z.string().min(1),
  anomalyTimestamp: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid anomalyTimestamp"),
  windowMinutes: z.coerce.number().int().min(1).max(1440).optional(),
});

router.get("/timeline/anomaly", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = anomalyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { twinId, anomalyTimestamp, windowMinutes } = parsed.data;
    const result = await adapter.getTimelineAroundAnomaly({
      orgId,
      twinId,
      anomalyTimestamp: new Date(anomalyTimestamp),
      windowMinutes,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as replayRouter };
