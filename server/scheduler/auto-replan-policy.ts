import {
  schedulerEventBus,
  RulUpdatedEvent,
  AnomalyCreatedEvent,
  MaintenanceWindowEvent,
} from "../events/scheduler-bus";
import { planAndMaybeExecute } from "./scheduler-controller";
import { schedAutoReplanTriggers } from "../observability/scheduler-metrics";

// Configuration from environment
const RUL_DAYS_CRITICAL = Number(process.env.SCHED_RUL_DAYS_CRITICAL ?? 9);
const RISK_REPLAN_LEVEL = (process.env.SCHED_RISK_REPLAN_LEVEL ?? "high").toLowerCase();
const AUTO_REPLAN_DAYS = Number(process.env.SCHED_AUTO_REPLAN_DAYS ?? 7);

function riskToRank(r: string): number {
  const ranks: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return ranks[r] ?? 0;
}

// Initialize auto-replan listeners
export function initializeAutoReplanPolicy(): void {
  // RUL-triggered replanning
  schedulerEventBus.onRulUpdate(async (event: RulUpdatedEvent) => {
    const shouldReplan =
      event.remainingDays <= RUL_DAYS_CRITICAL ||
      riskToRank(event.riskLevel) >= riskToRank(RISK_REPLAN_LEVEL);

    if (shouldReplan) {
      console.log(
        `[Auto-Replan] RUL trigger: vessel=${event.vesselId}, remainingDays=${event.remainingDays}, risk=${event.riskLevel}`
      );
      schedAutoReplanTriggers.labels(event.orgId, "rul_critical").inc();

      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [event.vesselId],
          mode: "auto",
          trigger: "rul_critical",
          triggerContext: {
            equipmentId: event.equipmentId,
            remainingDays: event.remainingDays,
            riskLevel: event.riskLevel,
          },
        });
      } catch (error) {
        console.error("[Auto-Replan] Failed to replan from RUL trigger:", error);
      }
    }
  });

  // Anomaly-triggered replanning
  schedulerEventBus.onAnomalyCreated(async (event: AnomalyCreatedEvent) => {
    if (event.severity === "high" || event.severity === "critical") {
      console.log(
        `[Auto-Replan] Anomaly trigger: vessel=${event.vesselId}, severity=${event.severity}`
      );
      schedAutoReplanTriggers.labels(event.orgId, "anomaly_detected").inc();

      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [event.vesselId],
          mode: "auto",
          trigger: "anomaly_detected",
          triggerContext: {
            equipmentId: event.equipmentId,
            severity: event.severity,
            anomalyType: event.anomalyType,
          },
        });
      } catch (error) {
        console.error("[Auto-Replan] Failed to replan from anomaly trigger:", error);
      }
    }
  });

  // Maintenance window replanning
  schedulerEventBus.onMaintenanceWindow(async (event: MaintenanceWindowEvent) => {
    console.log(`[Auto-Replan] Maintenance window trigger: vessel=${event.vesselId}`);
    schedAutoReplanTriggers.labels(event.orgId, "maintenance_scheduled").inc();

    try {
      await planAndMaybeExecute({
        orgId: event.orgId,
        days: AUTO_REPLAN_DAYS,
        vessels: [event.vesselId],
        mode: "auto",
        trigger: "maintenance_scheduled",
        triggerContext: {
          equipmentId: event.equipmentId,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          priority: event.priority,
        },
      });
    } catch (error) {
      console.error("[Auto-Replan] Failed to replan from maintenance window:", error);
    }
  });

  console.log("[Auto-Replan] Policy initialized with config:", {
    RUL_DAYS_CRITICAL,
    RISK_REPLAN_LEVEL,
    AUTO_REPLAN_DAYS,
  });
}
