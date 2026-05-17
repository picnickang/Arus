import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { createRateLimiter } from "../../../lib/rate-limit-factory";
import { ReplenishmentSuggestionService } from "../application/replenishment-suggestion-service";
import { workOrderDemandRepository } from "../infrastructure/work-order-demand-repository-adapter";

export const replenishmentRouter = Router();

// @ts-ignore -- bulk-silence
const generalLimit = createRateLimiter("general");
const service = new ReplenishmentSuggestionService(workOrderDemandRepository);

replenishmentRouter.get(
  "/parts-inventory/smart-replenishment",
  requireOrgId,
  generalLimit,
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).orgId!;
    const vesselId = typeof req.query.vesselId === "string" ? req.query.vesselId : undefined;
    const result = await service.getSmartSuggestions(orgId, vesselId);
    res.json(result);
  })
);
