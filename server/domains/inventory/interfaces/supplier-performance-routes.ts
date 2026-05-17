// @ts-nocheck
import { Router } from "express";
import { asyncHandler } from "../../../lib/async-handler";
import { requireOrgId, AuthenticatedRequest } from "../../../middleware/auth";
import { createRateLimiter } from "../../../lib/rate-limit-factory";
import { getSupplierPerformanceSummaries } from "../application/supplier-performance-service";

export const supplierPerformanceRouter = Router();

const generalLimit = createRateLimiter("general");

supplierPerformanceRouter.get(
  "/suppliers/performance-summary",
  requireOrgId,
  generalLimit,
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).orgId!;
    const summaries = await getSupplierPerformanceSummaries(orgId);
    res.json(summaries);
  })
);
