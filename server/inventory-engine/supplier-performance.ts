/**
 * Inventory Engine - Supplier Performance
 *
 * Supplier evaluation and performance scoring.
 */

import type { Supplier } from "@shared/schema";
import type { SupplierPerformance, DeliveryHistoryRecord } from "./types.js";
import {
  inventorySupplierEvaluations,
  inventorySupplierScore,
} from "../observability/inventory-metrics.js";

/**
 * Evaluate supplier performance based on delivery and quality metrics
 * @param suppliers Array of suppliers to evaluate
 * @param deliveryHistory Historical delivery data
 * @returns Performance evaluation for each supplier
 */
export function evaluateSupplierPerformance(
  suppliers: Supplier[],
  deliveryHistory: DeliveryHistoryRecord[]
): SupplierPerformance[] {
  return suppliers
    .map((supplier) => {
      const supplierDeliveries = deliveryHistory.filter((d) => d.supplierId === supplier.id);

      if (supplierDeliveries.length === 0) {
        return {
          supplierId: supplier.id,
          name: supplier.name,
          onTimeDeliveryRate: 0,
          qualityRating: supplier.qualityRating ?? 0,
          averageLeadTime: supplier.leadTimeDays ?? 30,
          totalOrders: 0,
          performanceScore: 0,
          status: "inactive" as const,
        };
      }

      const onTimeDeliveries = supplierDeliveries.filter(
        (d) => d.deliveryDate <= d.expectedDeliveryDate
      ).length;
      const onTimeDeliveryRate = onTimeDeliveries / supplierDeliveries.length;

      const averageQuality =
        supplierDeliveries.reduce((sum, d) => sum + d.qualityScore, 0) / supplierDeliveries.length;

      const leadTimes = supplierDeliveries.map((d) => {
        return (d.deliveryDate.getTime() - d.orderDate.getTime()) / (1000 * 60 * 60 * 24);
      });
      const averageLeadTime = leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length;

      const baseline = supplier.leadTimeDays ?? 30;
      const leadTimeRatio = averageLeadTime / baseline;
      const clampedRatio = Math.max(0, Math.min(2, leadTimeRatio));
      const leadTimeScore = 1 - clampedRatio / 2;

      const performanceScore =
        (onTimeDeliveryRate * 0.4 +
          (averageQuality / 10) * 0.4 +
          Math.max(0, Math.min(1, leadTimeScore)) * 0.2) *
        100;

      let status: SupplierPerformance["status"] = "active";
      if (supplier.isPreferred) {
        status = "preferred";
      } else if (!supplier.isActive) {
        status = "inactive";
      } else if (performanceScore < 60) {
        status = "blacklisted";
      }

      const lastDeliveryDate =
        supplierDeliveries.length > 0
          ? new Date(Math.max(...supplierDeliveries.map((d) => d.deliveryDate.getTime())))
          : undefined;

      const result = {
        supplierId: supplier.id,
        name: supplier.name,
        onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 100) / 100,
        qualityRating: Math.round(averageQuality * 100) / 100,
        averageLeadTime: Math.round(averageLeadTime),
        totalOrders: supplierDeliveries.length,
        lastDeliveryDate,
        performanceScore: Math.round(performanceScore),
        status,
      };

      inventorySupplierEvaluations.inc({ org_id: "system", supplier_status: status });
      if (Number.isFinite(result.performanceScore)) {
        inventorySupplierScore.observe(
          { org_id: "system", supplier_id: supplier.id },
          result.performanceScore
        );
      }

      return result;
    })
    .sort((a, b) => b.performanceScore - a.performanceScore);
}
