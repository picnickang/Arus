/**
 * Vessel Intelligence Pattern Analyzers
 *
 * Failure and maintenance pattern analysis functions.
 */

import type { EquipmentTelemetry, WorkOrder, MaintenanceSchedule } from "@shared/schema";
import type { VesselPattern } from "./types.js";
import {
  calculateAverageDaysBetween,
  identifyCorrelatedMetrics,
  generateFailureRecommendations,
  calculateAverageResolutionTime,
} from "./calculation-helpers.js";

export function analyzeFailurePatterns(
  workOrders: WorkOrder[],
  equipment: any[],
  telemetry: EquipmentTelemetry[]
): VesselPattern[] {
  const patterns: VesselPattern[] = [];

  const failureOrders = workOrders.filter(
    (wo) => (wo.type as any) === "corrective" || (wo.priority as any) === "critical" || (wo.priority as any) === "urgent"
  );

  const equipmentFailures = new Map<string, WorkOrder[]>();
  failureOrders.forEach((order) => {
    if (!equipmentFailures.has(order.equipmentId)) {
      equipmentFailures.set(order.equipmentId, []);
    }
    equipmentFailures.get(order.equipmentId)!.push(order);
  });

  equipmentFailures.forEach((orders, equipmentId) => {
    if (orders.length >= 2) {
      const eq = equipment.find((e) => e.id === equipmentId);
      const avgDaysBetween = calculateAverageDaysBetween(orders);

      const relatedTelemetry = telemetry.filter((t) => t.equipmentId === equipmentId);
      const correlatedMetrics = identifyCorrelatedMetrics(relatedTelemetry, orders);

      patterns.push({
        vesselId: orders[0].vesselId || "",
        patternType: "failure",
        description: `Recurring ${eq?.type || "equipment"} failures observed ${orders.length} times over ${Math.round(avgDaysBetween * orders.length)} days`,
        frequency: orders.length,
        confidence: Math.min(0.9, orders.length / 10),
        firstObserved: new Date(orders[orders.length - 1].createdAt as any),
        lastObserved: new Date(orders[0].createdAt as any),
        affectedEquipment: [equipmentId],
        correlatedMetrics,
        recommendedActions: generateFailureRecommendations(eq?.type, orders.length, avgDaysBetween),
      });
    }
  });

  return patterns;
}

export function analyzeMaintenancePatterns(
  schedules: MaintenanceSchedule[],
  workOrders: WorkOrder[]
): VesselPattern[] {
  const patterns: VesselPattern[] = [];

  const scheduledWork = workOrders.filter(
    (wo) => wo.type === "scheduled" || wo.type === "preventive"
  );

  if (scheduledWork.length > 0) {
    const adherenceRate =
      (scheduledWork.filter((wo) => wo.status === "completed").length / scheduledWork.length) * 100;
    const avgCompletionTime = calculateAverageResolutionTime(
      scheduledWork.filter((wo) => wo.status === "completed")
    );

    patterns.push({
      vesselId: scheduledWork[0].vesselId || "",
      patternType: "maintenance",
      description: `Scheduled maintenance adherence at ${adherenceRate.toFixed(1)}% with average completion time of ${avgCompletionTime} hours`,
      frequency: scheduledWork.length,
      confidence: adherenceRate > 80 ? 0.9 : 0.6,
      firstObserved: new Date(scheduledWork[scheduledWork.length - 1].createdAt as any),
      lastObserved: new Date(scheduledWork[0].createdAt as any),
      affectedEquipment: [...new Set(scheduledWork.map((wo) => wo.equipmentId))],
      correlatedMetrics: ["maintenance_schedule_adherence", "completion_time"],
      recommendedActions:
        adherenceRate < 80
          ? [
              "Improve maintenance scheduling",
              "Review resource allocation",
              "Consider predictive maintenance",
            ]
          : ["Continue current maintenance practices", "Optimize scheduling based on patterns"],
    });
  }

  return patterns;
}
