/**
 * Inventory Engine - Stock Status
 * 
 * Stock status classification logic.
 */

import type { PartAvailability } from "./types.js";

/**
 * Calculate stock status based on current levels vs. min/max thresholds
 *
 * EDGE CASE HANDLING:
 * - minStock = 0: Use absolute thresholds instead of percentages
 * - maxStock = 0: Cannot classify as excess
 * - available <= 0: Always critical regardless of thresholds
 * - onOrder considered for status messaging but not status itself
 *
 * @param onHand Current quantity on hand
 * @param reserved Quantity reserved for work orders
 * @param minStock Minimum stock threshold
 * @param maxStock Maximum stock threshold
 * @returns Stock status classification
 */
export function calculateStockStatus(
  onHand: number,
  reserved: number,
  minStock: number,
  maxStock: number
): PartAvailability["stockStatus"] {
  const available = Math.max(0, onHand - reserved);

  if (available <= 0) { return "critical"; }

  if (minStock <= 0) {
    if (maxStock > 0 && available > Math.ceil(maxStock * 1.2)) {
      return "excess";
    }
    return available > 0 ? "adequate" : "critical";
  }

  if (available < Math.max(1, Math.floor(minStock * 0.5))) {
    return "critical";
  }

  if (available < minStock) {
    return "low";
  }

  if (maxStock > 0 && available > Math.ceil(maxStock * 1.2)) {
    return "excess";
  }

  return "adequate";
}
