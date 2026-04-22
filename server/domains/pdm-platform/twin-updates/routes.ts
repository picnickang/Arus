import { Router, type Request, type Response } from "express";
import { TwinUpdateService } from "./twin-update.service";
import { TwinFreshnessAdapter } from "./adapter";
import { TwinStateService } from "../digital-twin/twin-state/twin-state.service";
import { TwinStateAdapter } from "../digital-twin/twin-state/adapter";
import { TwinDefinitionAdapter } from "../digital-twin/twin-definition/adapter";
import { TelemetryAdapter } from "../feature-store/telemetry-adapter";
import { ResidualAnalysisService } from "../digital-twin/residual-analysis/residual-analysis.service";

const router = Router();

const freshnessAdapter = new TwinFreshnessAdapter();
const stateAdapter = new TwinStateAdapter();
const definitionAdapter = new TwinDefinitionAdapter();
const telemetryAdapter = new TelemetryAdapter();
const twinStateService = new TwinStateService(stateAdapter, definitionAdapter, telemetryAdapter);
const residualService = new ResidualAnalysisService();
const updateService = new TwinUpdateService(freshnessAdapter, twinStateService, residualService);

router.post("/refresh/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    if (!twinId) {
      return res.status(400).json({ error: "twinId is required" });
    }
    const result = await updateService.refreshOneTwin(orgId, twinId);
    res.json({
      success: true,
      twinId,
      healthScore: result.state.healthScore,
      residualCount: result.residuals.length,
      timestamp: result.state.timestamp,
    });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/refresh-all", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await updateService.refreshAllActiveTwins(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/freshness", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const freshness = await updateService.getFreshnessStatus(orgId);
    res.json(freshness);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/freshness/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    const freshness = await updateService.getTwinFreshness(orgId, twinId);
    if (!freshness) {
      return res.status(404).json({ error: "Twin not found or not active" });
    }
    res.json(freshness);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as twinUpdatesRouter };
