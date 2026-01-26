/**
 * Scheduled Reports Domain - Ports
 * Interfaces for adapters (hexagonal architecture)
 */

import type {
  ReportScheduleConfig,
  ReportScheduleInput,
  GeneratedReport,
  ReportData,
  ReportType,
  ReportFormat,
  FleetHealthData,
  InventoryStatusData,
  CrewComplianceData,
  CostSummaryData,
  MaintenanceItem,
} from './types.js';
import type { ScheduledReportEvent } from './events.js';

export interface IReportScheduleRepository {
  create(orgId: string, input: ReportScheduleInput, createdBy: string): Promise<ReportScheduleConfig>;
  update(id: string, orgId: string, input: Partial<ReportScheduleInput>): Promise<ReportScheduleConfig>;
  delete(id: string, orgId: string): Promise<void>;
  findById(id: string, orgId: string): Promise<ReportScheduleConfig | null>;
  findByOrg(orgId: string): Promise<ReportScheduleConfig[]>;
  findDueSchedules(now: Date): Promise<ReportScheduleConfig[]>;
  updateLastRun(id: string, runAt: Date, nextRunAt: Date): Promise<void>;
}

export interface IGeneratedReportRepository {
  create(report: Omit<GeneratedReport, 'id'>): Promise<GeneratedReport>;
  update(id: string, updates: Partial<GeneratedReport>): Promise<GeneratedReport>;
  findById(id: string, orgId: string): Promise<GeneratedReport | null>;
  findBySchedule(scheduleId: string, orgId: string, limit?: number): Promise<GeneratedReport[]>;
  findByOrg(orgId: string, limit?: number): Promise<GeneratedReport[]>;
  deleteExpired(): Promise<number>;
}

export interface IReportGenerator<T = unknown> {
  readonly reportType: ReportType;
  generate(orgId: string, vesselIds: string[] | null): Promise<T>;
}

export interface IFleetHealthGenerator extends IReportGenerator<FleetHealthData> {
  readonly reportType: 'fleet_health';
}

export interface IMaintenanceDueGenerator extends IReportGenerator<MaintenanceItem[]> {
  readonly reportType: 'maintenance_due';
}

export interface IInventoryStatusGenerator extends IReportGenerator<InventoryStatusData> {
  readonly reportType: 'inventory_status';
}

export interface ICrewComplianceGenerator extends IReportGenerator<CrewComplianceData> {
  readonly reportType: 'crew_compliance';
}

export interface ICostSummaryGenerator extends IReportGenerator<CostSummaryData> {
  readonly reportType: 'cost_summary';
}

export interface IPdfGeneratorAdapter {
  generate(data: ReportData, format: ReportFormat): Promise<Buffer>;
  getContentType(format: ReportFormat): string;
  getFileExtension(format: ReportFormat): string;
}

export interface IReportStorageAdapter {
  save(filename: string, content: Buffer): Promise<string>;
  load(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
}

export interface IReportDeliveryAdapter {
  deliver(
    report: GeneratedReport,
    recipients: string[],
    content: Buffer
  ): Promise<{ success: boolean; error?: string }>;
}

export interface IEventPublisher {
  publish(event: ScheduledReportEvent): Promise<void>;
}

export interface ReportGeneratorRegistry {
  get(reportType: ReportType): IReportGenerator | undefined;
  register(generator: IReportGenerator): void;
  getAll(): IReportGenerator[];
}
