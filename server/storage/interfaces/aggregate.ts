import type {
  IOrganizationStorage,
  IUserStorage,
  IDeviceStorage,
  IEquipmentStorage,
  IVesselStorage,
  IWorkOrderStorage,
  IMaintenanceStorage,
  ISensorStorage,
  ISettingsStorage,
} from "./base";

import type {
  ITelemetryStorage,
  ISensorStateStorage,
  IPdmScoreStorage,
} from "./telemetry";

import type {
  IAlertConfigurationStorage,
  IAlertNotificationStorage,
  IAlertSuppressionStorage,
  IAlertCommentStorage,
  IAlertCooldownStorage,
} from "./alerts";

import type {
  ICrewMemberStorage,
  ICrewCertificationStorage,
  ICrewLeaveStorage,
  ICrewAssignmentStorage,
  ICrewRestStorage,
  IShiftTemplateStorage,
  ISkillStorage,
} from "./crew";

import type {
  IDeckLogStorage,
  IEngineLogStorage,
  IFuelEmissionsStorage,
  IVesselTrackStorage,
  IConditionMonitoringStorage,
} from "./logbook";

import type {
  IMLModelStorage,
  IAnomalyDetectionStorage,
  IDigitalTwinStorage,
  IPredictionStorage,
  IMLJobStorage,
} from "./ml";

import type {
  IPartsInventoryStorage,
  IInventoryMovementStorage,
  ISupplierStorage,
  IInventoryReorderStorage,
  IInventoryReportStorage,
} from "./inventory";

export interface INotificationStorage {
  getEmailSettings(orgId?: string): Promise<EmailSettings | undefined>;
  updateEmailSettings(settings: Partial<EmailSettings>, orgId?: string): Promise<EmailSettings>;
  getNotificationQueue(orgId?: string): Promise<NotificationQueueItem[]>;
  createNotification(notification: CreateNotification): Promise<NotificationQueueItem>;
  markNotificationSent(id: string, orgId?: string): Promise<void>;
  markNotificationFailed(id: string, error: string, orgId?: string): Promise<void>;
}

export interface IComplianceStorage {
  getComplianceFindings(orgId?: string): Promise<ComplianceFinding[]>;
  createComplianceFinding(finding: CreateComplianceFinding): Promise<ComplianceFinding>;
  resolveComplianceFinding(id: string, resolution: string, orgId?: string): Promise<ComplianceFinding>;
  getComplianceRules(orgId?: string): Promise<ComplianceRule[]>;
  getComplianceDashboard(orgId?: string): Promise<ComplianceDashboardData>;
}

export interface ISchedulingStorage {
  getSchedulerRuns(orgId?: string): Promise<SchedulerRun[]>;
  createSchedulerRun(run: CreateSchedulerRun): Promise<SchedulerRun>;
  updateSchedulerRun(id: string, run: Partial<SchedulerRun>, orgId?: string): Promise<SchedulerRun>;
  getOptimizationResults(orgId?: string): Promise<OptimizationResult[]>;
  createOptimizationResult(result: CreateOptimizationResult): Promise<OptimizationResult>;
}

export interface ICostSavingsStorage {
  getCostSavingsSummary(orgId?: string): Promise<CostSavingsSummary>;
  getCostSavingsTrend(period: string, orgId?: string): Promise<CostSavingsTrend[]>;
  calculateCostSavings(params: CostSavingsParams): Promise<CostSavingsCalculation>;
  recordCostSaving(saving: CreateCostSaving): Promise<CostSaving>;
}

export interface IIntegrationsStorage {
  getFmccConfig(orgId?: string): Promise<FmccConfig | undefined>;
  updateFmccConfig(config: Partial<FmccConfig>, orgId?: string): Promise<FmccConfig>;
  getFmccReadings(orgId?: string): Promise<FmccReading[]>;
  createFmccReading(reading: CreateFmccReading): Promise<FmccReading>;
  getStormgeoConfig(orgId?: string): Promise<StormgeoConfig | undefined>;
  updateStormgeoConfig(config: Partial<StormgeoConfig>, orgId?: string): Promise<StormgeoConfig>;
}

export interface IStorage {
  organizations: IOrganizationStorage;
  users: IUserStorage;
  devices: IDeviceStorage;
  equipment: IEquipmentStorage;
  vessels: IVesselStorage;
  workOrders: IWorkOrderStorage;
  maintenance: IMaintenanceStorage;
  settings: ISettingsStorage;
  
  telemetry: ITelemetryStorage;
  sensorState: ISensorStateStorage;
  pdmScores: IPdmScoreStorage;
  sensors: ISensorStorage;
  
  alertConfigurations: IAlertConfigurationStorage;
  alertNotifications: IAlertNotificationStorage;
  alertSuppressions: IAlertSuppressionStorage;
  alertComments: IAlertCommentStorage;
  alertCooldowns: IAlertCooldownStorage;
  
  crewMembers: ICrewMemberStorage;
  crewCertifications: ICrewCertificationStorage;
  crewLeave: ICrewLeaveStorage;
  crewAssignments: ICrewAssignmentStorage;
  crewRest: ICrewRestStorage;
  shiftTemplates: IShiftTemplateStorage;
  skills: ISkillStorage;
  
  deckLog: IDeckLogStorage;
  engineLog: IEngineLogStorage;
  fuelEmissions: IFuelEmissionsStorage;
  vesselTrack: IVesselTrackStorage;
  conditionMonitoring: IConditionMonitoringStorage;
  
  mlModels: IMLModelStorage;
  anomalyDetection: IAnomalyDetectionStorage;
  digitalTwins: IDigitalTwinStorage;
  predictions: IPredictionStorage;
  mlJobs: IMLJobStorage;
  
  partsInventory: IPartsInventoryStorage;
  inventoryMovements: IInventoryMovementStorage;
  suppliers: ISupplierStorage;
  inventoryReorders: IInventoryReorderStorage;
  inventoryReports: IInventoryReportStorage;
  
  notifications: INotificationStorage;
  compliance: IComplianceStorage;
  scheduling: ISchedulingStorage;
  costSavings: ICostSavingsStorage;
  integrations: IIntegrationsStorage;
}

export interface EmailSettings {
  id: string;
  orgId: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure?: boolean;
  fromAddress?: string;
  enabled: boolean;
}

export interface NotificationQueueItem {
  id: string;
  orgId: string;
  type: "email" | "sms" | "push" | "webhook";
  recipient: string;
  subject?: string;
  content: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  error?: string;
  createdAt: Date;
  sentAt?: Date;
}

export interface CreateNotification {
  orgId: string;
  type: "email" | "sms" | "push" | "webhook";
  recipient: string;
  subject?: string;
  content: string;
}

export interface ComplianceFinding {
  id: string;
  orgId: string;
  ruleId: string;
  entityType: string;
  entityId: string;
  severity: "critical" | "major" | "minor";
  description: string;
  status: "open" | "resolved" | "waived";
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface CreateComplianceFinding {
  orgId: string;
  ruleId: string;
  entityType: string;
  entityId: string;
  severity: "critical" | "major" | "minor";
  description: string;
}

export interface ComplianceRule {
  id: string;
  orgId: string;
  name: string;
  category: string;
  description: string;
  evaluator: string;
  severity: "critical" | "major" | "minor";
  enabled: boolean;
}

export interface ComplianceDashboardData {
  totalFindings: number;
  openFindings: number;
  criticalFindings: number;
  complianceScore: number;
  findingsByCategory: Record<string, number>;
  trendLast30Days: Array<{ date: string; count: number }>;
}

export interface SchedulerRun {
  id: string;
  orgId: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
}

export interface CreateSchedulerRun {
  orgId: string;
  type: string;
}

export interface OptimizationResult {
  id: string;
  orgId: string;
  schedulerRunId: string;
  score: number;
  improvements: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateOptimizationResult {
  orgId: string;
  schedulerRunId: string;
  score: number;
  improvements: Record<string, unknown>;
}

export interface CostSavingsSummary {
  totalSaved: number;
  preventedDowntime: number;
  maintenanceOptimization: number;
  fuelEfficiency: number;
  laborEfficiency: number;
  period: string;
}

export interface CostSavingsTrend {
  date: string;
  amount: number;
  category: string;
}

export interface CostSavingsParams {
  equipmentId?: string;
  startDate?: Date;
  endDate?: Date;
  categories?: string[];
}

export interface CostSavingsCalculation {
  estimatedSavings: number;
  breakdown: Record<string, number>;
  confidence: number;
}

export interface CostSaving {
  id: string;
  orgId: string;
  category: string;
  amount: number;
  description: string;
  equipmentId?: string;
  workOrderId?: string;
  createdAt: Date;
}

export interface CreateCostSaving {
  orgId: string;
  category: string;
  amount: number;
  description: string;
  equipmentId?: string;
  workOrderId?: string;
}

export interface FmccConfig {
  id: string;
  orgId: string;
  enabled: boolean;
  host?: string;
  port?: number;
  pollingInterval?: number;
  lastPollAt?: Date;
}

export interface FmccReading {
  id: string;
  orgId: string;
  vesselId: string;
  timestamp: Date;
  fuelFlowRate: number;
  totalConsumed: number;
  temperature?: number;
}

export interface CreateFmccReading {
  orgId: string;
  vesselId: string;
  timestamp: Date;
  fuelFlowRate: number;
  totalConsumed: number;
  temperature?: number;
}

export interface StormgeoConfig {
  id: string;
  orgId: string;
  enabled: boolean;
  apiKey?: string;
  lastSyncAt?: Date;
}
