/**
 * Report Generation Service
 * Handles report data collection, formatting, and delivery
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  IGeneratedReportRepository,
  IPdfGeneratorAdapter,
  IReportStorageAdapter,
  IReportDeliveryAdapter,
  IEventPublisher,
  ReportGeneratorRegistry,
} from '../domain/ports.js';
import type {
  ReportScheduleConfig,
  GeneratedReport,
  ReportData,
  ReportSection,
  ReportSummary,
  ReportType,
} from '../domain/types.js';
import {
  createEvent,
  type ReportGenerationStartedEvent,
  type ReportGeneratedEvent,
  type ReportGenerationFailedEvent,
  type ReportDeliveredEvent,
  type ReportDeliveryFailedEvent,
} from '../domain/events.js';
import { logger } from '../../../utils/logger.js';
import { DbSettingsStorage } from '../../../db/system-admin/db-settings.js';
import { DEFAULT_SCHEDULED_REPORTS_SETTINGS, type ScheduledReportsSettings } from '../interfaces/routes.js';

const LOG_CTX = 'ReportGenerationService';
const SETTINGS_CATEGORY = 'scheduled_reports';
const settingsStorage = new DbSettingsStorage();

export class ReportGenerationService {
  constructor(
    private readonly reportRepository: IGeneratedReportRepository,
    private readonly generatorRegistry: ReportGeneratorRegistry,
    private readonly pdfGenerator: IPdfGeneratorAdapter,
    private readonly storageAdapter: IReportStorageAdapter,
    private readonly deliveryAdapter: IReportDeliveryAdapter,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async generateAndDeliver(schedule: ReportScheduleConfig): Promise<GeneratedReport> {
    const reportId = uuidv4();
    const startTime = Date.now();
    const settings = await this.getSettings(schedule.orgId);

    await this.eventPublisher.publish(
      createEvent<ReportGenerationStartedEvent>('ReportGenerationStarted', schedule.orgId, {
        reportId,
        scheduleId: schedule.id,
        reportType: schedule.reportType,
      })
    );

    let report: GeneratedReport;

    try {
      const data = await this.collectReportData(schedule);
      const content = await this.pdfGenerator.generate(data, schedule.format);
      const filename = this.generateFilename(schedule, data.generatedAt);
      const filePath = await this.storageAdapter.save(filename, content);
      const generationTimeMs = Date.now() - startTime;

      report = await this.reportRepository.create({
        scheduleId: schedule.id,
        orgId: schedule.orgId,
        reportType: schedule.reportType,
        format: schedule.format,
        filename,
        filePath,
        fileSize: content.length,
        status: 'completed',
        generatedAt: new Date(),
        deliveredAt: null,
        expiresAt: this.calculateExpiryDate(settings.reportRetentionDays),
        metadata: {
          generationTimeMs,
          vesselIds: schedule.vesselIds,
          sections: data.sections.length,
        },
        errorMessage: null,
      });

      await this.eventPublisher.publish(
        createEvent<ReportGeneratedEvent>('ReportGenerated', schedule.orgId, {
          reportId: report.id,
          scheduleId: schedule.id,
          reportType: schedule.reportType,
          format: schedule.format,
          filename,
          fileSize: content.length,
          generationTimeMs,
        })
      );

      if (schedule.recipients.length > 0) {
        await this.deliverReport(report, schedule.recipients, content);
      }

      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LOG_CTX, `Report generation failed for ${schedule.id}`, errorMessage);

      report = await this.reportRepository.create({
        scheduleId: schedule.id,
        orgId: schedule.orgId,
        reportType: schedule.reportType,
        format: schedule.format,
        filename: '',
        filePath: '',
        fileSize: 0,
        status: 'failed',
        generatedAt: new Date(),
        deliveredAt: null,
        expiresAt: this.calculateExpiryDate(settings.reportRetentionDays),
        metadata: {},
        errorMessage,
      });

      await this.eventPublisher.publish(
        createEvent<ReportGenerationFailedEvent>('ReportGenerationFailed', schedule.orgId, {
          reportId: report.id,
          scheduleId: schedule.id,
          reportType: schedule.reportType,
          errorMessage,
        })
      );

      throw error;
    }
  }

  async generateOnDemand(
    orgId: string,
    reportType: ReportType,
    vesselIds: string[] | null,
    format: 'pdf' | 'csv' | 'json'
  ): Promise<{ content: Buffer; filename: string; contentType: string }> {
    const generator = this.generatorRegistry.get(reportType);
    if (!generator) {
      throw new Error(`No generator found for report type: ${reportType}`);
    }

    const rawData = await generator.generate(orgId, vesselIds);
    const data = this.formatReportData(reportType, rawData, vesselIds);
    const content = await this.pdfGenerator.generate(data, format);
    const filename = this.generateFilename(
      { reportType, format } as ReportScheduleConfig,
      new Date()
    );

    return {
      content,
      filename,
      contentType: this.pdfGenerator.getContentType(format),
    };
  }

  private async collectReportData(schedule: ReportScheduleConfig): Promise<ReportData> {
    const generator = this.generatorRegistry.get(schedule.reportType);
    if (!generator) {
      throw new Error(`No generator found for report type: ${schedule.reportType}`);
    }

    const rawData = await generator.generate(schedule.orgId, schedule.vesselIds);
    return this.formatReportData(schedule.reportType, rawData, schedule.vesselIds);
  }

  private formatReportData(
    reportType: ReportType,
    rawData: unknown,
    vesselIds: string[] | null
  ): ReportData {
    const now = new Date();
    const title = this.getReportTitle(reportType);

    const sections = this.buildSections(reportType, rawData);
    const summary = this.buildSummary(reportType, rawData);

    return {
      title,
      generatedAt: now,
      orgId: '',
      vesselIds,
      sections,
      summary,
    };
  }

  private getReportTitle(reportType: ReportType): string {
    const titles: Record<ReportType, string> = {
      fleet_health: 'Fleet Health Summary Report',
      maintenance_due: 'Upcoming Maintenance Report',
      inventory_status: 'Inventory Status Report',
      crew_compliance: 'Crew Compliance Report',
      cost_summary: 'Maintenance Cost Summary',
    };
    return titles[reportType] || 'Report';
  }

  private buildSections(reportType: ReportType, data: unknown): ReportSection[] {
    const sections: ReportSection[] = [];

    switch (reportType) {
      case 'fleet_health': {
        const healthData = data as any;
        if (healthData.vessels) {
          sections.push({
            title: 'Vessel Health Overview',
            type: 'table',
            data: healthData.vessels,
          });
        }
        if (healthData.criticalEquipment?.length > 0) {
          sections.push({
            title: 'Critical Equipment Alerts',
            type: 'table',
            data: healthData.criticalEquipment,
          });
        }
        if (healthData.upcomingMaintenance?.length > 0) {
          sections.push({
            title: 'Upcoming Maintenance',
            type: 'table',
            data: healthData.upcomingMaintenance,
          });
        }
        break;
      }

      case 'maintenance_due':
        sections.push({
          title: 'Scheduled Maintenance Tasks',
          type: 'table',
          data,
        });
        break;

      case 'inventory_status': {
        const invData = data as any;
        if (invData.lowStockItems?.length > 0) {
          sections.push({
            title: 'Low Stock Items',
            type: 'table',
            data: invData.lowStockItems,
          });
        }
        if (invData.vesselBreakdown?.length > 0) {
          sections.push({
            title: 'Inventory by Vessel',
            type: 'table',
            data: invData.vesselBreakdown,
          });
        }
        break;
      }

      case 'crew_compliance': {
        const crewData = data as any;
        if (crewData.expiringCertifications?.length > 0) {
          sections.push({
            title: 'Expiring Certifications',
            type: 'table',
            data: crewData.expiringCertifications,
          });
        }
        if (crewData.hoursOfRestViolations?.length > 0) {
          sections.push({
            title: 'Hours of Rest Violations',
            type: 'table',
            data: crewData.hoursOfRestViolations,
          });
        }
        break;
      }

      case 'cost_summary': {
        const costData = data as any;
        sections.push({
          title: 'Cost Overview',
          type: 'text',
          data: {
            totalCost: costData.totalMaintenanceCost,
            savings: costData.savingsFromPredictive,
          },
        });
        if (costData.costByVessel?.length > 0) {
          sections.push({
            title: 'Cost by Vessel',
            type: 'table',
            data: costData.costByVessel,
          });
        }
        break;
      }
    }

    return sections;
  }

  private buildSummary(reportType: ReportType, data: unknown): ReportSummary {
    const summary: ReportSummary = {
      totalItems: 0,
      criticalCount: 0,
      warningCount: 0,
      normalCount: 0,
      highlights: [],
    };

    switch (reportType) {
      case 'fleet_health': {
        const healthData = data as any;
        summary.totalItems = healthData.vessels?.length || 0;
        summary.criticalCount = healthData.criticalEquipment?.length || 0;
        summary.highlights.push(`Overall fleet health score: ${healthData.overallScore || 'N/A'}%`);
        break;
      }

      case 'inventory_status': {
        const invData = data as any;
        summary.totalItems = invData.lowStockItems?.length || 0;
        summary.criticalCount = invData.reorderRequired || 0;
        summary.highlights.push(`${summary.criticalCount} items require reorder`);
        break;
      }

      case 'crew_compliance': {
        const crewData = data as any;
        summary.criticalCount = crewData.expiringCertifications?.length || 0;
        summary.warningCount = crewData.hoursOfRestViolations?.length || 0;
        summary.highlights.push(`Compliance score: ${crewData.complianceScore || 'N/A'}%`);
        break;
      }
    }

    return summary;
  }

  private async deliverReport(
    report: GeneratedReport,
    recipients: string[],
    content: Buffer
  ): Promise<void> {
    try {
      const result = await this.deliveryAdapter.deliver(report, recipients, content);

      if (result.success) {
        await this.reportRepository.update(report.id, {
          status: 'delivered',
          deliveredAt: new Date(),
        });

        await this.eventPublisher.publish(
          createEvent<ReportDeliveredEvent>('ReportDelivered', report.orgId, {
            reportId: report.id,
            scheduleId: report.scheduleId,
            recipients,
            deliveryMethod: 'email',
          })
        );
      } else {
        throw new Error(result.error || 'Delivery failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LOG_CTX, `Failed to deliver report ${report.id}`, errorMessage);

      await this.eventPublisher.publish(
        createEvent<ReportDeliveryFailedEvent>('ReportDeliveryFailed', report.orgId, {
          reportId: report.id,
          scheduleId: report.scheduleId,
          recipients,
          errorMessage,
        })
      );
    }
  }

  private generateFilename(schedule: Partial<ReportScheduleConfig>, generatedAt: Date): string {
    const date = generatedAt.toISOString().split('T')[0];
    const time = generatedAt.toISOString().split('T')[1].substring(0, 5).replace(':', '');
    const ext = schedule.format || 'pdf';
    return `${schedule.reportType}_${date}_${time}.${ext}`;
  }

  private calculateExpiryDate(retentionDays: number): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + retentionDays);
    return expiry;
  }

  private async getSettings(orgId: string): Promise<ScheduledReportsSettings> {
    try {
      const dbSettings = await settingsStorage.getSettingsByCategory(orgId, SETTINGS_CATEGORY);
      const settings: ScheduledReportsSettings = { ...DEFAULT_SCHEDULED_REPORTS_SETTINGS };
      
      for (const setting of dbSettings) {
        if (setting.key === 'report_retention_days' && typeof setting.value === 'number') {
          settings.reportRetentionDays = setting.value;
        } else if (setting.key === 'default_timezone' && typeof setting.value === 'string') {
          settings.defaultTimezone = setting.value;
        } else if (setting.key === 'max_recipients_per_schedule' && typeof setting.value === 'number') {
          settings.maxRecipientsPerSchedule = setting.value;
        } else if (setting.key === 'report_generation_timeout_seconds' && typeof setting.value === 'number') {
          settings.reportGenerationTimeoutSeconds = setting.value;
        }
      }
      
      return settings;
    } catch (error) {
      logger.warn(LOG_CTX, 'Failed to load settings, using defaults', String(error));
      return DEFAULT_SCHEDULED_REPORTS_SETTINGS;
    }
  }
}
