/**
 * Inventory Risk - Main Entry Point
 * Re-exports all types and the analyzer class
 */

export type {
  PartRiskScore,
  InventoryRiskSummary,
  EquipmentPartsRisk,
  SupplierConcentration,
} from "./types.js";

export {
  calculateSupplierRisk,
  buildRiskSummary,
  generatePartRecommendations,
  generateEquipmentRecommendations,
  calculateDowntimeCost,
  getRiskCategory,
} from "./calculators.js";

export { InventoryRiskAnalyzer } from "./analyzer.js";
