import type { AgentRepositoryPort } from "../domain/ports";
import type { AgentSchedule } from "@shared/schema";

export class SchedulerService {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private repo: AgentRepositoryPort,
    private runAgentFn: (orgId: string, userId: string | undefined, conversationId: string | undefined, message: string) => Promise<any>,
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

    const intervalMs = this.cronToMs(schedule.cronExpression);
    if (intervalMs <= 0) {
      console.warn(`[SchedulerService] Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
      return;
    }

    const timer = setInterval(async () => {
      await this.executeSchedule(schedule);
    }, intervalMs);

    this.timers.set(schedule.id, timer);
  }

  cancelJob(scheduleId: string): void {
    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(scheduleId);
    }
  }

  async executeSchedule(schedule: AgentSchedule): Promise<void> {
    const run = await this.repo.schedules.createRun({
      scheduleId: schedule.id,
      status: "running",
    });

    try {
      const result = await this.runAgentFn(schedule.orgId, undefined, undefined, schedule.prompt);

      await this.repo.schedules.updateRun(run.id, {
        status: "completed",
        output: { response: result.finalResponse, toolCallCount: result.toolCallCount },
        tokenUsage: result.totalTokens,
        completedAt: new Date(),
      });

      await this.repo.schedules.update(schedule.id, { lastRunAt: new Date() });

      console.log(`[SchedulerService] Schedule ${schedule.id} completed successfully`);
    } catch (err: unknown) {
      await this.repo.schedules.updateRun(run.id, {
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
        completedAt: new Date(),
      });
      console.error(`[SchedulerService] Schedule ${schedule.id} failed:`, err instanceof Error ? err.message : "Unknown error");
    }
  }

  private cronToMs(cron: string): number {
    const simplified: Record<string, number> = {
      "*/5 * * * *": 300000,
      "*/15 * * * *": 900000,
      "*/30 * * * *": 1800000,
      "0 * * * *": 3600000,
      "0 */2 * * *": 7200000,
      "0 */4 * * *": 14400000,
      "0 */6 * * *": 21600000,
      "0 */8 * * *": 28800000,
      "0 */12 * * *": 43200000,
      "0 0 * * *": 86400000,
      "0 8 * * 1": 604800000,
    };
    return simplified[cron] || 3600000;
  }

  shutdown(): void {
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
    }
    this.timers.clear();
  }
}
