/**
 * Advanced Inventory Management Engine
 *
 * BACKWARD COMPATIBILITY SHIM
 * This file re-exports from the modularized inventory-engine for existing imports.
 *
 * Original: 846 lines
 * Modularized into 7 files in server/inventory-engine/:
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
} from "./inventory-engine/index.js";

export {
  checkPartsAvailability,
  findPartSubstitutions,
  planMaintenanceCosts,
  optimizeInventoryLevels,
  evaluateSupplierPerformance,
} from "./inventory-engine/index.js";
