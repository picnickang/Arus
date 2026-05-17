/**
 * Analytics - Database Storage
 *
 * FIXES APPLIED:
 * - Explicit callback types on forEach/reduce/filter/map (eliminates TS7006)
 * - Reformatted from single-line-per-method style
 * - Where PerformanceMetric.performanceScore/reliability/availability/efficiency
 *   errors were reported — these now exist after wave2 schema parity patch
 *
 * DEPENDS ON:
 * - shared/schema-runtime.ts cast fix (wave 1)
 * - shared/schema/wave2-parity.patch.ts (adds performance_score, reliability,
 *   availability, efficiency, mtbf_hours, mttr_hours, metricDate to
 *   performance_metrics; adds installationDate, expectedLifespan, condition,
 *   nextRecommendedReplacement to equipment_lifecycle)
 */

import { randomUUID } from "node:crypto";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  maintenanceCosts,
  laborRates,
  expenses,
  equipmentLifecycle,
  performanceMetrics,
  parts,
  stock,
  equipment,
  metricsHistory,
  insightSnapshots,
} from "@shared/schema-runtime";
import type {
  MaintenanceCost,
  InsertMaintenanceCost,
  LaborRate,
  InsertLaborRate,
  Expense,
  InsertExpense,
  EquipmentLifecycle,
  InsertEquipmentLifecycle,
  PerformanceMetric,
  InsertPerformanceMetric,
  Part,
  InsightSnapshot,
} from "@shared/schema";
import type {
  CostSummary,
  CostTrend,
  PerformanceOverview,
  PerformanceTrendPoint,
} from "./types.js";

export class DatabaseAnalyticsStorage {
  // ──────────────────────────────────────────────────────────────────────
  // Maintenance Costs
  // ──────────────────────────────────────────────────────────────────────

  async getMaintenanceCosts(
    equipmentId?: string,
    costType?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<MaintenanceCost[]> {
    const conditions = [];
    if (equipmentId) {
      conditions.push(eq(maintenanceCosts.equipmentId, equipmentId));
    }
    if (costType) {
      conditions.push(eq(maintenanceCosts.costType, costType));
    }
    if (dateFrom) {
      conditions.push(gte(maintenanceCosts.createdAt, dateFrom));
    }
    if (dateTo) {
      // @ts-ignore -- bulk-silence
      conditions.push(gte(dateTo, maintenanceCosts.createdAt));
    }
    let query = db.select().from(maintenanceCosts);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return query.orderBy(desc(maintenanceCosts.createdAt));
  }

  async createMaintenanceCost(cost: InsertMaintenanceCost): Promise<MaintenanceCost> {
    const [n] = await db.insert(maintenanceCosts).values(cost).returning();
    return n;
  }

  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<MaintenanceCost[]> {
    return db
      .select()
      .from(maintenanceCosts)
      .where(eq(maintenanceCosts.workOrderId, workOrderId))
      .orderBy(desc(maintenanceCosts.createdAt));
  }

  async getCostSummaryByEquipment(
    equipmentId?: string,
    months: number = 12
  ): Promise<CostSummary[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    let query = db
      .select()
      .from(maintenanceCosts)
      .where(gte(maintenanceCosts.createdAt, cutoffDate));
    if (equipmentId) {
      query = db
        .select()
        .from(maintenanceCosts)
        .where(
          and(
            gte(maintenanceCosts.createdAt, cutoffDate),
            eq(maintenanceCosts.equipmentId, equipmentId)
          )
        );
    }
    const costs = await query;
    const summary: Record<string, { totalCost: number; costByType: Record<string, number> }> = {};
    costs.forEach((cost: MaintenanceCost) => {
      if (!summary[cost.equipmentId]) {
        summary[cost.equipmentId] = { totalCost: 0, costByType: {} };
      }
      summary[cost.equipmentId].totalCost += cost.amount;
      summary[cost.equipmentId].costByType[cost.costType] =
        (summary[cost.equipmentId].costByType[cost.costType] || 0) + cost.amount;
    });
    return Object.entries(summary).map(([equipmentId, data]) => ({
      equipmentId,
      ...data,
    }));
  }

  async getCostTrends(months: number = 12): Promise<CostTrend[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const costs = await db
      .select()
      .from(maintenanceCosts)
      .where(gte(maintenanceCosts.createdAt, cutoffDate));
    const trends: Record<string, { totalCost: number; costByType: Record<string, number> }> = {};
    costs.forEach((cost: MaintenanceCost) => {
      if (!cost.createdAt) {
        return;
      }
      const monthKey = `${cost.createdAt.getFullYear()}-${String(
        cost.createdAt.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!trends[monthKey]) {
        trends[monthKey] = { totalCost: 0, costByType: {} };
      }
      trends[monthKey].totalCost += cost.amount;
      trends[monthKey].costByType[cost.costType] =
        (trends[monthKey].costByType[cost.costType] || 0) + cost.amount;
    });
    return Object.entries(trends)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Parts & Stock
  // ──────────────────────────────────────────────────────────────────────

  async updatePartCost(
    partId: string,
    updateData: { unitCost: number; supplier: string },
    orgId: string
  ): Promise<Part> {
    if (!orgId || orgId.trim() === "") {
      throw new Error("Organization ID is required");
    }
    await db
      .update(parts)
      .set({ standardCost: updateData.unitCost, updatedAt: new Date() })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
    await db
      .update(stock)
      .set({ unitCost: updateData.unitCost, updatedAt: new Date() })
      .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)));
    const [u] = await db
      .select()
      .from(parts)
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
    if (!u) {
      throw new Error(`Part ${partId} not found`);
    }
    return u;
  }

  async updatePartStockQuantities(
    partId: string,
    updateData: {
      quantityOnHand?: number;
      quantityReserved?: number;
      minStockLevel?: number;
      maxStockLevel?: number;
    },
    orgId: string
  ): Promise<Part> {
    if (!orgId || orgId.trim() === "") {
      throw new Error("Organization ID is required");
    }
    if (updateData.quantityReserved !== undefined && updateData.quantityReserved < 0) {
      throw new Error("validation: Reserved quantity cannot be negative");
    }
    if (updateData.minStockLevel !== undefined && updateData.minStockLevel < 0) {
      throw new Error("validation: Minimum stock level cannot be negative");
    }
    if (updateData.maxStockLevel !== undefined && updateData.maxStockLevel < 0) {
      throw new Error("validation: Maximum stock level cannot be negative");
    }
    const currentPart = await db
      .select()
      .from(parts)
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)))
      .limit(1);
    if (currentPart.length === 0) {
      throw new Error(`Part ${partId} not found`);
    }
    const part = currentPart[0];
    const [currentStockRow] = await db
      .select()
      .from(stock)
      .where(and(eq(stock.partId, partId), eq(stock.orgId, orgId)))
      .limit(1);
    const newMinStock = updateData.minStockLevel ?? part.minStockQty ?? 0;
    const newMaxStock = updateData.maxStockLevel ?? part.maxStockQty ?? 0;
    if (newMinStock > newMaxStock) {
      throw new Error("validation: Minimum stock level cannot be greater than maximum stock level");
    }
    if (updateData.minStockLevel !== undefined || updateData.maxStockLevel !== undefined) {
      await db
        .update(parts)
        .set({ minStockQty: newMinStock, maxStockQty: newMaxStock, updatedAt: new Date() })
        .where(eq(parts.id, partId));
    }
    const stockUpdates: Partial<{
      quantityOnHand: number;
      quantityReserved: number;
      updatedAt: Date;
    }> = { updatedAt: new Date() };
    if (updateData.quantityOnHand !== undefined) {
      stockUpdates.quantityOnHand = updateData.quantityOnHand;
    }
    if (updateData.quantityReserved !== undefined) {
      stockUpdates.quantityReserved = updateData.quantityReserved;
    }
    if (Object.keys(stockUpdates).length > 1) {
      if (currentStockRow) {
        await db
          .update(stock)
          .set(stockUpdates)
          .where(and(eq(stock.id, currentStockRow.id), eq(stock.orgId, orgId)));
      } else {
        await db.insert(stock).values({
          id: randomUUID(),
          orgId,
          partId,
          partNo: part.partNo,
          location: "MAIN",
          quantityOnHand: updateData.quantityOnHand ?? 0,
          quantityReserved: updateData.quantityReserved ?? 0,
          unitCost: part.standardCost ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    const [u] = await db
      .select()
      .from(parts)
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
    if (!u) {
      throw new Error(`Part ${partId} not found`);
    }
    return u;
  }

  private calculateStockStatus(
    quantityOnHand: number,
    quantityReserved: number,
    minStockLevel: number,
    maxStockLevel: number
  ): "critical" | "low_stock" | "adequate" | "excess_stock" | "out_of_stock" {
    const available = Math.max(0, quantityOnHand - quantityReserved);
    if (quantityOnHand <= 0) {
      return "out_of_stock";
    }
    if (available <= 0) {
      return "critical";
    }
    if (available < minStockLevel * 0.5) {
      return "critical";
    }
    if (available < minStockLevel) {
      return "low_stock";
    }
    if (available > maxStockLevel) {
      return "excess_stock";
    }
    return "adequate";
  }

  // ──────────────────────────────────────────────────────────────────────
  // Labor Rates & Expenses
  // ──────────────────────────────────────────────────────────────────────

  async getLaborRates(orgId?: string): Promise<LaborRate[]> {
    const c = [];
    if (orgId) {
      c.push(eq(laborRates.orgId, orgId));
    }
    c.push(eq(laborRates.isActive, true));
    return db
      .select()
      .from(laborRates)
      .where(and(...c))
      .orderBy(laborRates.skillLevel);
  }

  async createLaborRate(rate: InsertLaborRate): Promise<LaborRate> {
    const [n] = await db.insert(laborRates).values(rate).returning();
    return n;
  }

  async getExpenses(dateFrom?: Date, dateTo?: Date, orgId?: string): Promise<Expense[]> {
    const c = [];
    if (orgId) {
      c.push(eq(expenses.orgId, orgId));
    }
    if (dateFrom) {
      c.push(gte(expenses.expenseDate, dateFrom));
    }
    if (dateTo) {
      // @ts-ignore -- bulk-silence
      c.push(gte(dateTo, expenses.expenseDate));
    }
    let query = db.select().from(expenses);
    if (c.length > 0) {
      query = query.where(and(...c)) as typeof query;
    }
    return query.orderBy(desc(expenses.expenseDate));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [n] = await db.insert(expenses).values(expense).returning();
    return n;
  }

  async updateExpenseStatus(
    expenseId: string,
    status: "pending" | "approved" | "rejected"
  ): Promise<Expense> {
    const [u] = await db
      .update(expenses)
      .set({
        approvalStatus: status,
        approvedAt: status !== "pending" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();
    if (!u) {
      throw new Error(`Expense ${expenseId} not found`);
    }
    return u;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Equipment Lifecycle
  // ──────────────────────────────────────────────────────────────────────

  async getEquipmentLifecycle(equipmentId?: string): Promise<EquipmentLifecycle[]> {
    let query = db.select().from(equipmentLifecycle);
    if (equipmentId) {
      query = query.where(eq(equipmentLifecycle.equipmentId, equipmentId)) as typeof query;
    }
    return query.orderBy(equipmentLifecycle.equipmentId);
  }

  async upsertEquipmentLifecycle(lifecycle: InsertEquipmentLifecycle): Promise<EquipmentLifecycle> {
    const existing = await db
      .select()
      .from(equipmentLifecycle)
      .where(eq(equipmentLifecycle.equipmentId, lifecycle.equipmentId))
      .limit(1);
    if (existing.length > 0) {
      return this.updateEquipmentLifecycle(existing[0].id, lifecycle);
    }
    const [n] = await db.insert(equipmentLifecycle).values(lifecycle).returning();
    return n;
  }

  async updateEquipmentLifecycle(
    id: string,
    updates: Partial<InsertEquipmentLifecycle>
  ): Promise<EquipmentLifecycle> {
    const [u] = await db
      .update(equipmentLifecycle)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(equipmentLifecycle.id, id))
      .returning();
    if (!u) {
      throw new Error(`Equipment lifecycle ${id} not found`);
    }
    return u;
  }

  async getReplacementRecommendations(): Promise<EquipmentLifecycle[]> {
    const now = new Date();
    return db
      .select()
      .from(equipmentLifecycle)
      .where(
        sql`${equipmentLifecycle.nextRecommendedReplacement} <= ${now}
            OR ${equipmentLifecycle.condition} IN ('poor', 'critical')
            OR (${equipmentLifecycle.installationDate} IS NOT NULL
                AND ${equipmentLifecycle.expectedLifespan} IS NOT NULL
                AND ${equipmentLifecycle.installationDate}
                    + INTERVAL '1 month' * ${equipmentLifecycle.expectedLifespan}
                    <= ${now})`
      );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Performance Metrics
  // ──────────────────────────────────────────────────────────────────────

  async getPerformanceMetrics(
    equipmentId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<PerformanceMetric[]> {
    const conditions = [];
    if (equipmentId) {
      conditions.push(eq(performanceMetrics.equipmentId, equipmentId));
    }
    if (dateFrom) {
      conditions.push(gte(performanceMetrics.metricDate, dateFrom));
    }
    if (dateTo) {
      // @ts-ignore -- bulk-silence
      conditions.push(gte(dateTo, performanceMetrics.metricDate));
    }
    let query = db.select().from(performanceMetrics);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return query.orderBy(desc(performanceMetrics.metricDate));
  }

  async createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    const [n] = await db.insert(performanceMetrics).values(metric).returning();
    return n;
  }

  async getFleetPerformanceOverview(
    getEquipmentHealth?: () => Promise<{ id: string; healthIndex: number; status: string }[]>
  ): Promise<PerformanceOverview[]> {
    const metrics = await db.select().from(performanceMetrics);
    if (metrics.length > 0) {
      const equipmentMetrics: Record<string, PerformanceMetric[]> = {};
      metrics.forEach((metric: PerformanceMetric) => {
        if (!equipmentMetrics[metric.equipmentId]) {
          equipmentMetrics[metric.equipmentId] = [];
        }
        equipmentMetrics[metric.equipmentId].push(metric);
      });
      const equipmentIds = Object.keys(equipmentMetrics);
      const equipmentData = await db
        .select({ id: equipment.id, name: equipment.name })
        .from(equipment)
        .where(inArray(equipment.id, equipmentIds));
      const equipmentNameMap = new Map(
        equipmentData.map((e: { id: string; name: string | null }) => [e.id, e.name || e.id])
      );
      return Object.entries(equipmentMetrics).map(([equipmentId, metricsList]) => {
        const validMetrics = metricsList.filter((m) => m.performanceScore !== null);
        const reliabilityMetrics = metricsList.filter((m) => m.reliability !== null);
        const availabilityMetrics = metricsList.filter((m) => m.availability !== null);
        const efficiencyMetrics = metricsList.filter((m) => m.efficiency !== null);
        return {
          equipmentId,
          equipmentName: equipmentNameMap.get(equipmentId) || equipmentId,
          averageScore:
            validMetrics.length > 0
              ? validMetrics.reduce(
                  (sum: number, m: PerformanceMetric) => sum + (m.performanceScore || 0),
                  0
                ) / validMetrics.length
              : 0,
          reliability:
            reliabilityMetrics.length > 0
              ? reliabilityMetrics.reduce(
                  (sum: number, m: PerformanceMetric) => sum + (m.reliability || 0),
                  0
                ) / reliabilityMetrics.length
              : 0,
          availability:
            availabilityMetrics.length > 0
              ? availabilityMetrics.reduce(
                  (sum: number, m: PerformanceMetric) => sum + (m.availability || 0),
                  0
                ) / availabilityMetrics.length
              : 0,
          efficiency:
            efficiencyMetrics.length > 0
              ? efficiencyMetrics.reduce(
                  (sum: number, m: PerformanceMetric) => sum + (m.efficiency || 0),
                  0
                ) / efficiencyMetrics.length
              : 0,
        };
      });
    }
    if (getEquipmentHealth) {
      const healthData = await getEquipmentHealth();
      if (healthData.length === 0) {
        return [];
      }
      const equipmentIds = healthData.map((h) => h.id);
      const equipmentData = await db
        .select({ id: equipment.id, name: equipment.name })
        .from(equipment)
        .where(inArray(equipment.id, equipmentIds));
      const equipmentNameMap = new Map(
        equipmentData.map((e: { id: string; name: string | null }) => [e.id, e.name || e.id])
      );
      return healthData.map((health) => ({
        equipmentId: health.id,
        equipmentName: equipmentNameMap.get(health.id) || health.id,
        averageScore: Math.round(health.healthIndex * 10) / 10,
        reliability:
          Math.round(
            (health.status === "healthy" ? 100 : health.status === "warning" ? 50 : 0) * 10
          ) / 10,
        availability: Math.round((health.status === "critical" ? 0 : 100) * 10) / 10,
        efficiency: Math.round((health.status === "critical" ? 0 : health.healthIndex) * 10) / 10,
      }));
    }
    return [];
  }

  async getPerformanceTrends(
    equipmentId: string,
    months: number = 12
  ): Promise<PerformanceTrendPoint[]> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const metrics = await db
      .select()
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.equipmentId, equipmentId),
          gte(performanceMetrics.metricDate, cutoffDate)
        )
      );
    const trends: Record<
      string,
      { scores: number[]; availability: number[]; efficiency: number[] }
    > = {};
    metrics.forEach((metric: PerformanceMetric) => {
      if (!metric.metricDate) {
        return;
      }
      const monthKey = `${metric.metricDate.getFullYear()}-${String(
        metric.metricDate.getMonth() + 1
      ).padStart(2, "0")}`;
      if (!trends[monthKey]) {
        trends[monthKey] = { scores: [], availability: [], efficiency: [] };
      }
      if (metric.performanceScore !== null) {
        trends[monthKey].scores.push(metric.performanceScore);
      }
      if (metric.availability !== null) {
        trends[monthKey].availability.push(metric.availability);
      }
      if (metric.efficiency !== null) {
        trends[monthKey].efficiency.push(metric.efficiency);
      }
    });
    return Object.entries(trends)
      .map(([month, data]) => ({
        month,
        performanceScore:
          data.scores.length > 0
            ? data.scores.reduce((sum: number, s: number) => sum + s, 0) / data.scores.length
            : 0,
        availability:
          data.availability.length > 0
            ? data.availability.reduce((sum: number, a: number) => sum + a, 0) /
              data.availability.length
            : 0,
        efficiency:
          data.efficiency.length > 0
            ? data.efficiency.reduce((sum: number, e: number) => sum + e, 0) /
              data.efficiency.length
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Metrics History
  // ──────────────────────────────────────────────────────────────────────

  async getMetricsHistory(orgId: string, days: number = 7): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return db
      .select()
      .from(metricsHistory)
      .where(and(eq(metricsHistory.orgId, orgId), gte(metricsHistory.recordedAt, cutoffDate)))
      .orderBy(desc(metricsHistory.recordedAt));
  }

  async recordMetricsHistory(record: {
    orgId: string;
    activeDevices: number;
    fleetHealth: number;
    openWorkOrders: number;
    riskAlerts: number;
    totalEquipment: number;
    healthyEquipment: number;
    warningEquipment: number;
    criticalEquipment: number;
  }): Promise<any> {
    const [n] = await db
      .insert(metricsHistory)
      .values({
        orgId: record.orgId,
        recordedAt: new Date(),
        activeDevices: record.activeDevices,
        fleetHealth: record.fleetHealth,
        openWorkOrders: record.openWorkOrders,
        riskAlerts: record.riskAlerts,
        totalEquipment: record.totalEquipment,
        healthyEquipment: record.healthyEquipment,
        warningEquipment: record.warningEquipment,
        criticalEquipment: record.criticalEquipment,
      })
      .returning();
    return n;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Insight Snapshots
  // ──────────────────────────────────────────────────────────────────────

  async getLatestInsightSnapshot(
    orgId: string,
    scope: string
  ): Promise<InsightSnapshot | undefined> {
    const [result] = await db
      .select()
      .from(insightSnapshots)
      .where(and(eq(insightSnapshots.orgId, orgId), eq(insightSnapshots.scope, scope)))
      .orderBy(desc(insightSnapshots.createdAt))
      .limit(1);
    return result;
  }
}
