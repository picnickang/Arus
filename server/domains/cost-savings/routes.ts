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
import {
  getSavingsSummary,
  getMonthlySavingsTrend,
  calculateWorkOrderSavings,
  processWorkOrderCompletion,
  updateSavingsValidationStatus,
} from "../../cost-savings-engine";
import { db } from "../../db";

interface CostSavingsRoutesConfig {
  writeOperationRateLimit: RateLimitRequestHandler;
}

export function registerCostSavingsRoutes(app: Express, config: CostSavingsRoutesConfig): void {
  const { writeOperationRateLimit } = config;

  app.get(
    "/api/cost-savings/summary",
    requireOrgId,
    withErrorHandling("fetch cost savings summary", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsSummaryQuerySchema.parse(req.query);

      const endDate = validatedQuery.dateTo ? new Date(validatedQuery.dateTo) : new Date();
      const startDate = validatedQuery.dateFrom
        ? new Date(validatedQuery.dateFrom)
        : (() => {
            const d = new Date(endDate);
            d.setMonth(d.getMonth() - 3);
            return d;
          })();

      const summary = await getSavingsSummary(orgId, startDate, endDate);

      res.json(summary);
    })
  );

  app.get(
    "/api/cost-savings/trend",
    requireOrgId,
    withErrorHandling("fetch cost savings trend", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsTrendQuerySchema.parse(req.query);

      const trend = await getMonthlySavingsTrend(orgId, validatedQuery.months);

      res.json(trend);
    })
  );

  app.post(
    "/api/cost-savings/calculate/:workOrderId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("calculate cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { workOrderId } = req.params;
      // Parse-and-discard: the public schema does not currently expose the
      // emergency multipliers calculateWorkOrderSavings accepts. Validating
      // keeps the wire contract honest; we pass calculator defaults below.
      costSavingsCalculateOptionsSchema.parse(req.body);

      const calculation = await calculateWorkOrderSavings(workOrderId, orgId, {});

      if (!calculation) {
        return res.status(400).json({
          message:
            "No savings to calculate. This work order is not preventive/predictive maintenance.",
        });
      }

      res.json(calculation);
    })
  );

  app.post(
    "/api/cost-savings/process/:workOrderId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("process cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { workOrderId } = req.params;

      const result = await processWorkOrderCompletion(workOrderId, orgId);

      res.json(result);
    })
  );

  app.get(
    "/api/cost-savings",
    requireOrgId,
    withErrorHandling("fetch cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsListQuerySchema.parse(req.query);

      const { eq, and, sql } = await import("drizzle-orm");

      const conds = [eq(costSavings.orgId, orgId)];
      if (validatedQuery.equipmentId) {
        conds.push(eq(costSavings.equipmentId, validatedQuery.equipmentId));
      }

      const savings = await db
        .select()
        .from(costSavings)
        .where(and(...conds))
        .orderBy(sql`${costSavings.calculatedAt} DESC`)
        .limit(validatedQuery.limit);
      res.json(savings);
    })
  );

  app.get(
    "/api/cost-savings/equipment-financials",
    requireOrgId,
    withErrorHandling("fetch equipment financial summary", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { equipmentService } = await import("../equipment/service");
      const financials = await equipmentService.getEquipmentFinancialSummary(orgId);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      const savingsSummary = await getSavingsSummary(orgId, startDate, endDate);

      const assetROI =
        financials.totalFleetValue > 0
          ? ((savingsSummary.totalSavings + financials.totalCapitalRecovered) /
              financials.totalFleetValue) *
            100
          : 0;

      res.json({
        ...financials,
        assetROI: Math.round(assetROI * 100) / 100,
        totalMaintenanceSavings: savingsSummary.totalSavings,
      });
    })
  );

  app.patch(
    "/api/cost-savings/:id/validation",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("update savings validation status", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const userId = (req as AuthenticatedRequest).user?.id ?? "unknown";
      const { id } = req.params;
      const body = updateValidationStatusSchema.parse(req.body);

      const { eq, and } = await import("drizzle-orm");

      const [existing] = await db
        .select()
        .from(costSavings)
        .where(and(eq(costSavings.id, id), eq(costSavings.orgId, orgId)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: "Savings record not found" });
      }

      await updateSavingsValidationStatus(id, orgId, body.validationStatus, body.reason, userId);

      const [updated] = await db
        .select()
        .from(costSavings)
        .where(and(eq(costSavings.id, id), eq(costSavings.orgId, orgId)))
        .limit(1);

      res.json(updated);
    })
  );

  logger.info(
    "CostSavingsRoutes",
    "Registered: summary, trend, calculate, process, list, equipment-financials, validation"
  );
}
