/**
 * Inventory Risk - Analyzer Class
 * Main InventoryRiskAnalyzer implementation
 */

import type { PartRiskScore, InventoryRiskSummary, EquipmentPartsRisk } from "./types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("InventoryRisk:Analyzer");

export interface InventoryRiskDeps {
  getPartsInventory(orgId: string, includeInactive?: boolean): Promise<any[]>;
  getEquipment(orgId: string, equipmentId: string): Promise<any>;
  getWorkOrderPartsByEquipment(orgId: string, equipmentId: string): Promise<any[]>;
  getPartById(orgId: string, partId: string): Promise<any>;
  getWorkOrderPartsByPartId(orgId: string, partId: string): Promise<any[]>;
  getWorkOrder(orgId: string, workOrderId: string): Promise<any>;
}
import {
  calculateSupplierRisk,
  buildRiskSummary,
  generatePartRecommendations,
  generateEquipmentRecommendations,
  calculateDowntimeCost,
  getRiskCategory,
} from "./calculators.js";

export class InventoryRiskAnalyzer {
  constructor(private storage: InventoryRiskDeps) {}

  async analyzeInventoryRisk(
    orgId: string,
    includeInactive: boolean = false
  ): Promise<InventoryRiskSummary> {
    logger.info(`[Inventory Risk] Analyzing inventory risk for org: ${orgId}`);

    const parts = await this.storage.getPartsInventory(orgId, includeInactive);
    if (parts.length === 0) {
      return this.createEmptyRiskSummary();
    }

    const partRisks = await Promise.all(parts.map((p) => this.calculatePartRisk(orgId, p)));
    const supplierConcentration = calculateSupplierRisk(partRisks);
    const summary = buildRiskSummary(partRisks, supplierConcentration);

    logger.info(`[Inventory Risk] Analysis complete - ${partRisks.length} parts, ${summary.riskDistribution.critical} critical`);
    return summary;
  }

  async analyzeEquipmentPartsRisk(
    orgId: string,
    equipmentId: string
  ): Promise<EquipmentPartsRisk | null> {
    logger.info(`[Inventory Risk] Analyzing parts risk for equipment: ${equipmentId}`);

    const equipment = await this.storage.getEquipment(orgId, equipmentId);
    if (!equipment) {
      return null;
    }

    const workOrderParts = await this.storage.getWorkOrderPartsByEquipment(orgId, equipmentId);
    if (workOrderParts.length === 0) {
      return this.createEmptyEquipmentRisk(equipment);
    }

    const uniquePartIds = [...new Set(workOrderParts.map((wp) => wp.partId))];
    const parts = await Promise.all(
      uniquePartIds.map((partId) => this.storage.getPartById(orgId, partId))
    );
    const activeParts = parts.filter((p) => p?.isActive);

    const partRisks = await Promise.all(activeParts.map((p) => this.calculatePartRisk(orgId, p)));
    return this.buildEquipmentRisk(equipment, partRisks);
  }

  async getCriticalParts(orgId: string, riskThreshold: number = 75): Promise<PartRiskScore[]> {
    logger.info(`[Inventory Risk] Finding critical parts with risk >= ${riskThreshold}`);

    const parts = await this.storage.getPartsInventory(orgId, false);
    if (parts.length === 0) {
      return [];
    }

    const partRisks = await Promise.all(parts.map((p) => this.calculatePartRisk(orgId, p)));
    return partRisks
      .filter((p) => p.overallRisk >= riskThreshold)
      .sort((a, b) => b.overallRisk - a.overallRisk);
  }

  private async calculatePartRisk(orgId: string, part: any): Promise<PartRiskScore> {
    const availableQuantity = part.quantityOnHand - part.quantityReserved;
    const stockRatio = part.minStockLevel > 0 ? availableQuantity / part.minStockLevel : 1;
    const stockoutRisk = Math.max(0, Math.min(100, (1 - stockRatio) * 100));
    const leadTimeRisk = Math.min(100, (part.leadTimeDays || 7) * 3);
    const supplierDependency = part.supplierName ? 70 : 20;
    const totalValue = part.unitCost * part.quantityOnHand;
    const financialRisk = Math.min(100, totalValue / 1000);
    const criticalEquipment = await this.getEquipmentUsingPart(orgId, part.id);
    const equipmentRisk = criticalEquipment.length * 10;

    const overallRisk =
      stockoutRisk * 0.35 +
      leadTimeRisk * 0.25 +
      supplierDependency * 0.2 +
      Math.min(financialRisk, 50) * 0.1 +
      Math.min(equipmentRisk, 50) * 0.1;

    return {
      partId: part.id,
      partNumber: part.partNumber,
      partName: part.partName,
      category: part.category,
      quantityOnHand: part.quantityOnHand,
      quantityReserved: part.quantityReserved,
      availableQuantity,
      minStockLevel: part.minStockLevel,
      maxStockLevel: part.maxStockLevel,
      stockoutRisk,
      leadTimeDays: part.leadTimeDays || 7,
      supplierName: part.supplierName,
      supplierDependency,
      unitCost: part.unitCost,
      totalValue,
      reorderCost: part.unitCost * (part.maxStockLevel - availableQuantity),
      criticalEquipment,
      equipmentCount: criticalEquipment.length,
      overallRisk: Math.round(overallRisk),
      riskCategory: getRiskCategory(overallRisk),
      recommendations: generatePartRecommendations(
        stockoutRisk,
        leadTimeRisk,
        supplierDependency,
        criticalEquipment.length
      ),
    };
  }

  private async getEquipmentUsingPart(orgId: string, partId: string): Promise<string[]> {
    try {
      const workOrderParts = await this.storage.getWorkOrderPartsByPartId(orgId, partId);
      const workOrderIds = [...new Set(workOrderParts.map((wp) => wp.workOrderId))];
      const equipmentIds: string[] = [];

      for (const workOrderId of workOrderIds) {
        const workOrder = await this.storage.getWorkOrder(orgId, workOrderId);
        if (workOrder?.equipmentId) {
          equipmentIds.push(workOrder.equipmentId);
        }
      }

      return [...new Set(equipmentIds)];
    } catch {
      return [];
    }
  }

  private buildEquipmentRisk(equipment: any, partRisks: PartRiskScore[]): EquipmentPartsRisk {
    const criticalParts = partRisks.filter(
      (p) => p.riskCategory === "critical" || p.riskCategory === "high"
    ).length;
    const partsAtRisk = partRisks.filter((p) => p.overallRisk > 50);
    const avgPartRisk = partRisks.reduce((s, p) => s + p.overallRisk, 0) / partRisks.length || 0;
    const maintenanceRisk = Math.min(100, avgPartRisk * 1.2);
    const downTimeRisk = Math.min(100, criticalParts * 20);
    const overallRisk = maintenanceRisk * 0.6 + downTimeRisk * 0.4;
    const partsValue = partRisks.reduce((s, p) => s + p.totalValue, 0);

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      equipmentType: equipment.type,
      totalParts: partRisks.length,
      criticalParts,
      partsAtRisk,
      maintenanceRisk: Math.round(maintenanceRisk),
      downTimeRisk: Math.round(downTimeRisk),
      overallRisk: Math.round(overallRisk),
      estimatedDowntimeCost: calculateDowntimeCost(equipment.type, overallRisk),
      partsValue,
      recommendations: generateEquipmentRecommendations(
        criticalParts,
        partsAtRisk.length,
        equipment.type
      ),
    };
  }

  private createEmptyRiskSummary(): InventoryRiskSummary {
    return {
      totalParts: 0,
      activeSuppliers: 0,
      totalValue: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      topRiskParts: [],
      criticalStockouts: [],
      highValueRisks: [],
      supplierConcentration: [],
    };
  }

  private createEmptyEquipmentRisk(equipment: any): EquipmentPartsRisk {
    return {
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      equipmentType: equipment.type,
      totalParts: 0,
      criticalParts: 0,
      partsAtRisk: [],
      maintenanceRisk: 10,
      downTimeRisk: 10,
      overallRisk: 10,
      estimatedDowntimeCost: 1000,
      partsValue: 0,
      recommendations: ["No parts usage history - consider preventive inventory planning"],
    };
  }
}
