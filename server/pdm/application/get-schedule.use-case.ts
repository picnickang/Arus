import type { PdmRepositoryPort, VesselBasic } from "../ports/pdm-repository.port.js";
import type {
  PdmScheduleData,
  PdmScheduledTask,
  ScheduleKpis,
  BlockReason,
} from "../domain/types.js";
import { recordUserVisibleStub } from "../../observability/security-metrics.js";

export interface GetScheduleInput {
  orgId: string;
  vesselIds?: string[];
  equipmentTypes?: string[];
  startDate?: Date;
  endDate?: Date;
  maxTasksPerVesselPerDay?: number;
  autoPopulate?: boolean;
}

export interface GetScheduleOutput {
  data: PdmScheduleData;
}

export interface GetScheduleUseCase {
  execute(input: GetScheduleInput): Promise<GetScheduleOutput>;
}

const PREP_TIME_DAYS = 1;
const DEFAULT_DOWNTIME_HOURS = 4;
const DOWNTIME_COST_PER_HOUR = 325;
const MAX_VESSEL_HOURS_PER_DAY = 8;
const MAX_BUFFER_DAYS = 5;
const DEFAULT_MAX_TASKS_PER_DAY = 3;

export type TelemetryFreshness = "online" | "delayed" | "offline";

export interface BufferFactors {
  confidence: number | null;
  telemetryFreshness: TelemetryFreshness;
  severity: "critical" | "high" | "medium" | "low";
}

export function computeBufferDays(factors: BufferFactors): number {
  let buffer = 1;

  if (factors.confidence === null) {
    buffer += 1;
  } else if (factors.confidence < 50) {
    buffer += 2;
  } else if (factors.confidence < 80) {
    buffer += 1;
  }

  if (factors.telemetryFreshness !== "online") {
    buffer += 1;
  }

  if (factors.severity === "critical") {
    buffer += 1;
  }

  return Math.min(buffer, MAX_BUFFER_DAYS);
}

export interface WindowInput {
  rulP10Days: number;
  rulP50Days: number;
  rulP90Days: number;
  prepDays: number;
  bufferDays: number;
  today: Date;
}

export function computeSchedulingWindow(input: WindowInput): {
  earliestStart: Date;
  preferredDate: Date;
  latestFinish: Date;
  isBlockedByLeadTime: boolean;
} {
  const { rulP10Days, rulP50Days, prepDays, bufferDays, today } = input;

  const earliestStart = new Date(today);
  earliestStart.setDate(earliestStart.getDate() + prepDays);

  const preferredDate = new Date(today);
  preferredDate.setDate(preferredDate.getDate() + rulP50Days - bufferDays);

  const latestFinish = new Date(today);
  latestFinish.setDate(latestFinish.getDate() + rulP10Days - bufferDays);

  const clampedPreferred = new Date(
    Math.max(earliestStart.getTime(), Math.min(preferredDate.getTime(), latestFinish.getTime()))
  );

  const isBlockedByLeadTime = earliestStart > latestFinish;

  return {
    earliestStart,
    preferredDate: isBlockedByLeadTime ? preferredDate : clampedPreferred,
    latestFinish,
    isBlockedByLeadTime,
  };
}

export function determineBlockStatus(
  task: PdmScheduledTask,
  scheduledHoursPerDay: Map<string, number>,
  maxHoursPerDay: number,
  telemetryFreshness: TelemetryFreshness
): { isBlocked: boolean; reason?: BlockReason; details?: string } {
  if (task.confidence < 50) {
    return {
      isBlocked: true,
      reason: "insufficient_confidence",
      details: `Confidence ${task.confidence}% below threshold`,
    };
  }

  if (telemetryFreshness === "offline") {
    return {
      isBlocked: true,
      reason: "telemetry_stale",
      details: "Equipment telemetry offline - prediction unreliable",
    };
  }

  if (task.schedulingWindow.earliestStart > task.schedulingWindow.latestFinish) {
    return {
      isBlocked: true,
      reason: "scheduling_conflict",
      details: "RUL window too short for prep time",
    };
  }

  const preferredKey = `${task.vesselId}-${task.schedulingWindow.preferredDate.toISOString().split("T")[0]}`;
  const currentHours = scheduledHoursPerDay.get(preferredKey) || 0;
  if (currentHours + task.estimatedDowntimeHours > maxHoursPerDay) {
    return {
      isBlocked: true,
      reason: "capacity",
      details: `Vessel at capacity (${maxHoursPerDay}h/day limit, ${currentHours}h scheduled)`,
    };
  }

  return { isBlocked: false };
}

export function createGetScheduleUseCase(repository: PdmRepositoryPort): GetScheduleUseCase {
  return {
    async execute(input: GetScheduleInput): Promise<GetScheduleOutput> {
      const today = new Date();
      const startDate = input.startDate || today;
      const endDate = input.endDate || new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

      let alerts = await repository.getActiveAlerts(
        input.orgId,
        input.vesselIds,
        input.equipmentTypes
      );
      const vessels = await repository.getVessels(input.orgId);
      const maxTasksPerDay = input.maxTasksPerVesselPerDay ?? DEFAULT_MAX_TASKS_PER_DAY;
      const autoPopulate = input.autoPopulate !== false;

      if (autoPopulate) {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        alerts = [...alerts].sort(
          (a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
        );
      }

      const scheduledHoursPerDay = new Map<string, number>();
      const scheduledTasks: PdmScheduledTask[] = [];
      const blockedTasks: PdmScheduledTask[] = [];

      for (const alert of alerts) {
        const rulP10 = alert.rulConfidenceInterval?.lowDays || alert.rulEstimateDays || 7;
        const rulP90 =
          alert.rulConfidenceInterval?.highDays ||
          (alert.rulEstimateDays ? alert.rulEstimateDays * 1.5 : 14);
        const rulP50 = alert.rulEstimateDays || Math.round((rulP10 + rulP90) / 2);

        // TODO: Integrate with telemetry heartbeat service to get actual freshness state
        // For now, default to 'online' - when telemetry integration is added, this should
        // query equipment heartbeat status from repository.getTelemetryFreshness(alert.equipmentId)
        // P2 #31 — defaulting to 'online' biases the scheduling buffer
        // toward the optimistic end (no extra prep days). Operators see
        // this in the scheduled task window, so emit a counter for
        // visibility while the heartbeat wiring lands.
        const telemetryFreshness: TelemetryFreshness = "online";
        recordUserVisibleStub("pdm_schedule", "telemetry_freshness_default");

        const bufferDays = computeBufferDays({
          confidence: alert.confidence,
          telemetryFreshness,
          severity: alert.severity,
        });

        const windowResult = computeSchedulingWindow({
          rulP10Days: rulP10,
          rulP50Days: rulP50,
          rulP90Days: rulP90,
          prepDays: PREP_TIME_DAYS,
          bufferDays,
          today,
        });
        const schedulingWindow = {
          earliestStart: windowResult.earliestStart,
          preferredDate: windowResult.preferredDate,
          latestFinish: windowResult.latestFinish,
        };
        const estimatedDowntime = DEFAULT_DOWNTIME_HOURS;
        const estimatedCost = estimatedDowntime * DOWNTIME_COST_PER_HOUR;

        const task: PdmScheduledTask = {
          id: `task-${alert.id}`,
          alertId: alert.id,
          vesselId: alert.vesselId,
          vesselName: alert.vesselName,
          equipmentId: alert.equipmentId,
          equipmentName: alert.equipmentName,
          equipmentType: alert.equipmentType,
          failureMode: alert.failureMode,
          severity: alert.severity,
          rulP10Days: rulP10,
          rulP50Days: rulP50,
          rulP90Days: rulP90,
          confidence: alert.confidence,
          schedulingWindow,
          estimatedDowntimeHours: estimatedDowntime,
          estimatedCost,
          status: alert.workOrderId ? "wo_created" : "draft",
          recommendedActions: [alert.recommendedAction],
          evidenceChips: alert.evidenceChips,
          scheduledDate: schedulingWindow.preferredDate,
          workOrderId: alert.workOrderId || undefined,
          createdAt: alert.detectedAt,
        };

        const blockCheck = determineBlockStatus(
          task,
          scheduledHoursPerDay,
          MAX_VESSEL_HOURS_PER_DAY,
          telemetryFreshness
        );
        if (blockCheck.isBlocked) {
          task.status = "blocked";
          task.blockReason = blockCheck.reason;
          task.blockDetails = blockCheck.details;
          blockedTasks.push(task);
        } else {
          task.status = task.workOrderId ? "wo_created" : "scheduled";
          const dateKey = `${task.vesselId}-${schedulingWindow.preferredDate.toISOString().split("T")[0]}`;
          scheduledHoursPerDay.set(
            dateKey,
            (scheduledHoursPerDay.get(dateKey) || 0) + task.estimatedDowntimeHours
          );
          scheduledTasks.push(task);
        }
      }

      scheduledTasks.sort(
        (a, b) =>
          a.schedulingWindow.preferredDate.getTime() - b.schedulingWindow.preferredDate.getTime()
      );
      blockedTasks.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const tasksThisWeek = scheduledTasks.filter((t) => {
        const sd = t.scheduledDate ? new Date(t.scheduledDate) : t.schedulingWindow.preferredDate;
        return sd >= weekStart && sd <= weekEnd;
      });

      const unassignedHighRisk = blockedTasks.filter(
        (t) => t.severity === "critical" || t.severity === "high"
      );

      const totalDowntimeHours = scheduledTasks.reduce(
        (sum, t) => sum + t.estimatedDowntimeHours,
        0
      );
      const totalDowntimeCost = scheduledTasks.reduce((sum, t) => sum + t.estimatedCost, 0);

      const kpis: ScheduleKpis = {
        tasksScheduledThisWeek: tasksThisWeek.length,
        scheduledDateRange: `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        unassignedHighRiskCount: unassignedHighRisk.length,
        unassignedUrgency:
          unassignedHighRisk.length > 0
            ? `${unassignedHighRisk.filter((t) => t.rulP10Days <= 7).length > 0 ? "Tomorrow" : "This week"}, ${unassignedHighRisk.length} days-start`
            : "None",
        expectedDowntimeForecastHours: totalDowntimeHours,
        expectedDowntimeForecastCost: totalDowntimeCost,
        forecastPeriod: "Next 7 Days",
        avoidedDowntimeHours: Math.round(totalDowntimeHours * 1.8),
        avoidedDowntimeCost: Math.round(totalDowntimeCost * 3.5),
        avoidedPeriod: "Last 7 Days",
      };

      return {
        data: {
          kpis,
          scheduledTasks,
          blockedTasks,
          vessels: vessels.map((v: VesselBasic) => ({ id: v.id, name: v.name })),
          dateRange: { start: startDate, end: endDate },
        },
      };
    },
  };
}
