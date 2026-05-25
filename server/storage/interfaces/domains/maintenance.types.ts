import type { WidenPartial } from "../../../lib/widen-partial";
/**
 * Maintenance Storage Interface - Schedules, Records, Costs, Templates
 * Part of IStorage modularization for improved maintainability
 */

import type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  MaintenanceRecord,
  InsertMaintenanceRecord,
  MaintenanceCost,
  InsertMaintenanceCost,
  LaborRate,
  InsertLaborRate,
  Expense,
  InsertExpense,
  MaintenanceTemplate,
  InsertMaintenanceTemplate,
  MaintenanceChecklistItem,
  InsertMaintenanceChecklistItem,
  MaintenanceChecklistCompletion,
  InsertMaintenanceChecklistCompletion,
  WorkOrder,
  SelectCrew,
  PortCall as SelectPortCall,
  DrydockWindow as SelectDrydockWindow,
} from "@shared/schema";

/**
 * Maintenance storage operations for schedules, records, costs, and templates
 */
export interface IMaintenanceStorage {
  // Maintenance Schedules
  getMaintenanceSchedules(equipmentId?: string, status?: string): Promise<MaintenanceSchedule[]>;
  createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule>;
  updateMaintenanceSchedule(
    id: string,
    schedule: WidenPartial<InsertMaintenanceSchedule>
  ): Promise<MaintenanceSchedule>;
  deleteMaintenanceSchedule(id: string): Promise<void>;
  getUpcomingSchedules(days?: number): Promise<MaintenanceSchedule[]>;
  autoScheduleMaintenance(
    equipmentId: string,
    pdmScore: number
  ): Promise<MaintenanceSchedule | null>;
  clearAllMaintenanceSchedules(): Promise<void>;

  // Maintenance Records
  getMaintenanceRecords(
    equipmentId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(
    id: string,
    record: WidenPartial<InsertMaintenanceRecord>
  ): Promise<MaintenanceRecord>;
  deleteMaintenanceRecord(id: string): Promise<void>;

  // Maintenance Costs
  getMaintenanceCosts(
    equipmentId?: string,
    costType?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<MaintenanceCost[]>;
  getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<MaintenanceCost[]>;
  createMaintenanceCost(cost: InsertMaintenanceCost): Promise<MaintenanceCost>;
  getCostSummaryByEquipment(
    equipmentId?: string,
    months?: number
  ): Promise<{ equipmentId: string; totalCost: number; costByType: Record<string, number> }[]>;
  getCostTrends(
    months?: number
  ): Promise<{ month: string; totalCost: number; costByType: Record<string, number> }[]>;

  // Labor Rates
  getLaborRates(orgId?: string): Promise<LaborRate[]>;
  createLaborRate(rate: InsertLaborRate): Promise<LaborRate>;
  updateLaborRate(rateId: string, updateData: WidenPartial<InsertLaborRate>): Promise<LaborRate>;
  updateCrewRate(
    crewId: string,
    updateData: { currentRate: number; overtimeMultiplier: number; effectiveDate: Date }
  ): Promise<SelectCrew>;

  // Expenses
  getExpenses(orgId?: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpenseStatus(
    expenseId: string,
    status: "pending" | "approved" | "rejected"
  ): Promise<Expense>;

  // Maintenance Templates
  getMaintenanceTemplates(
    orgId?: string,
    equipmentType?: string,
    isActive?: boolean
  ): Promise<MaintenanceTemplate[]>;
  getMaintenanceTemplate(id: string, orgId?: string): Promise<MaintenanceTemplate | undefined>;
  createMaintenanceTemplate(template: InsertMaintenanceTemplate): Promise<MaintenanceTemplate>;
  updateMaintenanceTemplate(
    id: string,
    template: WidenPartial<InsertMaintenanceTemplate>,
    orgId?: string
  ): Promise<MaintenanceTemplate>;
  deleteMaintenanceTemplate(id: string, orgId?: string): Promise<void>;
  cloneMaintenanceTemplate(
    id: string,
    newName: string,
    orgId?: string
  ): Promise<MaintenanceTemplate>;
  linkWorkOrderToTemplate(
    workOrderId: string,
    templateId: string,
    orgId?: string
  ): Promise<WorkOrder>;

  // Maintenance Checklist Items
  getMaintenanceChecklistItems(templateId: string): Promise<MaintenanceChecklistItem[]>;
  getMaintenanceChecklistItem(id: string): Promise<MaintenanceChecklistItem | undefined>;
  createMaintenanceChecklistItem(
    item: InsertMaintenanceChecklistItem
  ): Promise<MaintenanceChecklistItem>;
  updateMaintenanceChecklistItem(
    id: string,
    item: WidenPartial<InsertMaintenanceChecklistItem>
  ): Promise<MaintenanceChecklistItem>;
  deleteMaintenanceChecklistItem(id: string): Promise<void>;
  bulkCreateChecklistItems(
    items: InsertMaintenanceChecklistItem[]
  ): Promise<MaintenanceChecklistItem[]>;
  reorderChecklistItems(templateId: string, itemIds: string[]): Promise<void>;

  // Maintenance Checklist Completions
  getMaintenanceChecklistCompletions(
    workOrderId: string
  ): Promise<MaintenanceChecklistCompletion[]>;
  getMaintenanceChecklistCompletion(
    id: string
  ): Promise<MaintenanceChecklistCompletion | undefined>;
  createMaintenanceChecklistCompletion(
    completion: InsertMaintenanceChecklistCompletion
  ): Promise<MaintenanceChecklistCompletion>;
  updateMaintenanceChecklistCompletion(
    id: string,
    completion: WidenPartial<InsertMaintenanceChecklistCompletion>
  ): Promise<MaintenanceChecklistCompletion>;
  completeChecklistItem(
    workOrderId: string,
    itemId: string,
    completedBy: string | null,
    completedByName: string | null,
    passed?: boolean | null,
    actualValue?: string,
    notes?: string | null,
    photoUrls?: string[]
  ): Promise<MaintenanceChecklistCompletion>;
  bulkCompleteChecklistItems(
    workOrderId: string,
    completions: Array<{
      itemId: string;
      completedBy: string;
      completedByName: string;
      passed?: boolean;
      actualValue?: string;
      notes?: string;
    }>
  ): Promise<MaintenanceChecklistCompletion[]>;
  getChecklistCompletionProgress(
    workOrderId: string
  ): Promise<{
    totalItems: number;
    completedItems: number;
    pendingItems: number;
    skippedItems: number;
    failedItems: number;
    percentComplete: number;
  }>;
  initializeChecklistFromTemplate(
    workOrderId: string,
    templateId: string
  ): Promise<MaintenanceChecklistCompletion[]>;

  // Optimal Maintenance Window
  findOptimalMaintenanceWindow(
    equipmentId: string,
    estimatedDurationHours: number,
    requiredSkills: string[],
    requiredParts: Array<{ partId: string; quantity: number }>,
    orgId?: string
  ): Promise<{
    portCalls: SelectPortCall[];
    drydockWindows: SelectDrydockWindow[];
    availableCrew: SelectCrew[];
    partsAvailable: boolean;
    recommendations: Array<{
      type: "port" | "drydock" | "underway";
      window: Date[];
      score: number;
      reason: string;
    }>;
  }>;
}
