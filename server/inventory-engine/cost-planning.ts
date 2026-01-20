/**
 * Inventory Engine - Cost Planning
 * 
 * Maintenance cost planning and recommendations.
 */

import type { WorkOrder } from "@shared/schema-runtime";
import type { InventoryStorage } from "../inventory/storage.js";
import type { CostPlanningResult } from "./types.js";
import { toCents, toDollars } from "../../shared/money-utils.js";
import { checkPartsAvailability, findPartSubstitutions } from "./availability.js";
import {
  inventoryCostPlanningOps,
  inventoryCostPlanningDuration,
  inventoryCostBreakdown,
  inventorySubstitutionSavings,
  getWorkOrderCountBucket,
} from "../observability/inventory-metrics.js";

/**
 * Comprehensive cost planning for maintenance tasks
 *
 * CURRENCY SAFETY: All monetary arithmetic uses cents (integers) internally
 * Returns dollars in API response to maintain external contract
 *
 * BUG FIX: Substitution savings now compares SUBSTITUTE cost vs ORIGINAL cost
 * Old code compared original vs itself (always zero savings)
 *
 * @param workOrders Array of work orders to analyze
 * @param storage Typed storage interface
 * @param orgId Organization ID
 * @returns Detailed cost planning with recommendations (costs in dollars)
 */
export async function planMaintenanceCosts(
  workOrders: WorkOrder[],
  storage: InventoryStorage,
  orgId: string
): Promise<CostPlanningResult> {
  const startTime = Date.now();
  const woCountBucket = getWorkOrderCountBucket(workOrders.length);

  try {
    let totalCostCents = 0;
    let laborCostCents = 0;
    let materialCostCents = 0;
    const breakdown: CostPlanningResult["breakdown"] = [];
    const recommendations: CostPlanningResult["recommendations"] = [];

    for (const workOrder of workOrders) {
      const requiredParts = await storage.getWorkOrderParts(workOrder.id, orgId);
      const worklogs = await storage.getWorkOrderWorklogs(workOrder.id);

      const taskLaborHours = worklogs.reduce((sum, log) => sum + log.durationMinutes / 60, 0);
      const averageLaborRate =
        worklogs.length > 0
          ? worklogs.reduce((sum, log) => sum + log.laborCostPerHour, 0) / worklogs.length
          : 75;
      const taskLaborCostCents = toCents(taskLaborHours * averageLaborRate);

      const partCosts: CostPlanningResult["breakdown"][0]["partCosts"] = [];
      let taskMaterialCostCents = 0;

      for (const requiredPart of requiredParts) {
        const part = await storage.getPartByNumber(requiredPart.partNo, orgId);
        const availability = await checkPartsAvailability([requiredPart.partNo], storage, orgId);
        const partAvail = availability[0];

        const quantity = requiredPart.quantity ?? 1;
        const unitCostCents = toCents(part?.standardCost ?? 0);
        const totalPartCostCents = unitCostCents * quantity;

        let availabilityStatus: CostPlanningResult["breakdown"][0]["partCosts"][0]["availability"] =
          "available";
        let leadTime: number | undefined;

        if (partAvail.available < quantity) {
          if (partAvail.onHand === 0) {
            availabilityStatus = "out_of_stock";
          } else {
            availabilityStatus = "low_stock";
          }

          const substitutions = await findPartSubstitutions(requiredPart.partNo, storage, orgId);
          const availableSubstitute = substitutions.find((sub) => sub.available >= quantity);

          if (availableSubstitute) {
            availabilityStatus = "substitute_required";

            const substitutePart = await storage.getPartByNumber(availableSubstitute.partNo, orgId);
            const substituteCostCents = toCents(
              substitutePart?.standardCost || unitCostCents / 100
            );

            const savingsCents = Math.max(0, (unitCostCents - substituteCostCents) * quantity);

            if (savingsCents > 0) {
              const savingsDollars = toDollars(savingsCents);
              recommendations.push({
                type: "substitution",
                description: `Use ${availableSubstitute.partNo} (${availableSubstitute.name}) as substitute for ${requiredPart.partNo}`,
                potentialSavings: savingsDollars,
                riskLevel: availableSubstitute.substitutionType === "equivalent" ? "low" : "medium",
              });
              inventorySubstitutionSavings.observe(
                { org_id: orgId, substitution_type: availableSubstitute.substitutionType },
                savingsDollars
              );
            }
          } else {
            leadTime = partAvail.leadTimeDays;
            recommendations.push({
              type: "expedited_delivery",
              description: `Expedite delivery of ${requiredPart.partNo} - current lead time: ${leadTime} days`,
              riskLevel: "medium",
            });
          }
        }

        partCosts.push({
          partNo: requiredPart.partNo,
          name: part?.name || "Unknown Part",
          quantity,
          unitCost: toDollars(unitCostCents),
          totalCost: toDollars(totalPartCostCents),
          availability: availabilityStatus,
          leadTime,
        });

        taskMaterialCostCents += totalPartCostCents;
      }

      const taskTotalCostCents = taskLaborCostCents + taskMaterialCostCents;

      breakdown.push({
        taskId: workOrder.id,
        description: workOrder.description || `Work Order ${workOrder.id}`,
        partCosts,
        laborHours: taskLaborHours,
        laborRate: averageLaborRate,
        taskLaborCost: toDollars(taskLaborCostCents),
        taskMaterialCost: toDollars(taskMaterialCostCents),
        taskTotalCost: toDollars(taskTotalCostCents),
      });

      totalCostCents += taskTotalCostCents;
      laborCostCents += taskLaborCostCents;
      materialCostCents += taskMaterialCostCents;
    }

    const allParts = breakdown.flatMap((task) => task.partCosts);
    const partQuantities = allParts.reduce(
      (acc, part) => {
        acc[part.partNo] = (acc[part.partNo] ?? 0) + part.quantity;
        return acc;
      },
      {} as Record<string, number>
    );

    for (const [partNo, totalQuantity] of Object.entries(partQuantities)) {
      if (totalQuantity >= 10) {
        const partInfo = allParts.find((p) => p.partNo === partNo);
        const bulkSavingsCents = partInfo ? toCents(partInfo.unitCost) * totalQuantity * 0.1 : 0;

        recommendations.push({
          type: "bulk_purchase",
          description: `Consider bulk purchase of ${partNo} (total needed: ${totalQuantity})`,
          potentialSavings: toDollars(Math.round(bulkSavingsCents)),
          riskLevel: "low",
        });
      }
    }

    const result = {
      totalCost: toDollars(totalCostCents),
      laborCost: toDollars(laborCostCents),
      materialCost: toDollars(materialCostCents),
      breakdown,
      recommendations,
    };

    inventoryCostBreakdown.set({ org_id: orgId, cost_category: "total" }, result.totalCost);
    inventoryCostBreakdown.set({ org_id: orgId, cost_category: "labor" }, result.laborCost);
    inventoryCostBreakdown.set({ org_id: orgId, cost_category: "material" }, result.materialCost);

    return result;
  } finally {
    const duration = Date.now() - startTime;
    inventoryCostPlanningOps.inc({ org_id: orgId, work_order_count_bucket: woCountBucket });
    inventoryCostPlanningDuration.observe(
      { org_id: orgId, work_order_count_bucket: woCountBucket },
      duration
    );
  }
}
