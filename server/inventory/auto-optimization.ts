/**
 * Auto-Optimization - Automatically loads historical data for inventory optimization
 * Eliminates need for clients to provide usage history
 */

import type { InventoryStorage } from "./storage";
import type { Part } from "@shared/schema";
import { optimizeInventoryLevels } from "../inventory";

/**
 * Load real historical part usage from recorded work-order consumption.
 *
 * Usage is aggregated from `work_order_parts` (quantity consumed, dated by
 * `usedAt` with a `createdAt` fallback) into monthly buckets via
 * `storage.getPartUsageHistory`. The requested `daysHistory` window is mapped to
 * whole months (≈30 days each, capped at 24). Parts with no recorded consumption
 * yield all-zero arrays and are later filtered out by the optimizer, so the
 * optimization runs only on real data — no simulated/estimated usage is produced.
 */
export async function loadPartUsageHistory(
  orgId: string,
  partNumbers: string[],
  daysHistory: number = 365,
  storage: InventoryStorage
): Promise<Record<string, number[]>> {
  const monthsBack = Math.max(1, Math.min(24, Math.round(daysHistory / 30)));
  return storage.getPartUsageHistory(partNumbers, orgId, monthsBack);
}

/**
 * Load cost parameters for parts
 */
export async function loadPartCosts(
  orgId: string,
  partNumbers: string[],
  storage: InventoryStorage
): Promise<Record<string, { orderingCost: number; holdingCostRate: number }>> {
  const costs: Record<string, { orderingCost: number; holdingCostRate: number }> = {};

  for (const partNo of partNumbers) {
    const part = await storage.getPartByNumber(partNo, orgId);

    // Estimate costs based on part data
    const baseOrderingCost = 50;
    const shippingEstimate = (part?.leadTimeDays || 7) > 14 ? 100 : 25;

    costs[partNo] = {
      orderingCost: baseOrderingCost + shippingEstimate,
      holdingCostRate: 0.2, // 20% annual holding cost
    };
  }

  return costs;
}

/**
 * Load current stock levels
 */
export async function loadCurrentStock(
  orgId: string,
  partNumbers: string[],
  storage: InventoryStorage
): Promise<Record<string, number>> {
  const currentStock: Record<string, number> = {};

  for (const partNo of partNumbers) {
    const stockRecords = await storage.getStockByParts([partNo], orgId);
    const totalStock = stockRecords.reduce((sum, stock) => sum + (stock.quantityOnHand ?? 0), 0);
    currentStock[partNo] = totalStock;
  }

  return currentStock;
}

/**
 * Auto-optimization: Loads all data automatically and optimizes
 */
export async function autoOptimizeInventory(
  orgId: string,
  partNumbers: string[],
  daysHistory: number,
  storage: InventoryStorage
): Promise<unknown[]> {
  // Load all data in parallel
  const [usageHistory, costs, currentStock] = await Promise.all([
    loadPartUsageHistory(orgId, partNumbers, daysHistory, storage),
    loadPartCosts(orgId, partNumbers, storage),
    loadCurrentStock(orgId, partNumbers, storage),
  ]);

  // Get parts
  const parts: Part[] = [];
  for (const partNo of partNumbers) {
    const part = await storage.getPartByNumber(partNo, orgId);
    if (part) {
      parts.push(part);
    }
  }

  // Filter parts with actual usage data
  const partsWithData = parts.filter((part) => {
    return usageHistory[part.partNo]?.some((qty) => qty > 0);
  });

  if (partsWithData.length === 0) {
    return [];
  }

  // Transform usage history to expected format
  const usageHistoryArray = Object.entries(usageHistory).map(([partNo, monthlyUsage]) => ({
    partNo,
    monthlyUsage,
  }));

  // Use average costs across all parts
  const firstPart = Object.keys(costs)[0] ?? "";
  const costParams = {
    orderingCost: costs[firstPart]?.orderingCost ?? 75,
    holdingCostRate: costs[firstPart]?.holdingCostRate ?? 0.2,
    stockoutCostRate: 0.5,
  };

  // Call optimization
  const results = optimizeInventoryLevels(
    partsWithData,
    usageHistoryArray,
    costParams,
    currentStock
  );

  // Enrich with metadata
  return results.map((result) => ({
    ...result,
    metadata: {
      dataQuality: {
        monthsOfData: usageHistory[result.partNo]?.filter((q) => q > 0).length || 0,
        totalHistoricalUsage: usageHistory[result.partNo]?.reduce((a, b) => a + b, 0) || 0,
        source: "work_order_parts",
      },
      autoLoaded: {
        usageHistory: true,
        costs: true,
        currentStock: true,
      },
      calculatedAt: new Date().toISOString(),
    },
  }));
}
