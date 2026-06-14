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

import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  maintenanceCosts,
  equipmentLifecycle,
  performanceMetrics,
  equipment,
} from "@shared/schema-runtime";
import type {
  MaintenanceCost,
  InsertMaintenanceCost,
  EquipmentLifecycle,
  InsertEquipmentLifecycle,
  PerformanceMetric,
  InsertPerformanceMetric,
} from "@shared/schema";
import type {
  CostSummary,
  CostTrend,
  PerformanceOverview,
  PerformanceTrendPoint,
} from "./types.js";
import {
  createExpense,
  createLaborRate,
  getExpenses,
  getLaborRates,
  updateExpenseStatus,
  updatePartCost,
  updatePartStockQuantities,
} from "./db-analytics-finance-inventory.js";
import {
  getLatestInsightSnapshot,
  getMetricsHistory,
  recordMetricsHistory,
} from "./db-analytics-history.js";

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
      conditions.push(lte(maintenanceCosts.createdAt, dateTo));
    }
    let query = db.select().from(maintenanceCosts).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    return query.orderBy(desc(maintenanceCosts.createdAt));
  }

  async createMaintenanceCost(cost: InsertMaintenanceCost): Promise<MaintenanceCost> {
    const [n] = await db.insert(maintenanceCosts).values(cost).returning();
    if (!n) {
      throw new Error("createMaintenanceCost: no row returned");
    }
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
      let entry = summary[cost.equipmentId];
      if (!entry) {
        entry = { totalCost: 0, costByType: {} };
        summary[cost.equipmentId] = entry;
      }
      entry.totalCost += cost.amount;
      entry.costByType[cost.costType] = (entry.costByType[cost.costType] || 0) + cost.amount;
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
  ): ReturnType<typeof updatePartCost> {
    return updatePartCost(partId, updateData, orgId);
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
  ): ReturnType<typeof updatePartStockQuantities> {
    return updatePartStockQuantities(partId, updateData, orgId);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Labor Rates & Expenses
  // ──────────────────────────────────────────────────────────────────────

  async getLaborRates(orgId?: string): ReturnType<typeof getLaborRates> {
    return getLaborRates(orgId);
  }

  async createLaborRate(...args: Parameters<typeof createLaborRate>): ReturnType<typeof createLaborRate> {
    return createLaborRate(...args);
  }

  async getExpenses(
    ...args: Parameters<typeof getExpenses>
  ): ReturnType<typeof getExpenses> {
    return getExpenses(...args);
  }

  async createExpense(...args: Parameters<typeof createExpense>): ReturnType<typeof createExpense> {
    return createExpense(...args);
  }

  async updateExpenseStatus(
    expenseId: string,
    status: "pending" | "approved" | "rejected"
  ): ReturnType<typeof updateExpenseStatus> {
    return updateExpenseStatus(expenseId, status);
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
    const existingFirst = existing[0];
    if (existingFirst) {
      return this.updateEquipmentLifecycle(existingFirst.id, lifecycle);
    }
    const [n] = await db.insert(equipmentLifecycle).values(lifecycle).returning();
    if (!n) {
      throw new Error("upsertEquipmentLifecycle: no row returned");
    }
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
      conditions.push(lte(performanceMetrics.metricDate, dateTo));
    }
    let query = db.select().from(performanceMetrics).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    return query.orderBy(desc(performanceMetrics.metricDate));
  }

  async createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    const [n] = await db.insert(performanceMetrics).values(metric).returning();
    if (!n) {
      throw new Error("createPerformanceMetric: no row returned");
    }
    return n;
  }

  async getFleetPerformanceOverview(
    getEquipmentHealth?: () => Promise<{ id: string; healthIndex: number; status: string }[]>
  ): Promise<PerformanceOverview[]> {
    const metrics = await db.select().from(performanceMetrics);
    if (metrics.length > 0) {
      const equipmentMetrics: Record<string, PerformanceMetric[]> = {};
      metrics.forEach((metric: PerformanceMetric) => {
        let bucket = equipmentMetrics[metric.equipmentId];
        if (!bucket) {
          bucket = [];
          equipmentMetrics[metric.equipmentId] = bucket;
        }
        bucket.push(metric);
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

  async getMetricsHistory(
    orgId: string,
    days: number = 7
  ): ReturnType<typeof getMetricsHistory> {
    return getMetricsHistory(orgId, days);
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
  }): ReturnType<typeof recordMetricsHistory> {
    return recordMetricsHistory(record);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Insight Snapshots
  // ──────────────────────────────────────────────────────────────────────

  async getLatestInsightSnapshot(
    orgId: string,
    scope: string
  ): ReturnType<typeof getLatestInsightSnapshot> {
    return getLatestInsightSnapshot(orgId, scope);
  }
}
