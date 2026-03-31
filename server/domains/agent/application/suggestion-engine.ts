import { db } from "../../../db";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import {
  equipment, alertNotifications, failurePredictions, maintenanceSchedules,
} from "@shared/schema";
import type { AgentRepositoryPort } from "../domain/ports";

export class SuggestionEngine {
  constructor(private repo: AgentRepositoryPort) {}

  async generateProactiveSuggestions(orgId: string): Promise<number> {
    let generated = 0;

    const highRiskPredictions = await db.select({
      equipmentId: failurePredictions.equipmentId,
      failureMode: failurePredictions.failureMode,
      failureProbability: failurePredictions.failureProbability,
      riskLevel: failurePredictions.riskLevel,
      predictedFailureDate: failurePredictions.predictedFailureDate,
    }).from(failurePredictions)
      .where(and(
        eq(failurePredictions.orgId, orgId),
        gte(failurePredictions.predictionTimestamp, new Date(Date.now() - 86400000)),
      ))
      .orderBy(desc(failurePredictions.failureProbability))
      .limit(10);

    for (const pred of highRiskPredictions) {
      if (pred.failureProbability >= 0.7) {
        await this.repo.suggestions.create({
          orgId,
          triggerType: "high_risk_prediction",
          title: `High failure risk: ${pred.failureMode || "Unknown"} on ${pred.equipmentId}`,
          summary: `Failure probability ${(pred.failureProbability * 100).toFixed(0)}% (${pred.riskLevel}). Predicted failure: ${pred.predictedFailureDate ? new Date(pred.predictedFailureDate).toLocaleDateString() : "Unknown"}.`,
          entityType: "equipment",
          entityId: pred.equipmentId,
          severity: pred.failureProbability >= 0.9 ? "critical" : "warning",
          status: "pending",
          context: { prediction: pred },
        });
        generated++;
      }
    }

    const overdueMaint = await db.select({
      id: maintenanceSchedules.id,
      equipmentId: maintenanceSchedules.equipmentId,
      scheduledDate: maintenanceSchedules.scheduledDate,
      maintenanceType: maintenanceSchedules.maintenanceType,
      description: maintenanceSchedules.description,
    }).from(maintenanceSchedules)
      .where(and(
        eq(maintenanceSchedules.orgId, orgId),
        eq(maintenanceSchedules.status, "scheduled"),
        lte(maintenanceSchedules.scheduledDate, new Date()),
      ))
      .limit(10);

    for (const maint of overdueMaint) {
      await this.repo.suggestions.create({
        orgId,
        triggerType: "overdue_maintenance",
        title: `Overdue maintenance: ${maint.maintenanceType} on ${maint.equipmentId}`,
        summary: `${maint.description || maint.maintenanceType} was scheduled for ${new Date(maint.scheduledDate).toLocaleDateString()} and is now overdue.`,
        entityType: "maintenance_schedule",
        entityId: maint.id,
        severity: "warning",
        status: "pending",
        context: { schedule: maint },
      });
      generated++;
    }

    try {
      const lowStockResult = await db.execute(sql`
        SELECT id, part_name, quantity_on_hand, min_stock_level
        FROM parts_inventory
        WHERE org_id = ${orgId} AND quantity_on_hand <= min_stock_level
        LIMIT 5
      `);
      const lowStockRows = (lowStockResult as { rows?: Array<Record<string, unknown>> }).rows || [];

      for (const part of lowStockRows) {
        await this.repo.suggestions.create({
          orgId,
          triggerType: "low_stock",
          title: `Low stock: ${part.part_name}`,
          summary: `Current stock ${part.quantity_on_hand} is at or below minimum level ${part.min_stock_level}. Reorder recommended.`,
          entityType: "inventory",
          entityId: part.id as string,
          severity: "info",
          status: "pending",
          context: { part },
        });
        generated++;
      }
    } catch (err) {
      console.warn("[SuggestionEngine] Low stock query failed:", err instanceof Error ? err.message : "unknown");
    }

    console.log(`[SuggestionEngine] Generated ${generated} suggestions for org ${orgId}`);
    return generated;
  }
}
