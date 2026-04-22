/**
 * Inventory Risk - Risk Calculators
 * Pure functions for risk calculations and recommendations
 */

import type { PartRiskScore, SupplierConcentration, InventoryRiskSummary } from "./types.js";

/**
 * Calculate supplier concentration risk from part risks
 */
export function calculateSupplierRisk(partRisks: PartRiskScore[]): SupplierConcentration[] {
  const supplierMap = new Map<
    string,
    { partCount: number; totalValue: number; parts: PartRiskScore[] }
  >();

  partRisks.forEach((part) => {
    const supplier = part.supplierName || "Unknown Supplier";
    if (!supplierMap.has(supplier)) {
      supplierMap.set(supplier, { partCount: 0, totalValue: 0, parts: [] });
    }
    const data = supplierMap.get(supplier)!;
    data.partCount++;
    data.totalValue += part.totalValue;
    data.parts.push(part);
  });

  return Array.from(supplierMap.entries())
    .map(([supplierName, data]) => {
      const concentrationRisk = Math.min(100, (data.partCount / partRisks.length) * 200);
      return {
        supplierName,
        partCount: data.partCount,
        totalValue: data.totalValue,
        riskScore: Math.round(concentrationRisk),
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Build risk summary from part risks
 */
export function buildRiskSummary(
  partRisks: PartRiskScore[],
  supplierConcentration: SupplierConcentration[]
): InventoryRiskSummary {
  const riskDistribution = partRisks.reduce(
    (acc, part) => {
      acc[part.riskCategory]++;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 }
  );

  const sortedRisks = partRisks.sort((a, b) => b.overallRisk - a.overallRisk);

  return {
    totalParts: partRisks.length,
    activeSuppliers: supplierConcentration.length,
    totalValue: partRisks.reduce((sum, part) => sum + part.totalValue, 0),
    riskDistribution,
    topRiskParts: sortedRisks.slice(0, 10),
    criticalStockouts: partRisks.filter((p) => p.availableQuantity <= 0),
    highValueRisks: partRisks
      .filter((p) => p.totalValue > 5000)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5),
    supplierConcentration,
  };
}

/**
 * Generate part recommendations based on risk factors
 */
export function generatePartRecommendations(
  stockoutRisk: number,
  leadTimeRisk: number,
  supplierDependency: number,
  equipmentCount: number
): string[] {
  const recommendations: string[] = [];

  if (stockoutRisk > 70) {
    recommendations.push("URGENT: Order parts immediately - stock critically low");
  } else if (stockoutRisk > 40) {
    recommendations.push("Monitor stock levels closely and consider reordering");
  }

  if (leadTimeRisk > 60) {
    recommendations.push("Consider alternative suppliers with shorter lead times");
  }

  if (supplierDependency > 60) {
    recommendations.push("Identify backup suppliers to reduce dependency risk");
  }

  if (equipmentCount > 3) {
    recommendations.push("Critical part used by multiple equipment - increase safety stock");
  }

  if (recommendations.length === 0) {
    recommendations.push("Part inventory levels are acceptable");
  }

  return recommendations;
}

/**
 * Generate equipment recommendations
 */
export function generateEquipmentRecommendations(
  criticalParts: number,
  partsAtRisk: number,
  equipmentType: string
): string[] {
  const recommendations: string[] = [];

  if (criticalParts > 0) {
    recommendations.push(`${criticalParts} critical parts need immediate attention`);
  }

  if (partsAtRisk > 5) {
    recommendations.push("Multiple parts at risk - consider comprehensive maintenance review");
  }

  if (equipmentType === "engine" || equipmentType === "generator") {
    recommendations.push("Mission-critical equipment - maintain higher safety stock levels");
  }

  if (recommendations.length === 0) {
    recommendations.push("Parts inventory risk is manageable for this equipment");
  }

  return recommendations;
}

/**
 * Estimate downtime cost based on equipment type and risk
 */
export function calculateDowntimeCost(equipmentType: string, riskScore: number): number {
  const baseCosts: Record<string, number> = {
    engine: 5000,
    generator: 3000,
    pump: 1500,
    compressor: 2000,
    hvac: 500,
    navigation: 2500,
    winch: 1000,
    crane: 2000,
  };

  const baseCost = baseCosts[equipmentType.toLowerCase()] || 1000;
  const riskMultiplier = 1 + riskScore / 100;

  return Math.round(baseCost * riskMultiplier * 8);
}

/**
 * Determine risk category from overall risk score
 */
export function getRiskCategory(overallRisk: number): "low" | "medium" | "high" | "critical" {
  if (overallRisk >= 80) {
    return "critical";
  }
  if (overallRisk >= 60) {
    return "high";
  }
  if (overallRisk >= 30) {
    return "medium";
  }
  return "low";
}
