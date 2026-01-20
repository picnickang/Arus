/**
 * Inventory Engine - Index
 * 
 * Modularized Inventory Management Engine
 * 
 * Original: 846 lines (server/inventory.ts)
 * Modularized into 7 files:
 * - types.ts (~95 lines): Type definitions
 * - stock-status.ts (~50 lines): Stock status classification
 * - availability.ts (~190 lines): Parts availability and substitutions
 * - cost-planning.ts (~200 lines): Maintenance cost planning
 * - optimization.ts (~170 lines): EOQ and inventory optimization
 * - supplier-performance.ts (~115 lines): Supplier evaluation
 * - index.ts (~45 lines): Aggregator
 */

export type {
  PartAvailability,
  SupplierPerformance,
  CostPlanningResult,
  InventoryOptimization,
  DeliveryHistoryRecord,
  UsageHistoryRecord,
  CostParameters,
  OptimizationOptions,
} from "./types.js";

export { calculateStockStatus } from "./stock-status.js";

export { checkPartsAvailability, findPartSubstitutions } from "./availability.js";

export { planMaintenanceCosts } from "./cost-planning.js";

export { calculateEOQ, calculateReorderPoint, optimizeInventoryLevels } from "./optimization.js";

export { evaluateSupplierPerformance } from "./supplier-performance.js";
