import { domainEventBus } from "../lib/domain-event-bus/index.js";
import { planAndMaybeExecute } from "./scheduler-controller";
import { schedAutoReplanTriggers } from "../observability/scheduler-metrics";

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

export function initializeAutoReplanPolicy(): void {
  domainEventBus.on("pdm.rul.updated", async (event) => {
    const p = event.payload as {
      vesselId: string; equipmentId: string; remainingDays: number; riskLevel: string;
    };
    const shouldReplan =
      p.remainingDays <= RUL_DAYS_CRITICAL ||
      riskToRank(p.riskLevel) >= riskToRank(RISK_REPLAN_LEVEL);

    if (shouldReplan) {
      console.log(
        `[Auto-Replan] RUL trigger: vessel=${p.vesselId}, remainingDays=${p.remainingDays}, risk=${p.riskLevel}`
      );
      schedAutoReplanTriggers.labels(event.orgId, "rul_critical").inc();

      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [p.vesselId],
          mode: "auto",
          trigger: "rul_critical",
          triggerContext: {
            equipmentId: p.equipmentId,
            remainingDays: p.remainingDays,
            riskLevel: p.riskLevel,
          },
        });
      } catch (error) {
        console.error("[Auto-Replan] Failed to replan from RUL trigger:", error);
      }
    }
  });

  domainEventBus.on("pdm.anomaly.created", async (event) => {
    const p = event.payload as {
      vesselId: string; equipmentId: string; severity: string; anomalyType: string;
    };
    if (p.severity === "high" || p.severity === "critical") {
      console.log(
        `[Auto-Replan] Anomaly trigger: vessel=${p.vesselId}, severity=${p.severity}`
      );
      schedAutoReplanTriggers.labels(event.orgId, "anomaly_detected").inc();

      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [p.vesselId],
          mode: "auto",
          trigger: "anomaly_detected",
          triggerContext: {
            equipmentId: p.equipmentId,
            severity: p.severity,
            anomalyType: p.anomalyType,
          },
        });
      } catch (error) {
        console.error("[Auto-Replan] Failed to replan from anomaly trigger:", error);
      }
    }
  });

  domainEventBus.on("pdm.maintenance.window", async (event) => {
    const p = event.payload as {
      vesselId: string; equipmentId: string; start: Date; end: Date; priority: string;
    };
    console.log(`[Auto-Replan] Maintenance window trigger: vessel=${p.vesselId}`);
    schedAutoReplanTriggers.labels(event.orgId, "maintenance_scheduled").inc();

    try {
      await planAndMaybeExecute({
        orgId: event.orgId,
        days: AUTO_REPLAN_DAYS,
        vessels: [p.vesselId],
        mode: "auto",
        trigger: "maintenance_scheduled",
        triggerContext: {
          equipmentId: p.equipmentId,
          start: p.start instanceof Date ? p.start.toISOString() : String(p.start),
          end: p.end instanceof Date ? p.end.toISOString() : String(p.end),
          priority: p.priority,
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
