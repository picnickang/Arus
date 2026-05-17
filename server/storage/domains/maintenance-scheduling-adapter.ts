import type {
  MaintenanceSchedule,
  MaintenanceRecord,
  EquipmentLifecycle,
  PerformanceMetric,
  AlertNotification,
  InsertMaintenanceSchedule,
} from "@shared/schema";

export type MaintenanceSchedulingDecision = {
  shouldSchedule: boolean;
  scheduledDate: Date;
  maintenanceType: "predictive" | "preventive" | "corrective";
  priority: number;
  description: string;
};

export interface IMaintenanceSchedulingAdapter {
  autoScheduleMaintenance(
    equipmentId: string,
    pdmScore: number
  ): Promise<MaintenanceSchedule | null>;
  calculateMaintenanceSchedulingDecision(
    equipmentId: string,
    pdmScore: number
  ): Promise<MaintenanceSchedulingDecision>;
}

export interface MaintenanceSchedulingDeps {
  getExistingAutoSchedules(equipmentId: string): Promise<MaintenanceSchedule[]>;
  createSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule>;
  getEquipmentLifecycle(equipmentId: string): Promise<EquipmentLifecycle | null>;
  getMaintenanceRecords(equipmentId: string, from: Date, to: Date): Promise<MaintenanceRecord[]>;
  getPerformanceMetrics(equipmentId: string, from: Date, to: Date): Promise<PerformanceMetric[]>;
  getAlertNotifications(): Promise<AlertNotification[]>;
}

abstract class BaseMaintenanceSchedulingAdapter implements IMaintenanceSchedulingAdapter {
  protected deps: MaintenanceSchedulingDeps;

  constructor(deps: MaintenanceSchedulingDeps) {
    this.deps = deps;
  }

  private getEquipmentType(equipmentId: string): string {
    const m: Record<string, string> = {
      ENG: "engine",
      GEN: "generator",
      PUMP: "pump",
      COMP: "compressor",
    };
    return m[equipmentId.substring(0, 3)] || "generic";
  }
  private getEquipmentCriticalityFactor(_eqId: string, eqType: string): number {
    const m: Record<string, number> = {
      engine: 1.3,
      generator: 1.2,
      pump: 1.1,
      compressor: 1.15,
      generic: 1,
    };
    return m[eqType] || 1;
  }
  private calculateAgeFactor(lc?: EquipmentLifecycle | null): number {
    if (!lc?.installationDate) {
      return 1;
    }
    const ageMonths = (Date.now() - lc.installationDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
    const life = lc.expectedLifespan || 120;
    if (ageMonths < 0 || life <= 0) {
      return 1;
    }
    const r = ageMonths / life;
    if (r > 0.8) {
      return 1.4;
    }
    if (r > 0.6) {
      return 1.2;
    }
    if (r > 0.3) {
      return 1;
    }
    return 0.9;
  }
  private calculateMaintenanceHistoryFactor(recs: MaintenanceRecord[]): number {
    if (!recs?.length) {
      return 1.2;
    }
    const f = recs.filter((r) => r.maintenanceType === "corrective").length;
    const p = recs.filter(
      (r) => r.maintenanceType === "preventive" || r.maintenanceType === "predictive"
    ).length;
    const fr = f / Math.max(1, recs.length);
    const pr = p / Math.max(1, recs.length);
    if (fr > 0.3) {
      return 1.3;
    }
    if (fr > 0.1) {
      return 1.1;
    }
    if (pr > 0.7) {
      return 0.9;
    }
    if (pr > 0.5) {
      return 0.95;
    }
    return 1;
  }
  private calculatePerformanceTrendFactor(metrics: PerformanceMetric[]): number {
    if (!metrics?.length || metrics.length < 3) {
      return 1;
    }
    const s = metrics
      .filter((m) => m.performanceScore != null)
      .sort((a, b) => a.metricDate.getTime() - b.metricDate.getTime());
    if (s.length < 3) {
      return 1;
    }
    const r = s.slice(-3);
    const avg =
      r.reduce(
        (a, m, i) =>
          i === 0 ? a : a + ((m.performanceScore || 0) - (r[i - 1].performanceScore || 0)),
        0
      ) / Math.max(1, r.length - 1);
    if (avg < -5) {
      return 1.3;
    }
    if (avg < -2) {
      return 1.1;
    }
    if (avg > 2) {
      return 0.9;
    }
    return 1;
  }
  private calculateAlertFrequencyFactor(alerts: AlertNotification[]): number {
    if (!alerts.length) {
      return 1;
    }
    const recent = alerts.filter((a) => (a.createdAt?.getTime() || 0) > Date.now() - 604800000);
    const crit = recent.filter((a) => a.alertType === "critical").length;
    if (crit > 3) {
      return 1.4;
    }
    if (crit > 1) {
      return 1.2;
    }
    if (recent.length > 5) {
      return 1.1;
    }
    return 1;
  }
  private calculateUrgencyScore(
    pdm: number,
    critTh: number,
    warnTh: number,
    mf: number,
    pf: number,
    af: number
  ): number {
    const sm = Math.max(0.5, Math.min(2, mf || 1));
    const sp = Math.max(0.5, Math.min(2, pf || 1));
    const sa = Math.max(0.5, Math.min(2, af || 1));
    const risk = Math.max(0, 100 - pdm);
    let u = risk;
    if (pdm < critTh) {
      u *= 1.5;
    } else if (pdm < warnTh) {
      u *= 1.2;
    }
    u *= sm * sp * sa;
    return Math.min(100, Math.max(0, u));
  }
  private calculateOptimalMaintenanceWindow(eqType: string, priority: number): number {
    const w: Record<string, number[]> = {
      engine: [4, 24, 72],
      generator: [6, 48, 120],
      pump: [8, 72, 168],
      compressor: [12, 96, 240],
      generic: [24, 168, 336],
    };
    const ws = w[eqType] || w["generic"];
    return ws[Math.min(priority - 1, ws.length - 1)];
  }
  private shouldSchedulePreventive(lc?: EquipmentLifecycle, recs?: MaintenanceRecord[]): boolean {
    if (!lc) {
      return false;
    }
    const hrs = lc.operatingHours || 0;
    const lastM = recs?.[0]?.createdAt;
    const days = lastM ? (Date.now() - lastM.getTime()) / 86400000 : 365;
    const itvl: Record<string, { hours: number; days: number }> = {
      engine: { hours: 500, days: 30 },
      generator: { hours: 750, days: 45 },
      pump: { hours: 1000, days: 60 },
      compressor: { hours: 800, days: 50 },
      generic: { hours: 1000, days: 90 },
    };
    const t = this.getEquipmentType(lc.equipmentId);
    const i = itvl[t] || itvl["generic"];
    return days >= i.days || (hrs % i.hours < 10 && hrs > i.hours);
  }

  async calculateMaintenanceSchedulingDecision(
    equipmentId: string,
    pdmScore: number
  ): Promise<MaintenanceSchedulingDecision> {
    const now = new Date();
    const from90DaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const from30DaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [equipmentLifecycle, recentMaintenanceRecords, performanceMetrics, allAlerts] =
      await Promise.all([
        this.deps.getEquipmentLifecycle(equipmentId),
        this.deps.getMaintenanceRecords(equipmentId, from90DaysAgo, now),
        this.deps.getPerformanceMetrics(equipmentId, from30DaysAgo, now),
        this.deps.getAlertNotifications(),
      ]);

    const alertHistory = allAlerts.filter((a) => a.equipmentId === equipmentId);
    const equipmentType = this.getEquipmentType(equipmentId);
    const criticalityFactor = this.getEquipmentCriticalityFactor(equipmentId, equipmentType);
    const ageFactor = this.calculateAgeFactor(equipmentLifecycle);
    const maintenanceHistoryFactor =
      this.calculateMaintenanceHistoryFactor(recentMaintenanceRecords);
    const performanceTrendFactor = this.calculatePerformanceTrendFactor(performanceMetrics);
    const alertFrequencyFactor = this.calculateAlertFrequencyFactor(alertHistory);

    const baseCriticalThreshold = 30;
    const baseWarningThreshold = 60;
    const adjustedCriticalThreshold = baseCriticalThreshold * criticalityFactor * ageFactor;
    const adjustedWarningThreshold = baseWarningThreshold * criticalityFactor * ageFactor;

    const urgencyScore = this.calculateUrgencyScore(
      pdmScore,
      adjustedCriticalThreshold,
      adjustedWarningThreshold,
      maintenanceHistoryFactor,
      performanceTrendFactor,
      alertFrequencyFactor
    );

    return this.buildMaintenanceDecision(
      urgencyScore,
      equipmentId,
      equipmentType,
      pdmScore,
      criticalityFactor,
      equipmentLifecycle,
      recentMaintenanceRecords
    );
  }

  private buildMaintenanceDecision(
    urgencyScore: number,
    equipmentId: string,
    equipmentType: string,
    pdmScore: number,
    criticalityFactor: number,
    lifecycle: EquipmentLifecycle | null,
    records: MaintenanceRecord[]
  ): MaintenanceSchedulingDecision {
    if (urgencyScore >= 90) {
      return this.createEmergencyDecision(equipmentId, pdmScore, urgencyScore, criticalityFactor);
    }
    if (urgencyScore >= 70) {
      return this.createCriticalPredictiveDecision(equipmentId, equipmentType, pdmScore);
    }
    if (urgencyScore >= 50) {
      return this.createScheduledPredictiveDecision(equipmentId, equipmentType, pdmScore);
    }
    if (urgencyScore >= 30 && this.shouldSchedulePreventive(lifecycle ?? undefined, records)) {
      return this.createPreventiveDecision(equipmentId, equipmentType, pdmScore);
    }
    return {
      shouldSchedule: false,
      scheduledDate: new Date(),
      maintenanceType: "preventive",
      priority: 3,
      description: "",
    };
  }

  private createEmergencyDecision(
    equipmentId: string,
    pdmScore: number,
    urgencyScore: number,
    criticalityFactor: number
  ): MaintenanceSchedulingDecision {
    const hoursUntilSchedule = criticalityFactor > 1.2 ? 4 : 12;
    return {
      shouldSchedule: true,
      scheduledDate: new Date(Date.now() + hoursUntilSchedule * 60 * 60 * 1000),
      maintenanceType: "corrective",
      priority: 1,
      description: `EMERGENCY: Critical maintenance required for ${equipmentId}. PdM score: ${pdmScore.toFixed(1)}, Urgency: ${urgencyScore.toFixed(1)}`,
    };
  }

  private createCriticalPredictiveDecision(
    equipmentId: string,
    equipmentType: string,
    pdmScore: number
  ): MaintenanceSchedulingDecision {
    return {
      shouldSchedule: true,
      scheduledDate: new Date(
        Date.now() + this.calculateOptimalMaintenanceWindow(equipmentType, 1) * 60 * 60 * 1000
      ),
      maintenanceType: "predictive",
      priority: 1,
      description: `Critical predictive maintenance for ${equipmentId}. PdM score: ${pdmScore.toFixed(1)}, multiple risk factors detected`,
    };
  }

  private createScheduledPredictiveDecision(
    equipmentId: string,
    equipmentType: string,
    pdmScore: number
  ): MaintenanceSchedulingDecision {
    return {
      shouldSchedule: true,
      scheduledDate: new Date(
        Date.now() + this.calculateOptimalMaintenanceWindow(equipmentType, 2) * 60 * 60 * 1000
      ),
      maintenanceType: "predictive",
      priority: 2,
      description: `Scheduled predictive maintenance for ${equipmentId}. PdM score: ${pdmScore.toFixed(1)}, trending towards maintenance threshold`,
    };
  }

  private createPreventiveDecision(
    equipmentId: string,
    equipmentType: string,
    pdmScore: number
  ): MaintenanceSchedulingDecision {
    return {
      shouldSchedule: true,
      scheduledDate: new Date(
        Date.now() + this.calculateOptimalMaintenanceWindow(equipmentType, 3) * 60 * 60 * 1000
      ),
      maintenanceType: "preventive",
      priority: 3,
      description: `Preventive maintenance for ${equipmentId}. Regular service interval due, PdM score: ${pdmScore.toFixed(1)}`,
    };
  }

  async autoScheduleMaintenance(
    equipmentId: string,
    pdmScore: number
  ): Promise<MaintenanceSchedule | null> {
    const existingSchedules = await this.deps.getExistingAutoSchedules(equipmentId) ?? undefined;
    if ((existingSchedules as any)?.length > 0) {
      return null;
    }
    const decision = await this.calculateMaintenanceSchedulingDecision(equipmentId, pdmScore);
    if (decision.shouldSchedule) {
      return this.deps.createSchedule({
        orgId: (this.deps as any).orgId ?? "",
        equipmentId,
        scheduledDate: decision.scheduledDate,
        maintenanceType: decision.maintenanceType,
        priority: decision.priority,
        status: "scheduled" as any,
        description: decision.description,
        pdmScore,
        autoGenerated: true,
      });
    }
    return null;
  }
}

export class MemMaintenanceSchedulingAdapter extends BaseMaintenanceSchedulingAdapter {
  constructor(deps: MaintenanceSchedulingDeps) {
    super(deps);
  }
}

export class DbMaintenanceSchedulingAdapter extends BaseMaintenanceSchedulingAdapter {
  constructor(deps: MaintenanceSchedulingDeps) {
    super(deps);
  }
}
