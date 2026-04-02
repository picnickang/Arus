import { Router } from "express";
import type { Request, Response } from "express";
import { PurchasePipelineService } from "../application/pipeline-service";
import { PurchaseEventRepositoryAdapter } from "../infrastructure/purchase-event-repository-adapter";

const repo = new PurchaseEventRepositoryAdapter();
const pipelineService = new PurchasePipelineService(repo);

export const pipelineRouter = Router();

pipelineRouter.get(
  "/purchase-requests/:id/pipeline",
  async (req: Request, res: Response) => {
    try {
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const pipeline = await pipelineService.getPipeline(req.params.id, orgId);
      if (!pipeline) {
        return res.status(404).json({ error: "Purchase request not found" });
      }

      res.json(pipeline);
    } catch (error) {
      console.error("[Purchasing Pipeline] Error:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);
