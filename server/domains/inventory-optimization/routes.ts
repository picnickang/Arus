// @ts-nocheck
/**
 * Inventory Optimization Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Advanced inventory optimization, cost planning, and supplier performance
 * Refactored using Extract Method pattern per SonarQube guidance
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { sendBadRequest } from "../../lib/api-helpers";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { dbInventoryStorage } from "../../db/inventory/index.js";
import { workOrderService } from "../../repositories.js";

interface InventoryOptimizationDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
}

export function registerInventoryOptimizationRoutes(
  app: Express,
  deps: InventoryOptimizationDependencies
): void {
  const { generalApiRateLimit, writeOperationRateLimit } = deps;

  app.post(
    "/api/parts/:id/sync-costs-legacy",
    writeOperationRateLimit,
    withErrorHandling("sync part costs", async (req, res) => {
      const { id } = req.params;
      try {
        await dbInventoryStorage.syncPartCostToStock(id);
        res.json({
          success: true,
          message: "Cost synchronization completed successfully",
          partId: id,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return sendNotFound(res, "Part");
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/inventory/cost-planning",
    generalApiRateLimit,
    withErrorHandling("plan maintenance costs", async (req, res) => {
      const { workOrderIds } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      const allOrders = await workOrderService.getWorkOrdersWithDetails(undefined, orgId);
      const workOrderIdSet = new Set(workOrderIds as string[]);
      const validWorkOrders = allOrders.filter((wo) => workOrderIdSet.has(wo.id));

      const { planMaintenanceCosts } = await import("../../inventory");
      const costPlan = await planMaintenanceCosts(validWorkOrders, dbInventoryStorage, orgId);

      res.json(costPlan);
    })
  );

  app.get(
    "/api/inventory/substitutions/:partNo",
    generalApiRateLimit,
    async (req: Request, res: Response, next) => {
      const { cacheMiddleware } = await import("../../middleware/cache-middleware");
      return cacheMiddleware({
        ttl: 900,
        keyGenerator: (r: Request) =>
          `substitutions:${r.params.partNo}:${(r as AuthenticatedRequest).orgId}`,
      })(req, res, next);
    },
    withErrorHandling("find part substitutions", async (req, res) => {
      const { partNo } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;

      const { findPartSubstitutions } = await import("../../inventory");
      const substitutions = await findPartSubstitutions(partNo, dbInventoryStorage, orgId);

      res.json(substitutions);
    })
  );

  app.post(
    "/api/inventory/optimize",
    generalApiRateLimit,
    withErrorHandling("optimize inventory levels", async (req, res) => {
      const { partNumbers, usageHistory, costs, currentStock, options } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!partNumbers || !usageHistory || !costs) {
        return sendBadRequest(res, "Missing required fields: partNumbers, usageHistory, costs");
      }

      const parts = await Promise.all(
        partNumbers.map((partNo: string) =>
          orgId ? dbInventoryStorage.getPartByPartNumber(partNo, orgId) : Promise.resolve(undefined)
        )
      );
      const validParts = parts.filter((p) => p !== null);

      const usageHistoryArray = Object.entries(usageHistory).map(([partNo, monthlyUsage]) => ({
        partNo,
        monthlyUsage: monthlyUsage as number[],
      }));

      const currentStockByPart: Record<string, number> = currentStock ?? {};

      const firstPart = Object.keys(costs)[0];
      const costParams = {
        orderingCost: costs[firstPart]?.ordering || costs.orderingCost || 25,
        holdingCostRate: costs[firstPart]?.holding || costs.holdingCostRate || 0.1,
        stockoutCostRate: costs.stockoutCostRate || 0.5,
      };

      const { optimizeInventoryLevels } = await import("../../inventory");
      const optimizations = optimizeInventoryLevels(
        validParts,
        usageHistoryArray,
        costParams,
        currentStockByPart,
        options
      );

      res.json(optimizations);
    })
  );

  app.post(
    "/api/inventory/optimize/auto",
    generalApiRateLimit,
    withErrorHandling("auto-optimize inventory", async (req, res) => {
      const { partNumbers, daysHistory } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!partNumbers || !Array.isArray(partNumbers)) {
        return sendBadRequest(
          res,
          "Missing or invalid required field: partNumbers (must be an array)"
        );
      }

      if (partNumbers.length > 100) {
        return sendBadRequest(res, "Too many parts requested. Maximum 100 parts per request.");
      }

      const days =
        daysHistory && typeof daysHistory === "number"
          ? Math.min(Math.max(30, daysHistory), 730)
          : 365;

      const { autoOptimizeInventory } = await import("../../inventory/auto-optimization");
      const results = await autoOptimizeInventory(orgId, partNumbers, days, dbInventoryStorage);

      if (results.length === 0) {
        res.status(400).json({
          error: "Insufficient usage data for optimization",
          details: {
            message: "No parts have usage history in the specified period",
            requestedParts: partNumbers.length,
            daysAnalyzed: days,
          },
        });
        return;
      }

      res.json({
        success: true,
        optimizations: results,
        summary: {
          partsAnalyzed: results.length,
          daysHistory: days,
          timestamp: new Date().toISOString(),
        },
      });
    })
  );

  app.post(
    "/api/inventory/suppliers/performance",
    generalApiRateLimit,
    withErrorHandling("analyze supplier performance", async (req, res) => {
      const { supplierIds, dateRange } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      const { analyzeSupplierPerformance } = await import("../../inventory/supplier-analytics");
      const performance = await analyzeSupplierPerformance(
        orgId,
        supplierIds,
        dateRange,
        dbInventoryStorage
      );

      res.json(performance);
    })
  );

  logger.info(
    "InventoryOptimizationRoutes",
    "Registered (cost-planning: 2, substitutions: 1, optimize: 2, suppliers: 1)"
  );
}
