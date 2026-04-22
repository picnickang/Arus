import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { PredictionGovernanceAdapter } from "./adapter";
import { PredictionGovernanceService } from "./prediction-governance.service";

const router = Router();
const adapter = new PredictionGovernanceAdapter();
const service = new PredictionGovernanceService(adapter);

router.get("/predictions", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const reviewStatus = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const predictions = await service.listByGovernanceStatus({
      orgId,
      reviewStatus,
      limit,
      offset,
    });
    res.json(predictions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/predictions/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const details = await service.getGovernanceDetails(orgId, id);
    if (!details) {
      return res.status(404).json({ error: "Prediction not found" });
    }
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getReviewerIdentity(req: Request): string {
  return (req.headers["x-admin-id"] as string) ?? "system-admin";
}

router.patch("/predictions/:id/review", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const reviewedBy = getReviewerIdentity(req);
    const result = await service.reviewPrediction(orgId, id, reviewedBy);
    if (!result) {
      return res.status(404).json({ error: "Prediction not found" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/predictions/:id/approve", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const reviewedBy = getReviewerIdentity(req);
    const result = await service.approvePrediction(orgId, id, reviewedBy);
    if (!result) {
      return res.status(404).json({ error: "Prediction not found" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const suppressSchema = z.object({
  reason: z.string().min(1),
});

router.patch("/predictions/:id/suppress", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid prediction ID" });
    }

    const parsed = suppressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const reviewedBy = getReviewerIdentity(req);
    const result = await service.suppressPrediction(orgId, id, reviewedBy, parsed.data.reason);
    if (!result) {
      return res.status(404).json({ error: "Prediction not found" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/predictions/expire-stale", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await service.expireStale(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as predictionGovernanceRouter };
