/**
 * Scheduled Reports Domain - Types
 * Core domain types for report scheduling and generation
 */

export type ReportType =
  | "fleet_health"
  | "maintenance_due"
  | "inventory_status"
  | "crew_compliance"
  | "cost_summary";

export type ReportFrequency = "daily" | "weekly" | "monthly" | "custom";

export type ReportFormat = "pdf" | "csv" | "json";

export type ReportStatus = "pending" | "generating" | "completed" | "failed" | "delivered";

export interface ReportScheduleConfig {
  id: string;
  orgId: string;
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  cronExpression: string;
  timezone: string;
  format: ReportFormat;
  recipients: string[];
  vesselIds: string[] | null;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportScheduleInput {
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  cronExpression?: string | undefined;
  timezone?: string | undefined;
  format?: ReportFormat | undefined;
  recipients: string[];
  vesselIds?: string[] | null | undefined;
  enabled?: boolean | undefined;
}

export interface GeneratedReport {
  id: string;
  scheduleId: string;
  orgId: string;
  reportType: ReportType;
  format: ReportFormat;
  filename: string;
  filePath: string;
  fileSize: number;
  status: ReportStatus;
  generatedAt: Date;
  deliveredAt: Date | null;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  errorMessage: string | null;
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  orgId: string;
  vesselIds: string[] | null;
  sections: ReportSection[];
  summary: ReportSummary;
}

export interface ReportSection {
  title: string;
  type: "table" | "chart" | "text" | "list";
  data: unknown;
}

export interface ReportSummary {
  totalItems: number;
  criticalCount: number;
  warningCount: number;
  normalCount: number;
  highlights: string[];
}

export interface FleetHealthData {
  vessels: VesselHealthSummary[];
  overallScore: number;
  criticalEquipment: EquipmentAlert[];
  upcomingMaintenance: MaintenanceItem[];
}

export interface VesselHealthSummary {
  vesselId: string;
  vesselName: string;
  healthScore: number;
  equipmentCount: number;
  criticalCount: number;
  warningCount: number;
  lastUpdated: Date;
}

export interface EquipmentAlert {
  equipmentId: string;
  equipmentName: string;
  vesselName: string;
  severity: "critical" | "warning";
  issue: string;
  predictedFailure: Date | null;
}

export interface MaintenanceItem {
  id: string;
  equipmentName: string;
  vesselName: string;
  taskName: string;
  dueDate: Date;
  priority: string;
}

export interface InventoryStatusData {
  lowStockItems: LowStockItem[];
  reorderRequired: number;
  totalValue: number;
  vesselBreakdown: VesselInventorySummary[];
}

export interface LowStockItem {
  partId: string;
  partName: string;
  partNumber: string;
  currentQuantity: number;
  minimumQuantity: number;
  vesselName: string;
  estimatedCost: number;
}

export interface VesselInventorySummary {
  vesselId: string;
  vesselName: string;
  totalParts: number;
  lowStockCount: number;
  totalValue: number;
}

export interface CrewComplianceData {
  expiringCertifications: CertificationAlert[];
  hoursOfRestViolations: HoRViolation[];
  upcomingCrewChanges: CrewChange[];
  complianceScore: number;
}

export interface CertificationAlert {
  crewId: string;
  crewName: string;
  vesselName: string;
  certificationName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface HoRViolation {
  crewId: string;
  crewName: string;
  vesselName: string;
  violationType: string;
  date: Date;
  severity: string;
}

export interface CrewChange {
  crewId: string;
  crewName: string;
  vesselName: string;
  changeType: "embark" | "disembark";
  date: Date;
}

export interface CostSummaryData {
  totalMaintenanceCost: number;
  costByVessel: VesselCostSummary[];
  costByCategory: CategoryCost[];
  savingsFromPredictive: number;
  period: { start: Date; end: Date };
}

export interface VesselCostSummary {
  vesselId: string;
  vesselName: string;
  plannedCost: number;
  actualCost: number;
  variance: number;
}

export interface CategoryCost {
  category: string;
  amount: number;
  percentage: number;
}
