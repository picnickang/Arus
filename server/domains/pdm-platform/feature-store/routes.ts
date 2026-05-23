import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { FeatureStoreAdapter } from "./adapter";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const router = Router();
const featureStore = new FeatureStoreAdapter();

const computeSchema = z.object({
  equipmentId: z.string().min(1),
  windowMinutes: z.number().int().positive().optional(),
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { equipmentId, windowMinutes } = parsed.data;
    const result = await featureStore.computeAndStore(orgId, equipmentId, windowMinutes);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const equipmentId = req.query.equipmentId as string;
    if (!equipmentId) {
      return res.status(400).json({ error: "equipmentId query param required" });
    }
    const result = await featureStore.getLatest(orgId, equipmentId);
    res.json(result ?? { message: "No features found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const equipmentId = req.query.equipmentId as string;
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    if (!equipmentId) {
      return res.status(400).json({ error: "equipmentId query param required" });
    }
    const result = await featureStore.getHistory(orgId, equipmentId, from, to);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

export { router as featureStoreRouter };
