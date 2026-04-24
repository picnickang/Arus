/**
 * Inventory Engine - Optimization
 *
 * EOQ, reorder point, and inventory level optimization.
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("InventoryEngine:Optimization");
import type { Part } from "@shared/schema";
import type {
  InventoryOptimization,
  UsageHistoryRecord,
  CostParameters,
  OptimizationOptions,
} from "./types.js";
import {
  inventoryOptimizationRuns,
  inventoryOptimizationSavings,
  inventoryCalculationErrors,
  getPartCountBucket,
} from "../observability/inventory-metrics.js";

/**
 * Calculate Economic Order Quantity (EOQ) for optimal inventory levels
 * @param annualDemand Annual demand for the part
 * @param orderingCost Cost per order
 * @param holdingCost Annual holding cost per unit
 * @returns Optimal order quantity
 */
export function calculateEOQ(
  annualDemand: number,
  orderingCost: number,
  holdingCost: number
): number {
  if (holdingCost <= 0) {
    return 0;
  }
  return Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
}

/**
 * Calculate reorder point considering lead time and safety stock
 * @param dailyDemand Average daily demand
 * @param leadTimeDays Lead time in days
 * @param serviceLevel Desired service level (0.95 = 95%)
 * @param demandVariability Coefficient of variation for demand
 * @returns Optimal reorder point
 */
export function calculateReorderPoint(
  dailyDemand: number,
  leadTimeDays: number,
  serviceLevel: number = 0.95,
  demandVariability: number = 0.2
): number {
  const zScore = serviceLevel === 0.95 ? 1.645 : serviceLevel === 0.99 ? 2.326 : 1.282;
  const leadTimeDemand = dailyDemand * leadTimeDays;
  const leadTimeDemandStdDev = Math.sqrt(leadTimeDays) * dailyDemand * demandVariability;
  const safetyStock = zScore * leadTimeDemandStdDev;

  return Math.ceil(leadTimeDemand + safetyStock);
}

/**
 * Optimize inventory levels for parts based on usage patterns
 *
 * BUG FIX: Now accepts ACTUAL current stock (not minStockQty)
 * BUG FIX: Handles zero-usage series gracefully (no NaN/Infinity)
 * ENHANCEMENT: Tunable service level and demand variability
 *
 * @param parts Array of parts to optimize
 * @param usageHistory Historical usage data
 * @param costs Cost parameters
 * @param currentStockByPart Map of partNo -> actual current stock quantity
 * @param opts Optional tunables for service level and variability
 * @returns Optimization recommendations sorted by potential savings
 */
export function optimizeInventoryLevels(
  parts: Part[],
  usageHistory: UsageHistoryRecord[],
  costs: CostParameters,
  currentStockByPart: Record<string, number>,
  opts?: OptimizationOptions
): InventoryOptimization[] {
  const serviceLevel = opts?.serviceLevel ?? 0.95;
  const defaultDemandVariability = opts?.demandVariability ?? 0.2;

  const partCountBucket = getPartCountBucket(parts.length);
  const optimizations: InventoryOptimization[] = [];
  let totalSavings = 0;

  for (const part of parts) {
    const usage = usageHistory.find((h) => h.partNo === part.partNo);

    if (!usage || usage.monthlyUsage.length === 0) {
      continue;
    }

    const monthlyDemand =
      usage.monthlyUsage.reduce((sum, m) => sum + m, 0) / usage.monthlyUsage.length;
    const annualDemand = monthlyDemand * 12;
    const dailyDemand = monthlyDemand / 30;

    if (annualDemand <= 0 || dailyDemand <= 0) {
      logger.warn(`[Inventory] Skipping ${part.partNo}: zero or negative demand (annual: ${annualDemand})`);
      inventoryCalculationErrors.inc({
        org_id: "system",
        error_type: "zero_demand",
        function: "optimizeInventoryLevels",
      });
      continue;
    }

    let demandVariability = defaultDemandVariability;
    if (monthlyDemand > 0) {
      const demandVariance =
        usage.monthlyUsage.reduce((sum, m) => sum + (m - monthlyDemand) ** 2, 0) /
        usage.monthlyUsage.length;
      const calculatedCV = Math.sqrt(demandVariance) / monthlyDemand;
      demandVariability = Number.isFinite(calculatedCV) ? calculatedCV : defaultDemandVariability;
    }

    const holdingCost = (part.standardCost ?? 0) * costs.holdingCostRate;
    const eoq = calculateEOQ(annualDemand, costs.orderingCost, holdingCost);
    const reorderPoint = calculateReorderPoint(
      dailyDemand,
      part.leadTimeDays ?? 30,
      serviceLevel,
      demandVariability
    );

    const currentStock = currentStockByPart[part.partNo] ?? 0;
    const optimalStock = Math.max(eoq, reorderPoint * 1.2);

    if (!Number.isFinite(eoq) || !Number.isFinite(reorderPoint) || !Number.isFinite(optimalStock)) {
      logger.warn(`[Inventory] Skipping ${part.partNo}: invalid calculations (EOQ: ${eoq}, ROP: ${reorderPoint})`);
      inventoryCalculationErrors.inc({
        org_id: "system",
        error_type: "nan_infinity",
        function: "optimizeInventoryLevels",
      });
      continue;
    }

    const currentHoldingCost = currentStock * holdingCost;
    const optimalHoldingCost = optimalStock * holdingCost;
    const potentialSavings = Math.abs(currentHoldingCost - optimalHoldingCost);

    let recommendation: InventoryOptimization["recommendation"] = "maintain";
    if (optimalStock > currentStock * 1.1) {
      recommendation = "increase";
    } else if (optimalStock < currentStock * 0.9) {
      recommendation = "decrease";
    }

    const roundedSavings = Math.round(potentialSavings);
    totalSavings += roundedSavings;

    optimizations.push({
      partNo: part.partNo,
      currentStock,
      optimalStock: Math.round(optimalStock),
      reorderPoint: Math.round(reorderPoint),
      economicOrderQuantity: Math.round(eoq),
      annualDemand,
      holdingCost,
      orderingCost: costs.orderingCost,
      stockoutCost: (part.standardCost ?? 0) * costs.stockoutCostRate,
      recommendation,
      potentialSavings: roundedSavings,
    });

    if (recommendation !== "maintain") {
      inventoryOptimizationSavings.observe(
        { org_id: "system", recommendation_type: recommendation },
        roundedSavings
      );
    }
  }

  inventoryOptimizationRuns.inc({ org_id: "system", part_count_bucket: partCountBucket });

  return optimizations.sort((a, b) => b.potentialSavings - a.potentialSavings);
}
