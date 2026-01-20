/**
 * Inventory Risk - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type {
  PartRiskScore,
  InventoryRiskSummary,
  EquipmentPartsRisk,
  SupplierConcentration,
} from "./inventory-risk/index.js";

export {
  calculateSupplierRisk,
  buildRiskSummary,
  generatePartRecommendations,
  generateEquipmentRecommendations,
  calculateDowntimeCost,
  getRiskCategory,
  InventoryRiskAnalyzer,
} from "./inventory-risk/index.js";
