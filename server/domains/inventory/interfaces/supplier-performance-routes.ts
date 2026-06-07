import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { authenticatedRequest, requireOrgId, } from "../../../middleware/auth";
import { RateLimiters } from "../../../lib/rate-limit-factory";
import { getSupplierPerformanceSummaries } from "../application/supplier-performance-service";

export const supplierPerformanceRouter = Router();

const generalLimit = RateLimiters.general();

supplierPerformanceRouter.get(
  "/suppliers/performance-summary",
  requireOrgId,
  generalLimit,
  asyncHandler(async (req, res) => {
    const orgId = authenticatedRequest(req).orgId;
    const summaries = await getSupplierPerformanceSummaries(orgId);
    res.json(summaries);
  }),
);
