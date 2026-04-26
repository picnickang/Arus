import { Router, type Request, type Response } from "express";
import { ScenarioSimAdapter } from "./adapter";
import { ScenarioSimService } from "./scenario-sim.service";
import { TwinStateAdapter } from "../twin-state/adapter";
import { z } from "zod";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

const router = Router();
const scenarioAdapter = new ScenarioSimAdapter();
const stateAdapter = new TwinStateAdapter();
const service = new ScenarioSimService(scenarioAdapter, stateAdapter);

const runScenarioSchema = z.object({
  twinId: z.string().min(1),
  name: z.string().min(1),
  parameters: z.object({
    loadPercent: z.number().min(0).max(120).optional(),
    temperatureOffset: z.number().min(-50).max(50).optional(),
    maintenanceDelayDays: z.number().min(0).max(365).optional(),
  }),
});

router.post("/run", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const parsed = runScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { twinId, name, parameters } = parsed.data;
    const result = await service.runScenario(orgId, twinId, name, parameters);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/twins/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await scenarioAdapter.listScenarios(orgId, req.params.twinId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:scenarioId", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;
    const result = await scenarioAdapter.getScenario(orgId, req.params.scenarioId);
    if (!result) {
      return res.status(404).json({ error: "Scenario not found" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as scenarioSimRouter };
