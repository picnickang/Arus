import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { FleetAnalyticsAdapter } from "./adapter";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const router = Router();
const fleetAnalytics = new FleetAnalyticsAdapter();

const computeBaselinesSchema = z.object({
  equipmentType: z.string().min(1),
});

router.post("/baselines/compute", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = computeBaselinesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { equipmentType } = parsed.data;
    const result = await fleetAnalytics.computeBaselines(orgId, equipmentType);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/baselines", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const equipmentType = req.query["equipmentType"] as string;
    if (!equipmentType) {
      return res.status(400).json({ error: "equipmentType query param required" });
    }
    const result = await fleetAnalytics.getBaselines(orgId, equipmentType);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

router.get("/compare", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const equipmentId = req.query["equipmentId"] as string;
    const equipmentType = req.query["equipmentType"] as string;
    if (!equipmentId || !equipmentType) {
      return res.status(400).json({ error: "equipmentId and equipmentType required" });
    }
    const result = await fleetAnalytics.compareToFleet(orgId, equipmentId, equipmentType);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
});

export { router as fleetAnalyticsRouter };
