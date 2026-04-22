/**
 * Report Scheduler Service
 * Orchestrates report scheduling, execution, and delivery
 */

import cron from 'node-cron';
import { isCloudMode, canUseCloudFeature } from '../../../config/runtimeEnv.js';
import type {
  IReportScheduleRepository,
  IGeneratedReportRepository,
  IEventPublisher,
} from '../domain/ports.js';
import type { ReportScheduleConfig, ReportScheduleInput } from '../domain/types.js';
import { createEvent, type ReportScheduleCreatedEvent, type ReportScheduleUpdatedEvent, type ReportScheduleDeletedEvent } from '../domain/events.js';
import { ReportGenerationService } from './report-generation-service.js';
import { logger } from '../../../utils/logger.js';

const LOG_CTX = 'ReportSchedulerService';

export class ReportSchedulerService {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized = false;

  constructor(
    private readonly scheduleRepository: IReportScheduleRepository,
    private readonly reportRepository: IGeneratedReportRepository,
    private readonly generationService: ReportGenerationService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!isCloudMode || !canUseCloudFeature('scheduledReports')) {
      logger.info(LOG_CTX, 'Scheduled reports disabled in vessel mode');
      return;
    }

    logger.info(LOG_CTX, 'Initializing scheduled reports service');

    await this.cleanupExpiredReports();
    await this.loadSchedules();
    this.startCleanupJob();

    this.isInitialized = true;
    logger.info(LOG_CTX, 'Scheduled reports service initialized');
  }

  async shutdown(): Promise<void> {
    logger.info(LOG_CTX, 'Shutting down scheduled reports service');
    
    for (const [id, job] of this.cronJobs) {
      job.stop();
      logger.info(LOG_CTX, `Stopped cron job for schedule ${id}`);
    }
    
    this.cronJobs.clear();
    this.isInitialized = false;
  }

  async createSchedule(
    orgId: string,
    input: ReportScheduleInput,
    createdBy: string
  ): Promise<ReportScheduleConfig> {
    const cronExpr = input.cronExpression || this.frequencyToCron(input.frequency);
    
    if (!cron.validate(cronExpr)) {
      throw new Error(`Invalid cron expression: ${cronExpr}`);
    }

    const schedule = await this.scheduleRepository.create(orgId, {
      ...input,
      cronExpression: cronExpr,
    }, createdBy);

    if (schedule.enabled) {
      this.scheduleJob(schedule);
    }

    await this.eventPublisher.publish(
      createEvent<ReportScheduleCreatedEvent>('ReportScheduleCreated', orgId, {
        scheduleId: schedule.id,
        reportType: schedule.reportType,
        name: schedule.name,
        cronExpression: schedule.cronExpression,
        createdBy,
      })
    );

    return schedule;
  }

  async updateSchedule(
    id: string,
    orgId: string,
    input: Partial<ReportScheduleInput>,
    updatedBy: string
  ): Promise<ReportScheduleConfig> {
    if (input.cronExpression && !cron.validate(input.cronExpression)) {
      throw new Error(`Invalid cron expression: ${input.cronExpression}`);
    }

    const schedule = await this.scheduleRepository.update(id, orgId, input);

    this.unscheduleJob(id);
    
    if (schedule.enabled) {
      this.scheduleJob(schedule);
    }

    await this.eventPublisher.publish(
      createEvent<ReportScheduleUpdatedEvent>('ReportScheduleUpdated', orgId, {
        scheduleId: id,
        changes: input,
        updatedBy,
      })
    );

    return schedule;
  }

  async deleteSchedule(id: string, orgId: string, deletedBy: string): Promise<void> {
    this.unscheduleJob(id);
    await this.scheduleRepository.delete(id, orgId);

    await this.eventPublisher.publish(
      createEvent<ReportScheduleDeletedEvent>('ReportScheduleDeleted', orgId, {
        scheduleId: id,
        deletedBy,
      })
    );
  }

  async getSchedule(id: string, orgId: string): Promise<ReportScheduleConfig | null> {
    return this.scheduleRepository.findById(id, orgId);
  }

  async getSchedulesByOrg(orgId: string): Promise<ReportScheduleConfig[]> {
    return this.scheduleRepository.findByOrg(orgId);
  }

  async runScheduleNow(id: string, orgId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findById(id, orgId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    logger.info(LOG_CTX, `Manual run triggered for schedule ${id}`);
    await this.executeSchedule(schedule);
  }

  async getReportHistory(scheduleId: string, orgId: string, limit = 10): Promise<any[]> {
    return this.reportRepository.findBySchedule(scheduleId, orgId, limit);
  }

  async getAllReports(orgId: string, limit = 50): Promise<any[]> {
    return this.reportRepository.findByOrg(orgId, limit);
  }

  private async loadSchedules(): Promise<void> {
    const now = new Date();
    const schedules = await this.scheduleRepository.findDueSchedules(now);

    for (const schedule of schedules) {
      if (schedule.enabled) {
        this.scheduleJob(schedule);
      }
    }

    logger.info(LOG_CTX, `Loaded ${schedules.length} report schedules`);
  }

  private scheduleJob(schedule: ReportScheduleConfig): void {
    if (this.cronJobs.has(schedule.id)) {
      return;
    }

    const job = cron.schedule(
      schedule.cronExpression,
      async () => {
        await this.executeSchedule(schedule);
      },
      {
        timezone: schedule.timezone || 'UTC',
      }
    );

    this.cronJobs.set(schedule.id, job);
    logger.info(LOG_CTX, `Scheduled job for ${schedule.name} (${schedule.id}): ${schedule.cronExpression}`);
  }

  private unscheduleJob(scheduleId: string): void {
    const job = this.cronJobs.get(scheduleId);
    if (job) {
      job.stop();
      this.cronJobs.delete(scheduleId);
      logger.info(LOG_CTX, `Unscheduled job ${scheduleId}`);
    }
  }

  private async executeSchedule(schedule: ReportScheduleConfig): Promise<void> {
    logger.info(LOG_CTX, `Executing schedule ${schedule.id}: ${schedule.name}`);

    try {
      await this.generationService.generateAndDeliver(schedule);

      const now = new Date();
      const nextRun = this.calculateNextRun(schedule.cronExpression, schedule.timezone);
      await this.scheduleRepository.updateLastRun(schedule.id, now, nextRun);

      logger.info(LOG_CTX, `Schedule ${schedule.id} completed, next run: ${nextRun.toISOString()}`);
    } catch (error) {
      logger.error(LOG_CTX, `Schedule ${schedule.id} failed`, String(error));
    }
  }

  private async cleanupExpiredReports(): Promise<void> {
    try {
      const deleted = await this.reportRepository.deleteExpired();
      if (deleted > 0) {
        logger.info(LOG_CTX, `Cleaned up ${deleted} expired reports`);
      }
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to cleanup expired reports', String(error));
    }
  }

  private startCleanupJob(): void {
    cron.schedule('0 3 * * *', async () => {
      await this.cleanupExpiredReports();
    });
  }

  private frequencyToCron(frequency: string): string {
    switch (frequency) {
      case 'daily':
        return '0 8 * * *';
      case 'weekly':
        return '0 8 * * 1';
      case 'monthly':
        return '0 8 1 * *';
      default:
        return '0 8 * * *';
    }
  }

  private calculateNextRun(cronExpression: string, timezone: string): Date {
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(8, 0, 0, 0);
    return nextRun;
  }
}
