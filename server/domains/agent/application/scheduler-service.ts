import type { AgentRepositoryPort } from "../domain/ports";
import type { AgentSchedule } from "@shared/schema";
import { db } from "../../../db";
import { notificationQueue } from "@shared/schema";
import { getRegisteredToolNames } from "../tools";
import cron from "node-cron";

const WRITE_TOOLS = ["draftWorkOrder"];
const MAX_CONSECUTIVE_FAILURES = 3;

export class SchedulerService {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    private repo: AgentRepositoryPort,
    private runAgentFn: (orgId: string, userId: string | undefined, conversationId: string | undefined, message: string, userRole?: string, options?: { toolAllowlist?: string[] | null; maxTokenBudget?: number }) => Promise<any>,
  ) {}

  async initialize(orgId: string): Promise<void> {
    const schedules = await this.repo.schedules.list(orgId);
    for (const sched of schedules) {
      if (sched.enabled) {
        this.scheduleJob(sched);
      }
    }
    console.log(`[SchedulerService] Initialized ${schedules.filter(s => s.enabled).length} schedules for org ${orgId}`);
  }

  scheduleJob(schedule: AgentSchedule): void {
    this.cancelJob(schedule.id);

    if (!cron.validate(schedule.cronExpression)) {
      console.warn(`[SchedulerService] Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
      return;
    }

    const scheduleId = schedule.id;
    const orgId = schedule.orgId;

    const task = cron.schedule(schedule.cronExpression, async () => {
      const fresh = await this.repo.schedules.get(scheduleId, orgId);
      if (!fresh || !fresh.enabled) {
        this.cancelJob(scheduleId);
        return;
      }
      await this.executeSchedule(fresh);
    });

    this.cronJobs.set(schedule.id, task);
    console.log(`[SchedulerService] Scheduled job ${schedule.id} (${schedule.name}): ${schedule.cronExpression}`);
  }

  cancelJob(scheduleId: string): void {
    const job = this.cronJobs.get(scheduleId);
    if (job) {
      job.stop();
      this.cronJobs.delete(scheduleId);
    }
  }

  async executeSchedule(schedule: AgentSchedule): Promise<void> {
    const run = await this.repo.schedules.createRun({
      scheduleId: schedule.id,
      status: "running",
    });

    const filteredTools = this.getFilteredTools(schedule);
    const runOptions = { toolAllowlist: filteredTools, maxTokenBudget: schedule.maxTokenBudget || 4000 };

    try {
      const result = await this.runAgentFn(schedule.orgId, undefined, undefined, schedule.prompt, "system", runOptions);

      await this.repo.schedules.updateRun(run.id, {
        status: "completed",
        output: { response: result.finalResponse, toolCallCount: result.toolCallCount, tokensUsed: result.totalTokens },
        tokenUsage: result.totalTokens,
        completedAt: new Date(),
      });

      await this.repo.schedules.update(schedule.id, {
        lastRunAt: new Date(),
        consecutiveFailures: 0,
      });

      await this.deliverOutput(schedule, result.finalResponse, result);

      console.log(`[SchedulerService] Schedule ${schedule.id} completed successfully`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      await this.repo.schedules.updateRun(run.id, {
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      });

      console.log(`[SchedulerService] Schedule ${schedule.id} failed, retrying once...`);
      try {
        const retryResult = await this.runAgentFn(schedule.orgId, undefined, undefined, schedule.prompt, "system", runOptions);

        const retryRun = await this.repo.schedules.createRun({ scheduleId: schedule.id, status: "running" });
        await this.repo.schedules.updateRun(retryRun.id, {
          status: "completed",
          output: { response: retryResult.finalResponse, toolCallCount: retryResult.toolCallCount, tokensUsed: retryResult.totalTokens, retried: true },
          tokenUsage: retryResult.totalTokens,
          completedAt: new Date(),
        });

        await this.repo.schedules.update(schedule.id, {
          lastRunAt: new Date(),
          consecutiveFailures: 0,
        });

        await this.deliverOutput(schedule, retryResult.finalResponse, retryResult);
        console.log(`[SchedulerService] Schedule ${schedule.id} retry succeeded`);
        return;
      } catch (retryErr: unknown) {
        const retryErrMsg = retryErr instanceof Error ? retryErr.message : "Unknown error";
        console.error(`[SchedulerService] Schedule ${schedule.id} retry also failed:`, retryErrMsg);
      }

      const freshSchedule = await this.repo.schedules.get(schedule.id, schedule.orgId);
      const currentFailCount = freshSchedule?.consecutiveFailures || 0;
      const newFailCount = currentFailCount + 1;

      await this.repo.schedules.update(schedule.id, {
        consecutiveFailures: newFailCount,
      });

      if (newFailCount >= MAX_CONSECUTIVE_FAILURES) {
        await this.repo.schedules.update(schedule.id, { enabled: false });
        this.cancelJob(schedule.id);
        console.warn(`[SchedulerService] Schedule ${schedule.id} auto-disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`);
      }

      await this.alertAdminFailure(schedule, errorMsg, newFailCount);
      console.error(`[SchedulerService] Schedule ${schedule.id} failed:`, errorMsg);
    }
  }

  getFilteredTools(schedule: AgentSchedule): string[] | null {
    const allowedTools = schedule.allowedTools as string[] | null;

    if (!schedule.allowWriteTools) {
      const base = allowedTools || getRegisteredToolNames();
      return base.filter(t => !WRITE_TOOLS.includes(t));
    }

    return allowedTools;
  }

  private async deliverOutput(schedule: AgentSchedule, response: string, result: any): Promise<void> {
    const dest = schedule.outputDestination || "notification";

    try {
      if (dest === "notification" || dest === "both") {
        await db.insert(notificationQueue).values({
          orgId: schedule.orgId,
          notificationType: "agent_schedule",
          subject: `Scheduled Run: ${schedule.name}`,
          body: response.length > 500 ? response.slice(0, 497) + "..." : response,
          recipients: [],
          relatedEntityType: "agent_schedule",
          relatedEntityId: schedule.id,
          status: "pending",
        });
      }

      if (dest === "email" || dest === "both") {
        await db.insert(notificationQueue).values({
          orgId: schedule.orgId,
          notificationType: "agent_schedule_email",
          subject: `AI Copilot Report: ${schedule.name}`,
          body: response,
          recipients: [],
          relatedEntityType: "agent_schedule",
          relatedEntityId: schedule.id,
          status: "pending",
        });
      }

      if (dest === "report" || dest === "both") {
        try {
          const { generatedReports } = await import("@shared/schema/scheduled-reports");
          await db.insert(generatedReports).values({
            scheduleId: schedule.id,
            orgId: schedule.orgId,
            reportType: "agent_schedule",
            format: "json",
            filename: `agent-schedule-${schedule.id}-${Date.now()}.json`,
            filePath: `agent-reports/${schedule.id}`,
            fileSize: Buffer.byteLength(response, "utf8"),
            status: "completed",
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            metadata: { response, toolCallCount: result.toolCallCount, tokensUsed: result.totalTokens },
          });
        } catch (reportErr) {
          console.warn("[SchedulerService] Report storage failed, falling back to notification:", reportErr instanceof Error ? reportErr.message : "unknown");
          await db.insert(notificationQueue).values({
            orgId: schedule.orgId,
            notificationType: "agent_schedule_report",
            subject: `Report: ${schedule.name} — ${new Date().toLocaleDateString()}`,
            body: response,
            recipients: [],
            relatedEntityType: "agent_schedule",
            relatedEntityId: schedule.id,
            status: "pending",
          });
        }
      }
    } catch (err) {
      console.warn("[SchedulerService] Output delivery failed (non-blocking):", err instanceof Error ? err.message : "unknown");
    }
  }

  private async alertAdminFailure(schedule: AgentSchedule, errorMsg: string, failCount: number): Promise<void> {
    try {
      const autoDisabled = failCount >= MAX_CONSECUTIVE_FAILURES;
      await db.insert(notificationQueue).values({
        orgId: schedule.orgId,
        notificationType: "agent_schedule_failure",
        subject: `Agent Schedule Failed: ${schedule.name}${autoDisabled ? " (Auto-Disabled)" : ""}`,
        body: `Schedule "${schedule.name}" failed${autoDisabled ? ` and was auto-disabled after ${failCount} consecutive failures` : ` (${failCount}/${MAX_CONSECUTIVE_FAILURES} failures)`}. Error: ${errorMsg}`,
        recipients: [],
        relatedEntityType: "agent_schedule",
        relatedEntityId: schedule.id,
        status: "pending",
      });
    } catch (err) {
      console.warn("[SchedulerService] Failed to alert admin:", err instanceof Error ? err.message : "unknown");
    }
  }

  shutdown(): void {
    for (const [, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();
  }
}
