import type { IWorkOrderDemandRepository, WorkOrderPartDemand } from "../domain/ports";
import { inventoryService } from "../service";

export interface SmartReplenishmentSuggestion {
  partId: string;
  partNumber: string;
  partName: string;
  category: string;
  criticality: string;
  quantityOnHand: number;
  minStockLevel: number;
  maxStockLevel: number;
  suggestedOrderQty: number;
  supplierId?: string;
  supplierName?: string;
  leadTimeDays: number;
  estimatedCost: number;
  upcomingWOCount: number;
  upcomingWOIds: string[];
  urgencyScore: number;
}

export interface SmartReplenishmentResult {
  total: number;
  suggestions: SmartReplenishmentSuggestion[];
  estimatedTotalCost: number;
}

const CRITICALITY_WEIGHT: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

export class ReplenishmentSuggestionService {
  constructor(private workOrderDemandRepo: IWorkOrderDemandRepository) {}

  async getSmartSuggestions(orgId: string): Promise<SmartReplenishmentResult> {
    const [lowStockParts, demands] = await Promise.all([
      inventoryService.getLowStockParts(orgId),
      this.workOrderDemandRepo.getUpcomingDemand(orgId, 30),
    ]);

    const demandByPart = new Map<string, WorkOrderPartDemand[]>();
    for (const d of demands) {
      const existing = demandByPart.get(d.partId) || [];
      existing.push(d);
      demandByPart.set(d.partId, existing);
    }

    const suggestions: SmartReplenishmentSuggestion[] = lowStockParts.map((part: any) => {
      const currentQty = part.quantityOnHand || 0;
      const minLevel = part.minStockLevel || 0;
      const maxLevel = part.maxStockLevel || minLevel * 3 || 10;

      const partDemands = demandByPart.get(part.id) || [];
      const totalDemandQty = partDemands.reduce((sum, d) => sum + d.quantityRequired, 0);
      const uniqueWOIds = [...new Set(partDemands.map((d) => d.workOrderId))];

      const baseReorderQty = Math.max(1, maxLevel - currentQty);
      const demandAdjustedQty = Math.max(baseReorderQty, totalDemandQty + minLevel - currentQty);
      const suggestedOrderQty = Math.max(1, Math.ceil(demandAdjustedQty));

      const critWeight = CRITICALITY_WEIGHT[part.criticality] ?? 25;
      const stockDeficitRatio = minLevel > 0 ? Math.max(0, (minLevel - currentQty) / minLevel) : 0;
      const urgencyScore =
        critWeight +
        (uniqueWOIds.length * 20) +
        (stockDeficitRatio * 50) +
        (currentQty === 0 ? 30 : 0);

      return {
        partId: part.id,
        partNumber: part.partNumber,
        partName: part.partName,
        category: part.category,
        criticality: part.criticality ?? "medium",
        quantityOnHand: currentQty,
        minStockLevel: minLevel,
        maxStockLevel: maxLevel,
        suggestedOrderQty,
        supplierId: part.supplierId,
        supplierName: part.supplierName,
        leadTimeDays: part.leadTimeDays || 7,
        estimatedCost: suggestedOrderQty * (part.unitCost || 0),
        upcomingWOCount: uniqueWOIds.length,
        upcomingWOIds: uniqueWOIds,
        urgencyScore,
      };
    });

    suggestions.sort((a, b) => b.urgencyScore - a.urgencyScore);

    return {
      total: suggestions.length,
      suggestions,
      estimatedTotalCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
    };
  }
}
