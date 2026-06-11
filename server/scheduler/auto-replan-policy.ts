import { domainEventBus } from "../lib/domain-event-bus/index.js";
import { planAndMaybeExecute } from "./scheduler-controller";
import { schedAutoReplanTriggers } from "../observability/scheduler-metrics";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Scheduler:AutoReplanPolicy");

const RUL_DAYS_CRITICAL = Number(process.env["SCHED_RUL_DAYS_CRITICAL"] ?? 9);
const RISK_REPLAN_LEVEL = (process.env["SCHED_RISK_REPLAN_LEVEL"] ?? "high").toLowerCase();
const AUTO_REPLAN_DAYS = Number(process.env["SCHED_AUTO_REPLAN_DAYS"] ?? 7);

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
    const { vesselId, equipmentId, remainingDays, riskLevel } = event.payload;
    const shouldReplan =
      remainingDays <= RUL_DAYS_CRITICAL || riskToRank(riskLevel) >= riskToRank(RISK_REPLAN_LEVEL);

    if (shouldReplan) {
      logger.info(
        `[Auto-Replan] RUL trigger: vessel=${vesselId}, remainingDays=${remainingDays}, risk=${riskLevel}`
      );
      schedAutoReplanTriggers.labels(event.orgId, "rul_critical").inc();

      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [vesselId],
          mode: "auto",
          trigger: "rul_critical",
          triggerContext: {
            equipmentId,
            remainingDays,
            riskLevel,
          },
        });
      } catch (error) {
        logger.error("[Auto-Replan] Failed to replan from RUL trigger:", undefined, error);
      }
    }
  });

  domainEventBus.on("pdm.anomaly.created", async (event) => {
    const { vesselId, equipmentId, severity, anomalyType } = event.payload;
    if (severity === "high" || severity === "critical") {
      logger.info(`[Auto-Replan] Anomaly trigger: vessel=${vesselId}, severity=${severity}`);
      schedAutoReplanTriggers.labels(event.orgId, "anomaly_detected").inc();

      try {
        await planAndMaybeExecute({
          orgId: event.orgId,
          days: AUTO_REPLAN_DAYS,
          vessels: [vesselId],
          mode: "auto",
          trigger: "anomaly_detected",
          triggerContext: {
            equipmentId,
            severity,
            anomalyType,
          },
        });
      } catch (error) {
        logger.error("[Auto-Replan] Failed to replan from anomaly trigger:", undefined, error);
      }
    }
  });

  domainEventBus.on("pdm.maintenance.window", async (event) => {
    const { vesselId, equipmentId, start, end, priority } = event.payload;
    logger.info(`[Auto-Replan] Maintenance window trigger: vessel=${vesselId}`);
    schedAutoReplanTriggers.labels(event.orgId, "maintenance_scheduled").inc();

    try {
      await planAndMaybeExecute({
        orgId: event.orgId,
        days: AUTO_REPLAN_DAYS,
        vessels: [vesselId],
        mode: "auto",
        trigger: "maintenance_scheduled",
        triggerContext: {
          equipmentId,
          start: start instanceof Date ? start.toISOString() : String(start),
          end: end instanceof Date ? end.toISOString() : String(end),
          priority,
        },
      });
    } catch (error) {
      logger.error("[Auto-Replan] Failed to replan from maintenance window:", undefined, error);
    }
  });

  logger.info("[Auto-Replan] Policy initialized with config:", {
    details: {
      RUL_DAYS_CRITICAL,
      RISK_REPLAN_LEVEL,
      AUTO_REPLAN_DAYS,
    },
  });
}
