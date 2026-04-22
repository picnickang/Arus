import client from "prom-client";

/**
 * Advanced Inventory Management Prometheus Metrics
 *
 * Provides observability for inventory operations:
 * - Parts availability checks and performance
 * - Substitution lookups and savings tracking
 * - Cost planning and optimization recommendations
 * - Supplier performance scoring
 * - Stock status distribution and turnover
 */

// Availability checks processed
export const inventoryAvailabilityChecks = new client.Counter({
  name: "arus_inventory_availability_checks_total",
  help: "Total parts availability checks performed",
  labelNames: ["org_id", "batch_size_bucket"],
});

// Availability check duration (batch query performance)
export const inventoryAvailabilityDuration = new client.Histogram({
  name: "arus_inventory_availability_duration_ms",
  help: "Availability check duration in milliseconds (batched queries)",
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  labelNames: ["org_id", "batch_size_bucket"],
});

// Substitution lookups
export const inventorySubstitutionLookups = new client.Counter({
  name: "arus_inventory_substitution_lookups_total",
  help: "Total substitution lookups performed",
  labelNames: ["org_id", "result"],
});

// Substitution savings histogram (tracked when substitutions found)
export const inventorySubstitutionSavings = new client.Histogram({
  name: "arus_inventory_substitution_savings_dollars",
  help: "Potential savings from substitutions (dollars)",
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  labelNames: ["org_id", "substitution_type"],
});

// Cost planning operations
export const inventoryCostPlanningOps = new client.Counter({
  name: "arus_inventory_cost_planning_total",
  help: "Total cost planning operations performed",
  labelNames: ["org_id", "work_order_count_bucket"],
});

// Cost planning duration
export const inventoryCostPlanningDuration = new client.Histogram({
  name: "arus_inventory_cost_planning_duration_ms",
  help: "Cost planning operation duration in milliseconds",
  buckets: [50, 100, 250, 500, 1000, 2000, 4000],
  labelNames: ["org_id", "work_order_count_bucket"],
});

// Cost breakdown by category (gauge for latest snapshot)
export const inventoryCostBreakdown = new client.Gauge({
  name: "arus_inventory_cost_breakdown_dollars",
  help: "Current cost breakdown snapshot (labor/material/total)",
  labelNames: ["org_id", "cost_category"],
});

// Inventory optimization runs
export const inventoryOptimizationRuns = new client.Counter({
  name: "arus_inventory_optimization_runs_total",
  help: "Total inventory optimization runs",
  labelNames: ["org_id", "part_count_bucket"],
});

// Optimization potential savings
export const inventoryOptimizationSavings = new client.Histogram({
  name: "arus_inventory_optimization_savings_dollars",
  help: "Potential savings identified by inventory optimization",
  buckets: [10, 50, 100, 500, 1000, 5000, 10000],
  labelNames: ["org_id", "recommendation_type"],
});

// Supplier performance evaluations
export const inventorySupplierEvaluations = new client.Counter({
  name: "arus_inventory_supplier_evaluations_total",
  help: "Total supplier performance evaluations",
  labelNames: ["org_id", "supplier_status"],
});

// Supplier performance score distribution
export const inventorySupplierScore = new client.Histogram({
  name: "arus_inventory_supplier_performance_score",
  help: "Supplier performance scores (0-100)",
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  labelNames: ["org_id", "supplier_id"],
});

// Stock status distribution (current snapshot)
export const inventoryStockStatus = new client.Gauge({
  name: "arus_inventory_stock_status_count",
  help: "Count of parts in each stock status category",
  labelNames: ["org_id", "status"],
});

// EOQ/ROP calculation errors (edge cases)
export const inventoryCalculationErrors = new client.Counter({
  name: "arus_inventory_calculation_errors_total",
  help: "Total calculation errors (NaN, Infinity, zero-demand skips)",
  labelNames: ["org_id", "error_type", "function"],
});

// Currency conversion operations (cents safety tracking)
export const inventoryCurrencyOps = new client.Counter({
  name: "arus_inventory_currency_conversions_total",
  help: "Total currency conversions (toCents/toDollars)",
  labelNames: ["operation"],
});

/**
 * Helper to bucket batch sizes for metrics labels
 */
export function getBatchSizeBucket(count: number): string {
  if (count === 1) {
    return "single";
  }
  if (count <= 5) {
    return "1-5";
  }
  if (count <= 10) {
    return "6-10";
  }
  if (count <= 25) {
    return "11-25";
  }
  if (count <= 50) {
    return "26-50";
  }
  return "50+";
}

/**
 * Helper to bucket work order counts for metrics labels
 */
export function getWorkOrderCountBucket(count: number): string {
  if (count === 1) {
    return "single";
  }
  if (count <= 5) {
    return "1-5";
  }
  if (count <= 10) {
    return "6-10";
  }
  if (count <= 20) {
    return "11-20";
  }
  return "20+";
}

/**
 * Helper to bucket part counts for metrics labels
 */
export function getPartCountBucket(count: number): string {
  if (count <= 10) {
    return "1-10";
  }
  if (count <= 50) {
    return "11-50";
  }
  if (count <= 100) {
    return "51-100";
  }
  if (count <= 500) {
    return "101-500";
  }
  return "500+";
}
