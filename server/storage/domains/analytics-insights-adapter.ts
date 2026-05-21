import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db-config";
import { kbDocs, type KbDoc } from "@shared/schema";
import { insightSnapshots, insightReports } from "@shared/schema-runtime";
import type {
  EquipmentTelemetry,
  Equipment,
  PdmScoreLog as PdmScore,
  WorkOrder,
  Device,
  EdgeHeartbeat,
  Vessel,
  InsightSnapshot,
  InsertInsightSnapshot,
  InsightReport,
  InsertInsightReport,
} from "@shared/schema";

interface TrendValue {
  value: number;
  direction: "up" | "down";
  percentChange: number;
}
export interface DashboardMetrics {
  activeDevices: number;
  fleetHealth: number;
  openWorkOrders: number;
  riskAlerts: number;
  trends: {
    activeDevices: TrendValue;
    fleetHealth: TrendValue;
    openWorkOrders: TrendValue;
    riskAlerts: TrendValue;
  };
}

export interface AnalyticsDependencies {
  getDevices(orgId: string): Promise<Device[]>;
  getHeartbeats(orgId: string): Promise<EdgeHeartbeat[]>;
  getWorkOrders(
    equipmentId?: string,
    status?: string,
    priority?: number,
    orgId?: string
  ): Promise<WorkOrder[]>;
  getPdmScores(equipmentId: string | undefined, orgId: string): Promise<PdmScore[]>;
  getLatestTelemetryReadings(
    vesselId?: string,
    equipmentId?: string,
    sensorType?: string,
    limit?: number,
    orgId?: string
  ): Promise<EquipmentTelemetry[]>;
  getEquipmentRegistry(orgId: string): Promise<Equipment[]>;
  getMetricsHistory(orgId: string, days: number): Promise<any[]>;
  getVessels(orgId: string): Promise<Vessel[]>;
  getEquipment(id: string): Promise<Equipment | undefined>;
}

export interface TrendData {
  value: number;
  direction: "up" | "down";
  percentChange: number;
}

export abstract class BaseAnalyticsInsightsAdapter {
  protected deps: AnalyticsDependencies;

  constructor(deps: AnalyticsDependencies) {
    this.deps = deps;
  }

  protected calculateTrend(current: number, previous: number | undefined): TrendData {
    if (previous === undefined || previous === 0) {
      return { value: 0, direction: "up", percentChange: 0 };
    }
    const change = current - previous;
    const percentChange = Math.round((change / previous) * 100);
    return {
      value: Math.abs(change),
      direction: change >= 0 ? "up" : "down",
      percentChange: Math.abs(percentChange),
    };
  }

  async getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
    const [devices, heartbeats, workOrders, pdmScores, telemetryData, equipmentList] =
      await Promise.all([
        this.deps.getDevices(orgId),
        this.deps.getHeartbeats(orgId),
        this.deps.getWorkOrders(undefined, undefined, undefined, orgId),
        this.deps.getPdmScores(undefined, orgId),
        this.deps.getLatestTelemetryReadings(undefined, undefined, undefined, 500, orgId),
        this.deps.getEquipmentRegistry(orgId),
      ]);

    const now = Date.now();
    const activeFromHeartbeats = heartbeats.filter(
      (hb) => now - (hb.ts?.getTime() || 0) < 600000
    ).length;
    const recentTelemetry = telemetryData.filter((t) => now - (t.ts?.getTime() || 0) < 600000);
    const activeFromTelemetry = new Set(recentTelemetry.map((t) => t.equipmentId)).size;
    const activeEquipmentFromRegistry = equipmentList.filter((eq) => eq.isActive).length;
    const activeDevices = Math.max(
      activeFromHeartbeats,
      activeFromTelemetry,
      activeEquipmentFromRegistry
    );

    const healthScores = pdmScores.map((s) => s.healthIdx || 0);
    let fleetHealth = 0;
    if (healthScores.length > 0) {
      fleetHealth = Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length);
    } else if (recentTelemetry.length > 0) {
      const sw = { normal: 100, warning: 60, critical: 20 } as Record<string, number>;
      fleetHealth = Math.round(
        recentTelemetry.reduce((s, t) => s + (sw[t.status as string] || 50), 0) /
          recentTelemetry.length
      );
    } else if (activeEquipmentFromRegistry > 0) {
      fleetHealth = 75;
    }

    const openWorkOrders = workOrders.filter((wo) => wo.status !== "completed").length;
    const pdmRiskAlerts = pdmScores.filter((s) => (s.healthIdx || 100) < 60).length;
    const telemetryRiskAlerts = recentTelemetry.filter(
      (t) => t.status === "critical" || t.status === "warning"
    ).length;
    const riskAlerts = Math.max(pdmRiskAlerts, telemetryRiskAlerts);

    const history = await this.deps.getMetricsHistory(orgId, 7);
    const weekOldMetrics = history.length > 0 ? history[history.length - 1] : undefined;

    return {
      activeDevices,
      fleetHealth,
      openWorkOrders,
      riskAlerts,
      trends: {
        activeDevices: this.calculateTrend(activeDevices, weekOldMetrics?.activeDevices),
        fleetHealth: this.calculateTrend(fleetHealth, weekOldMetrics?.fleetHealth),
        openWorkOrders: this.calculateTrend(openWorkOrders, weekOldMetrics?.openWorkOrders),
        riskAlerts: this.calculateTrend(riskAlerts, weekOldMetrics?.riskAlerts),
      },
    };
  }

  async getEquipmentHealth(
    orgId: string
  ): Promise<
    {
      equipmentId: string;
      name: string;
      healthScore: number;
      status: string;
      lastReading?: Date;
      riskFactors: string[];
    }[]
  > {
    const [equipment, pdmScores, telemetryData] = await Promise.all([
      this.deps.getEquipmentRegistry(orgId),
      this.deps.getPdmScores(undefined, orgId),
      this.deps.getLatestTelemetryReadings(undefined, undefined, undefined, 500, orgId),
    ]);

    return equipment.map((eq) => {
      const pdm = pdmScores.find((s) => s.equipmentId === eq.id);
      const telemetry = telemetryData
        .filter((t) => t.equipmentId === eq.id)
        .sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0));
      const latestTelemetry = telemetry[0];

      let healthScore = pdm?.healthIdx || 100;
      let status = "healthy";
      const riskFactors: string[] = [];

      if (latestTelemetry) {
        if (latestTelemetry.status === "critical") {
          status = "critical";
          riskFactors.push("Critical telemetry reading");
          healthScore = Math.min(healthScore, 20);
        } else if (latestTelemetry.status === "warning") {
          status = "warning";
          riskFactors.push("Warning telemetry reading");
          healthScore = Math.min(healthScore, 60);
        }
      }

      if (pdm && (pdm.healthIdx || 100) < 60) {
        riskFactors.push(`Low PdM score: ${pdm.healthIdx}`);
        status = pdm.healthIdx! < 30 ? "critical" : "warning";
      }
      if (!latestTelemetry || Date.now() - (latestTelemetry.ts?.getTime() || 0) > 3600000) {
        riskFactors.push("No recent telemetry");
      }

      return {
        equipmentId: eq.id,
        name: eq.name,
        healthScore,
        status,
        lastReading: latestTelemetry?.ts || undefined,
        riskFactors,
      };
    });
  }

  async getFleetOverview(
    orgId: string
  ): Promise<{
    totalVessels: number;
    activeVessels: number;
    totalEquipment: number;
    activeEquipment: number;
    avgFleetHealth: number;
  }> {
    const [vessels, equipment, pdmScores] = await Promise.all([
      this.deps.getVessels(orgId),
      this.deps.getEquipmentRegistry(orgId),
      this.deps.getPdmScores(undefined, orgId),
    ]);

    const activeEquipment = equipment.filter((eq) => eq.isActive).length;
    const activeVessels = vessels.filter((v) => (v as { status?: string }).status === "active").length;
    const healthScores = pdmScores.map((s) => s.healthIdx || 0).filter((h) => h > 0);
    const avgFleetHealth =
      healthScores.length > 0
        ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
        : 100;

    return {
      totalVessels: vessels.length,
      activeVessels,
      totalEquipment: equipment.length,
      activeEquipment,
      avgFleetHealth,
    };
  }
}

export class MemAnalyticsInsightsAdapter extends BaseAnalyticsInsightsAdapter {
  async getKbDocs(_orgId?: string): Promise<KbDoc[]> {
    return [];
  }
  async getInsightSnapshots(_orgId?: string, _scope?: string): Promise<InsightSnapshot[]> {
    return [];
  }
  async getLatestInsightSnapshot(
    _orgId: string,
    _scope: string
  ): Promise<InsightSnapshot | undefined> {
    return undefined;
  }
  async createInsightSnapshot(
    _orgId: string,
    _snapshot: InsertInsightSnapshot
  ): Promise<InsightSnapshot> {
    throw new Error("MemAnalyticsInsightsAdapter.createInsightSnapshot not implemented");
  }
  async getInsightReports(_orgId?: string, _scope?: string): Promise<InsightReport[]> {
    return [];
  }
  async createInsightReport(
    _orgId: string,
    _report: InsertInsightReport
  ): Promise<InsightReport> {
    throw new Error("MemAnalyticsInsightsAdapter.createInsightReport not implemented");
  }
}
export class DatabaseAnalyticsInsightsAdapter extends BaseAnalyticsInsightsAdapter {
  async getKbDocs(orgId?: string): Promise<KbDoc[]> {
    if (orgId) {
      return db
        .select()
        .from(kbDocs)
        .where(eq(kbDocs.orgId, orgId))
        .orderBy(desc(kbDocs.createdAt));
    }
    return db.select().from(kbDocs).orderBy(desc(kbDocs.createdAt));
  }

  async getInsightSnapshots(orgId?: string, scope?: string): Promise<InsightSnapshot[]> {
    const conditions = [];
    if (orgId) conditions.push(eq(insightSnapshots.orgId, orgId));
    if (scope) conditions.push(eq(insightSnapshots.scope, scope));
    const query = db.select().from(insightSnapshots);
    const results =
      conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(insightSnapshots.createdAt))
        : await query.orderBy(desc(insightSnapshots.createdAt));
    return results;
  }

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

  async createInsightSnapshot(
    orgId: string,
    snapshot: InsertInsightSnapshot
  ): Promise<InsightSnapshot> {
    const [created] = await db
      .insert(insightSnapshots)
      .values({ ...snapshot, orgId })
      .returning();
    return created;
  }

  async getInsightReports(orgId?: string, scope?: string): Promise<InsightReport[]> {
    const conditions = [];
    if (orgId) conditions.push(eq(insightReports.orgId, orgId));
    if (scope) conditions.push(eq(insightReports.scope, scope));
    const query = db.select().from(insightReports);
    const results =
      conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(insightReports.createdAt))
        : await query.orderBy(desc(insightReports.createdAt));
    return results;
  }

  async createInsightReport(
    orgId: string,
    report: InsertInsightReport
  ): Promise<InsightReport> {
    const [created] = await db
      .insert(insightReports)
      .values({ ...report, orgId })
      .returning();
    return created;
  }
}
