import { createLogger } from "../../../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Domains:Purchasing:Interfaces:PipelineRoutes");
import { Router } from "express";
import type { Request, Response } from "express";
import { PurchasePipelineService } from "../application/pipeline-service";
import { PurchaseEventRepositoryAdapter } from "../infrastructure/purchase-event-repository-adapter";

const repo = new PurchaseEventRepositoryAdapter();
const pipelineService = new PurchasePipelineService(repo);

export const pipelineRouter = Router();

pipelineRouter.get("/purchase-requests/:id/pipeline", async (req: Request, res: Response) => {
  try {
    const orgId = DEFAULT_ORG_ID;

    const pipeline = await pipelineService.getPipeline(req.params['id'], orgId);
    if (!pipeline) {
      return res.status(404).json({ error: "Purchase request not found" });
    }

    return res.json(pipeline);
  } catch (error) {
    logger.error("[Purchasing Pipeline] Error:", undefined, error);
    return res.status(500).json({ error: (error as Error).message });
  }
});
