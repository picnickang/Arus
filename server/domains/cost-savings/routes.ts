import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import {
  costSavingsSummaryQuerySchema,
  costSavingsTrendQuerySchema,
  costSavingsCalculateOptionsSchema,
  costSavingsListQuerySchema,
  costSavings,
  updateValidationStatusSchema,
} from "@shared/schema-runtime";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface CostSavingsRoutesConfig {
  writeOperationRateLimit: RateLimitRequestHandler;
}

export function registerCostSavingsRoutes(
  app: Express,
  config: CostSavingsRoutesConfig
): void {
  const { writeOperationRateLimit } = config;

  app.get("/api/cost-savings/summary", requireOrgId,
    withErrorHandling("fetch cost savings summary", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsSummaryQuerySchema.parse(req.query);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - validatedQuery.months);

      const { getSavingsSummary } = await import("../../cost-savings-engine");
      const summary = await getSavingsSummary(orgId, startDate, endDate);

      res.json(summary);
    })
  );

  app.get("/api/cost-savings/trend", requireOrgId,
    withErrorHandling("fetch cost savings trend", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsTrendQuerySchema.parse(req.query);

      const { getMonthlySavingsTrend } = await import("../../cost-savings-engine");
      const trend = await getMonthlySavingsTrend(orgId, validatedQuery.months);

      res.json(trend);
    })
  );

  app.post("/api/cost-savings/calculate/:workOrderId", requireOrgId, writeOperationRateLimit,
    withErrorHandling("calculate cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { workOrderId } = req.params;
      const validatedOptions = costSavingsCalculateOptionsSchema.parse(req.body);

      const { calculateWorkOrderSavings } = await import("../../cost-savings-engine");
      const calculation = await calculateWorkOrderSavings(
        workOrderId,
        orgId,
        validatedOptions ?? {}
      );

      if (!calculation) {
        return res.status(400).json({
          message:
            "No savings to calculate. This work order is not preventive/predictive maintenance.",
        });
      }

      res.json(calculation);
    })
  );

  app.post("/api/cost-savings/process/:workOrderId", requireOrgId, writeOperationRateLimit,
    withErrorHandling("process cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { workOrderId } = req.params;

      const { processWorkOrderCompletion } = await import("../../cost-savings-engine");
      const result = await processWorkOrderCompletion(workOrderId, orgId);

      res.json(result);
    })
  );

  app.get("/api/cost-savings", requireOrgId,
    withErrorHandling("fetch cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsListQuerySchema.parse(req.query);

      const { db } = await import("../../db");
      const { eq, and, sql } = await import("drizzle-orm");

      let query = db
        .select()
        .from(costSavings)
        .where(eq(costSavings.orgId, orgId))
        .orderBy(sql`${costSavings.calculatedAt} DESC`)
        .limit(validatedQuery.limit);

      if (validatedQuery.equipmentId) {
        query = query.where(
          and(eq(costSavings.orgId, orgId), eq(costSavings.equipmentId, validatedQuery.equipmentId))
        );
      }

      if (validatedQuery.vesselId) {
        query = query.where(
          and(eq(costSavings.orgId, orgId), eq(costSavings.vesselId, validatedQuery.vesselId))
        );
      }

      const savings = await query;
      res.json(savings);
    })
  );

  app.get("/api/cost-savings/equipment-financials", requireOrgId,
    withErrorHandling("fetch equipment financial summary", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { equipmentService } = await import("../equipment/service");
      const financials = await equipmentService.getEquipmentFinancialSummary(orgId);

      const { getSavingsSummary } = await import("../../cost-savings-engine");
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      const savingsSummary = await getSavingsSummary(orgId, startDate, endDate);

      const assetROI = financials.totalFleetValue > 0
        ? ((savingsSummary.totalSavings + financials.totalCapitalRecovered) / financials.totalFleetValue) * 100
        : 0;

      res.json({
        ...financials,
        assetROI: Math.round(assetROI * 100) / 100,
        totalMaintenanceSavings: savingsSummary.totalSavings,
      });
    })
  );

  app.patch("/api/cost-savings/:id/validation", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update savings validation status", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id ?? "unknown";
      const { id } = req.params;
      const body = updateValidationStatusSchema.parse(req.body);

      const { db } = await import("../../db");
      const { eq, and } = await import("drizzle-orm");

      const [existing] = await db
        .select()
        .from(costSavings)
        .where(and(eq(costSavings.id, id), eq(costSavings.orgId, orgId)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: "Savings record not found" });
      }

      const { updateSavingsValidationStatus } = await import("../../cost-savings-engine");
      await updateSavingsValidationStatus(id, orgId, body.validationStatus, body.reason, userId);

      const [updated] = await db
        .select()
        .from(costSavings)
        .where(and(eq(costSavings.id, id), eq(costSavings.orgId, orgId)))
        .limit(1);

      res.json(updated);
    })
  );

  logger.info("CostSavingsRoutes", "Registered: summary, trend, calculate, process, list, equipment-financials, validation");
}
