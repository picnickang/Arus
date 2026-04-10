/**
 * ARUS DatabaseStorage - PostgreSQL Database Storage Implementation
 * Extracted from storage.ts for modularization
 */

import {
  type Device, type InsertDevice, type EdgeHeartbeat, type InsertHeartbeat,
  type PdmScoreLog, type InsertPdmScore, type WorkOrder, type InsertWorkOrder,
  type WorkOrderCompletion, type InsertWorkOrderCompletion, type SystemSettings, type InsertSettings,
  type EquipmentTelemetry, type InsertTelemetry, type DashboardMetrics,
  type TelemetryTrend, type AlertConfiguration, type InsertAlertConfig,
  type AlertNotification, type InsertAlertNotification, type AlertSuppression,
  type InsertAlertSuppression, type AlertComment, type InsertAlertComment,
  type ComplianceAuditLog, type InsertComplianceAuditLog, type MaintenanceSchedule,
  type InsertMaintenanceSchedule, type MaintenanceRecord, type InsertMaintenanceRecord,
  type MaintenanceCost, type InsertMaintenanceCost, type EquipmentLifecycle,
  type InsertEquipmentLifecycle, type PerformanceMetric, type InsertPerformanceMetric,
  type Organization, type InsertOrganization, type User, type InsertUser,
  type AdminAuditEvent, type InsertAdminAuditEvent, type AdminSession, type InsertAdminSession,
  type Part, type InsertPart, type PartsInventory, type InsertPartsInventory, type Stock, type InsertStock,
  type SelectCrew, type InsertCrew,
  type SelectCrewLeave, type InsertCrewLeave, type SelectShiftTemplate, type InsertShiftTemplate,
  type SelectCrewAssignment, type InsertCrewAssignment, type CrewWithSkills,
  type SelectCrewCertification, type InsertCrewCertification, type SelectCrewDocument,
  type InsertCrewDocument, type CrewNotificationSettings, type SelectPortCall, type InsertPortCall,
  type SelectDrydockWindow, type InsertDrydockWindow, type SelectCrewRestSheet,
  type InsertCrewRestSheet, type SelectCrewRestDay,
  type SelectVessel, type InsertVessel, type SelectDeviceRegistry, type InsertDeviceRegistry,
  type SelectReplayIncoming, type InsertReplayIncoming, type SelectSheetLock,
  type InsertSheetLock, type SelectSheetVersion, type InsertSheetVersion,
  type SensorConfiguration, type InsertSensorConfiguration, type SensorState,
  type InsertSensorState, type SensorTemplate, type InsertSensorTemplate,
  type InsightSnapshot, type InsertInsightSnapshot, type InsightReport, type InsertInsightReport, type Expense, type InsertExpense,
  type MlModel, type InsertMlModel, type MlModelAccuracyHistory, type InsertMlModelAccuracyHistory,
  type EngineerOverride, type InsertEngineerOverride,
  type DeckLogDaily, type InsertDeckLogDaily, type DeckLogHourly, type InsertDeckLogHourly,
  type DeckLogWatch, type InsertDeckLogWatch, type DeckLogEvent, type InsertDeckLogEvent,
  type EngineLogDaily, type InsertEngineLogDaily, type EngineLogHourly, type InsertEngineLogHourly,
  type EngineLogGenerator, type InsertEngineLogGenerator, type EngineLogWatch, type InsertEngineLogWatch,
  type EngineLogEvent, type InsertEngineLogEvent, type StormgeoSetting, type InsertStormgeoSetting,
  type StormgeoSnapshot, type InsertStormgeoSnapshot, type DeckLogHourlyAutoFill, type InsertDeckLogHourlyAutoFill,
  type StormgeoImportHistory, type InsertStormgeoImportHistory, type WorkOrderTask, type InsertWorkOrderTask,
  type WorkOrderHistory, type InsertWorkOrderHistory, type InventoryMovement,
  type WorkOrderChecklist, type InsertWorkOrderChecklist, type WorkOrderWorklog, type InsertWorkOrderWorklog,
  type WorkOrderParts, type InsertWorkOrderParts,
  type MaintenanceTemplate, type InsertMaintenanceTemplate, workOrders, workOrderCompletions, equipment, maintenanceSchedules, maintenanceCosts, stock, idempotencyLog, vessels,
  insightSnapshots, workOrderParts, workOrderChecklists, workOrderWorklogs, workOrderTasks, inventoryMovements, skills,
  errorLogs, type ErrorLog, type InsertErrorLog,
} from "@shared/schema-runtime";
import type { SelectSkill, InsertSkill, ComplianceFinding, ComplianceRule, ThresholdOptimization, SelectCrewSkill } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { publishEvent } from "../sync-events.js";
import { db } from "../db-config";
import { getWebSocketServer } from "../websocket-server";
import type { IStorage, WorkOrderFilters } from "./interfaces/storage.types";
import { DbDeckLogStorage } from "./domains/logbook/deck-log-storage";
import { DbEngineLogStorage } from "./domains/logbook/engine-log-storage";
import { DbMaintenanceSchedulingAdapter, type IMaintenanceSchedulingAdapter, type MaintenanceSchedulingDeps } from "./domains/maintenance-scheduling-adapter";
import { DatabaseAnalyticsInsightsAdapter, type AnalyticsDependencies } from "./domains/analytics-insights-adapter";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { dbWorkOrderStorage } from "../db/workorders/index.js";
import { dbVesselStorage } from "../db/vessels/index.js";
import { dbAlertStorage } from "../db/alerts/index.js";
import { dbInventoryStorage } from "../db/inventory/index.js";
import { dbDtcStorage } from "../db/dtc/index.js";
import { dbNotificationsStorage } from "../db/notifications/index.js";
import { dbCrewExtensionsStorage } from "../db/crew-extensions/index.js";
import { dbChecklistsStorage } from "../db/checklists/index.js";
import { dbSensorsStorage } from "../db/sensors/index.js";
import { dbOptimizerStorage } from "../db/optimizer/index.js";
import { dbStcwStorage } from "../db/stcw/index.js";
import { dbUserStorage } from "../db/users/index.js";
import { dbMlAnalyticsStorage } from "../db/ml-analytics/index.js";
import { dbSystemAdminStorage, dbSystemAdminStorage as dbSettingsStorage } from "../db/system-admin/index.js";
import { dbMaintenanceTemplatesStorage } from "../db/maintenance-templates/index.js";
import { dbMaintenanceStorage } from "../db/maintenance/index.js";
import { dbTelemetryStorage } from "../db/telemetry/index.js";
import { dbCrewStorage } from "../db/crew/index.js";
import { dbAnalyticsStorage } from "../db/analytics/index.js";
import { dbHubSyncStorage } from "../db/hub-sync/index.js";
import { dbStormGeoStorage } from "../db/stormgeo/index.js";
import { dbDevicesStorage } from "../db/devices.repo";
import { dbSchedulerStorage } from "../db/scheduler/index.js";
import { workOrderService } from "../services/domains/work-order-service";
import { vesselService } from "../services/domains/vessel-service";
import { crewService } from "../services/domains/crew-service";

export class DatabaseStorage implements IStorage {
  private deckLogAdapter: DbDeckLogStorage;
  private engineLogAdapter: DbEngineLogStorage;
  private schedulingAdapter: IMaintenanceSchedulingAdapter;
  private analyticsAdapter: DatabaseAnalyticsInsightsAdapter;

  constructor() {
    this.deckLogAdapter = new DbDeckLogStorage();
    this.engineLogAdapter = new DbEngineLogStorage();
    const schedulingDeps: MaintenanceSchedulingDeps = {
      getExistingAutoSchedules: async (eqId) => db.select().from(maintenanceSchedules).where(and(eq(maintenanceSchedules.equipmentId, eqId), eq(maintenanceSchedules.autoGenerated, true), eq(maintenanceSchedules.status, "scheduled"))),
      createSchedule: async (s) => dbMaintenanceStorage.createMaintenanceSchedule(s),
      getEquipmentLifecycle: async (eqId) => dbAnalyticsStorage.getEquipmentLifecycle(eqId).then(d => d[0] || null),
      getMaintenanceRecords: async (eqId, from, to) => dbMaintenanceStorage.getMaintenanceRecords(eqId, from, to),
      getPerformanceMetrics: async (eqId, from, to) => dbAnalyticsStorage.getPerformanceMetrics(eqId, from, to),
      getAlertNotifications: async () => dbAlertStorage.getAlertNotifications()
    };
    this.schedulingAdapter = new DbMaintenanceSchedulingAdapter(schedulingDeps);
    const analyticsDeps: AnalyticsDependencies = {
      getDevices: async (orgId) => dbDevicesStorage.getDevices(orgId),
      getHeartbeats: async (orgId) => dbDevicesStorage.getHeartbeatsByOrg(orgId),
      getWorkOrders: async (eqId, st, pr, orgId) => workOrderService.getWorkOrdersWithDetails(eqId, orgId, st ? { status: st } : undefined),
      getPdmScores: async (eqId, orgId) => dbDevicesStorage.getPdmScores(eqId, orgId),
      getLatestTelemetryReadings: async (vesselId, equipmentId, sensorType, limit, orgId) => this.getLatestTelemetryReadings(vesselId, equipmentId, sensorType, limit || 500, orgId),
      getEquipmentRegistry: async (orgId) => dbEquipmentStorage.getEquipmentRegistry(orgId),
      getMetricsHistory: async (orgId, days) => this.getMetricsHistory(orgId, days),
      getVessels: async (orgId) => vesselService.getVessels(orgId),
      getEquipment: async (id) => dbEquipmentStorage.getEquipmentRegistry().then(eq => eq.find(e => e.id === id)),
    };
    this.analyticsAdapter = new DatabaseAnalyticsInsightsAdapter(analyticsDeps);
  }

  private validateOrgId(orgId: string | undefined, operation: string): asserts orgId is string {
    if (!orgId || orgId.trim() === "") {throw new Error(`[Security] orgId is required for ${operation}. This is a critical multi-tenant isolation error.`);}
  }

  // Device methods - delegated to dbDevicesStorage
  async getDevices(orgId?: string): Promise<Device[]> { return dbDevicesStorage.getDevices(orgId); }
  async getDevice(id: string, orgId?: string): Promise<Device | undefined> { return dbDevicesStorage.getDevice(id, orgId); }
  async createDevice(device: InsertDevice): Promise<Device> { return dbDevicesStorage.createDevice(device); }
  async updateDevice(id: string, updates: Partial<InsertDevice>, orgId: string): Promise<Device> { return dbDevicesStorage.updateDevice(id, updates, orgId); }
  async deleteDevice(id: string, orgId: string): Promise<void> { return dbDevicesStorage.deleteDevice(id, orgId); }
  async getPdmScores(equipmentId: string | undefined, orgId: string): Promise<PdmScoreLog[]> { return dbDevicesStorage.getPdmScores(equipmentId, orgId); }

  // Work order methods - delegated to workOrderService
  async getWorkOrders(equipmentId?: string, orgId?: string, filters?: WorkOrderFilters): Promise<WorkOrder[]> { return workOrderService.getWorkOrdersWithDetails(equipmentId, orgId, filters); }
  async getWorkOrdersPaginated(equipmentId: string | undefined, orgId: string | undefined, limit: number, offset: number, filters?: WorkOrderFilters): Promise<{ items: WorkOrder[]; total: number }> { return workOrderService.getWorkOrdersPaginated(equipmentId, orgId, limit, offset, filters); }
  async getWorkOrderById(id: string, orgId: string): Promise<WorkOrder | undefined> { return workOrderService.getWorkOrderById(id, orgId); }
  async generateWorkOrderNumber(orgId: string): Promise<string> { return workOrderService.generateWorkOrderNumber(orgId); }
  async createWorkOrder(order: InsertWorkOrder & { woNumber?: string; id?: string }): Promise<WorkOrder> { return workOrderService.createWorkOrder(order); }
  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> { return workOrderService.updateWorkOrderWithDowntimeTracking(id, updates); }

  async deleteWorkOrder(id: string): Promise<void> { const [wo] = await db.select({ orgId: workOrders.orgId }).from(workOrders).where(eq(workOrders.id, id)).limit(1); if (wo?.orgId) { await this.releasePartsFromWorkOrder(id, wo.orgId); } await db.delete(workOrderParts).where(eq(workOrderParts.workOrderId, id)); await db.delete(workOrderChecklists).where(eq(workOrderChecklists.workOrderId, id)); await db.delete(workOrderWorklogs).where(eq(workOrderWorklogs.workOrderId, id)); await db.delete(maintenanceCosts).where(eq(maintenanceCosts.workOrderId, id)); const r = await db.delete(workOrders).where(eq(workOrders.id, id)).returning(); if (r.length === 0) {throw new Error(`Work order ${id} not found`);} const ws = getWebSocketServer(); if (r[0]) {ws?.broadcastWorkOrderChange("delete", { id: r[0].id });} }

  async cloneWorkOrder(id: string, orgId: string, options?: { plannedStartDate?: Date; plannedEndDate?: Date; includeTasks?: boolean; includeParts?: boolean }): Promise<WorkOrder> {
    return db.transaction(async (tx) => {
      const [original] = await tx.select().from(workOrders).where(and(eq(workOrders.id, id), eq(workOrders.orgId, orgId)));
      if (!original) { throw new Error(`Work order ${id} not found`); }
      const newWoNumber = await this.generateWorkOrderNumber(orgId); const now = new Date();
      const [clonedOrder] = await tx.insert(workOrders).values({ ...original, id: undefined, woNumber: newWoNumber, status: "open", plannedStartDate: options?.plannedStartDate ?? original.plannedStartDate, plannedEndDate: options?.plannedEndDate ?? original.plannedEndDate, actualStartDate: null, actualEndDate: null, actualHours: null, actualDowntimeHours: null, totalPartsCost: 0, totalLaborCost: 0, totalCost: 0, laborHours: null, laborCost: null, vesselDowntimeStartedAt: null, version: 1, createdAt: now, updatedAt: now }).returning();
      if (options?.includeTasks !== false) { const originalTasks = await tx.select().from(workOrderTasks).where(eq(workOrderTasks.workOrderId, id)); if (originalTasks.length > 0) {await tx.insert(workOrderTasks).values(originalTasks.map(t => ({ ...t, id: undefined, workOrderId: clonedOrder.id, isCompleted: false, completedAt: null, completedBy: null, completedByName: null, createdAt: now, updatedAt: now })));} }
      if (options?.includeParts !== false) { const originalParts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, id)); if (originalParts.length > 0) { await tx.insert(workOrderParts).values(originalParts.map(p => ({ ...p, id: undefined, workOrderId: clonedOrder.id, quantityUsed: 0, totalCost: 0, createdAt: now }))); } }
      await publishEvent("work_order", "create", clonedOrder);
      return clonedOrder;
    });
  }

  // Work Order Completions
  async getWorkOrderCompletions(filters?: { equipmentId?: string; vesselId?: string; startDate?: Date; endDate?: Date; orgId?: string }): Promise<WorkOrderCompletion[]> { let q = db.select().from(workOrderCompletions); const c = []; if (filters?.equipmentId) {c.push(eq(workOrderCompletions.equipmentId, filters.equipmentId));} if (filters?.vesselId) {c.push(eq(workOrderCompletions.vesselId, filters.vesselId));} if (filters?.orgId) {c.push(eq(workOrderCompletions.orgId, filters.orgId));} if (filters?.startDate) {c.push(sql`${workOrderCompletions.completedAt} >= ${filters.startDate}`);} if (filters?.endDate) {c.push(sql`${workOrderCompletions.completedAt} <= ${filters.endDate}`);} if (c.length > 0) {q = q.where(and(...c)) as any;} return q.orderBy(sql`${workOrderCompletions.completedAt} DESC`); }
  async getWorkOrderCompletion(id: string): Promise<WorkOrderCompletion | undefined> { const r = await db.select().from(workOrderCompletions).where(eq(workOrderCompletions.id, id)).limit(1); return r[0]; }
  async getWorkOrderCompletionsByWorkOrder(workOrderId: string): Promise<WorkOrderCompletion[]> { return db.select().from(workOrderCompletions).where(eq(workOrderCompletions.workOrderId, workOrderId)).orderBy(sql`${workOrderCompletions.completedAt} DESC`); }

  async completeWorkOrder(workOrderId: string, completionData: InsertWorkOrderCompletion): Promise<WorkOrderCompletion> {
    const now = new Date();
    return db.transaction(async (tx) => {
      const laborCost = completionData.totalLaborCost || 0, partsCost = completionData.totalPartsCost || 0, downtimeHours = completionData.actualDowntimeHours || 0, downtimeCostPerHour = completionData.downtimeCostPerHour || 1000;
      const downtimeCost = completionData.totalCost ? 0 : downtimeHours * downtimeCostPerHour, totalCost = completionData.totalCost || laborCost + partsCost + downtimeCost;
      const [updatedWorkOrder] = await tx.update(workOrders).set({ status: "completed", actualEndDate: now, actualDuration: completionData.actualDurationMinutes || null, totalLaborCost: laborCost, totalPartsCost: partsCost, totalCost, actualDowntimeHours: downtimeHours, downtimeCostPerHour }).where(eq(workOrders.id, workOrderId)).returning();
      if (!updatedWorkOrder) { throw new Error(`Work order ${workOrderId} not found`); }
      const [completion] = await tx.insert(workOrderCompletions).values(completionData).returning();
      const woParts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, workOrderId));
      const consumeMap = new Map<string, number>();
      for (const woPart of woParts) {
        consumeMap.set(woPart.partId, (consumeMap.get(woPart.partId) || 0) + woPart.quantityUsed);
      }
      for (const [partId, totalConsume] of consumeMap.entries()) {
        const stockRows = await tx.select().from(stock).where(and(eq(stock.partId, partId), eq(stock.orgId, completionData.orgId))).orderBy(sql`${stock.quantityReserved} DESC`);
        let remaining = totalConsume;
        for (const row of stockRows) {
          if (remaining <= 0) break;
          const onHand = row.quantityOnHand ?? 0;
          const reserved = row.quantityReserved ?? 0;
          const toConsume = Math.min(remaining, onHand);
          if (toConsume > 0) {
            const newOnHand = Math.max(0, onHand - toConsume);
            const newReserved = Math.max(0, reserved - toConsume);
            await tx.update(stock).set({ quantityOnHand: newOnHand, quantityReserved: newReserved, updatedAt: now }).where(eq(stock.id, row.id));
            await tx.insert(inventoryMovements).values({ orgId: completionData.orgId, partId, workOrderId, movementType: "consume", quantity: -toConsume, quantityBefore: onHand, quantityAfter: newOnHand, reservedBefore: reserved, reservedAfter: newReserved, performedBy: completionData.completedBy || "system", notes: `Consumed during work order completion: ${updatedWorkOrder.woNumber || workOrderId} (stock ${row.id})` });
            remaining -= toConsume;
          }
        }
      }
      return completion;
    });
  }

  async getWorkOrderCompletionAnalytics(filters?: { equipmentId?: string; vesselId?: string; startDate?: Date; endDate?: Date; orgId?: string }): Promise<{ totalCompletions: number; avgDurationVariance: number; avgCostVariance: number; onTimeCompletionRate: number; totalDowntimeHours: number }> {
    const c = await this.getWorkOrderCompletions(filters); if (c.length === 0) { return { totalCompletions: 0, avgDurationVariance: 0, avgCostVariance: 0, onTimeCompletionRate: 0, totalDowntimeHours: 0 }; }
    const dv = c.filter(x => x.durationVariancePercent !== null).map(x => x.durationVariancePercent!), cv = c.filter(x => x.costVariancePercent !== null).map(x => x.costVariancePercent!), ot = c.filter(x => x.onTimeCompletion === true).length, td = c.reduce((s, x) => s + (x.actualDowntimeHours || 0), 0);
    return { totalCompletions: c.length, avgDurationVariance: dv.length > 0 ? dv.reduce((a, b) => a + b, 0) / dv.length : 0, avgCostVariance: cv.length > 0 ? cv.reduce((a, b) => a + b, 0) / cv.length : 0, onTimeCompletionRate: c.length > 0 ? (ot / c.length) * 100 : 0, totalDowntimeHours: td };
  }

  // Telemetry methods - delegated to dbTelemetryStorage/Adapter
  async createTelemetryReading(reading: InsertTelemetry): Promise<EquipmentTelemetry> { return dbTelemetryStorage.createTelemetryReading(reading); }
  async getTelemetryHistory(arg1: string, arg2: string, arg3?: number | string, arg4?: Date, arg5?: Date): Promise<EquipmentTelemetry[]> { return dbTelemetryStorage.getTelemetryHistory(arg1, arg2, arg3, arg4, arg5); }
  async getTelemetryByEquipmentAndDateRange(equipmentId: string, startDate: Date, endDate: Date, orgId?: string): Promise<EquipmentTelemetry[]> { return dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(equipmentId, startDate, endDate, orgId); }
  async getLatestTelemetryReadings(vesselId?: string, equipmentId?: string, sensorType?: string, limit: number = 500, orgId?: string): Promise<EquipmentTelemetry[]> { return dbTelemetryStorage.getLatestTelemetryReadings(vesselId, equipmentId, sensorType, limit, orgId); }

  // Sensor configuration methods - delegated to dbSensorsStorage
  async getSensorConfigurations(orgId?: string, equipmentId?: string, sensorType?: string): Promise<SensorConfiguration[]> { return dbSensorsStorage.getSensorConfigurations(orgId, equipmentId, sensorType); }
  async getSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<SensorConfiguration | undefined> { return dbSensorsStorage.getSensorConfiguration(equipmentId, sensorType, orgId); }
  async createSensorConfiguration(config: InsertSensorConfiguration): Promise<SensorConfiguration> { return dbSensorsStorage.createSensorConfiguration(config); }
  async updateSensorConfiguration(equipmentId: string, sensorType: string, config: Partial<InsertSensorConfiguration>, orgId?: string): Promise<SensorConfiguration> { return dbSensorsStorage.updateSensorConfiguration(equipmentId, sensorType, config, orgId); }

  // Alert methods - delegated to dbAlertStorage
  async getAlertConfigurations(equipmentId?: string): Promise<AlertConfiguration[]> { return dbAlertStorage.getAlertConfigurations(equipmentId); }
  async createAlertConfiguration(config: InsertAlertConfig): Promise<AlertConfiguration> { return dbAlertStorage.createAlertConfiguration(config); }
  async updateAlertConfiguration(id: string, config: Partial<InsertAlertConfig>): Promise<AlertConfiguration> { return dbAlertStorage.updateAlertConfiguration(id, config); }
  async deleteAlertConfiguration(id: string): Promise<void> { return dbAlertStorage.deleteAlertConfiguration(id); }
  async getAlertNotifications(acknowledged?: boolean, orgId?: string): Promise<AlertNotification[]> { return dbAlertStorage.getAlertNotifications(acknowledged, orgId); }
  async createAlertNotification(notification: InsertAlertNotification): Promise<AlertNotification> { return dbAlertStorage.createAlertNotification(notification); }
  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<AlertNotification> { return dbAlertStorage.acknowledgeAlert(id, acknowledgedBy); }
  async hasRecentAlert(equipmentId: string, sensorType: string, alertType: string, minutesBack?: number): Promise<boolean> { return dbAlertStorage.hasRecentAlert(equipmentId, sensorType, alertType, minutesBack); }
  async addAlertComment(commentData: InsertAlertComment): Promise<AlertComment> { return dbAlertStorage.addAlertComment(commentData); }
  async getAlertComments(alertId: string): Promise<AlertComment[]> { return dbAlertStorage.getAlertComments(alertId); }
  async createAlertSuppression(suppressionData: InsertAlertSuppression): Promise<AlertSuppression> { return dbAlertStorage.createAlertSuppression(suppressionData); }
  async getActiveSuppressions(orgId?: string): Promise<AlertSuppression[]> { return dbAlertStorage.getActiveSuppressions(orgId); }
  async removeAlertSuppression(id: string): Promise<void> { return dbAlertStorage.removeAlertSuppression(id); }
  async isAlertSuppressed(equipmentId: string, sensorType: string, alertType: string): Promise<boolean> { return dbAlertStorage.isAlertSuppressed(equipmentId, sensorType, alertType); }

  // Compliance audit logging - delegated to dbComplianceStorage
  async getComplianceAuditLog(filters?: { entityType?: string; entityId?: string; complianceStandard?: string; startDate?: Date; endDate?: Date }): Promise<ComplianceAuditLog[]> { return dbComplianceStorage.getComplianceAuditLog(filters); }

  // Settings - delegated to dbSettingsStorage
  async getSettings(): Promise<SystemSettings> { return dbSettingsStorage.getSettings(); }

  // Dashboard metrics - delegated to analyticsAdapter

  // STCW Hours of Rest - delegated to dbStcwStorage
  async createCrewRestSheet(sheet: InsertCrewRestSheet): Promise<SelectCrewRestSheet> { return dbStcwStorage.createCrewRestSheet(sheet); }
  async upsertCrewRestDay(sheetId: string, dayData: any): Promise<SelectCrewRestDay> { return dbStcwStorage.upsertCrewRestDay(sheetId, dayData); }
  async getCrewRestRange(crewId: string, startDate: string, endDate: string): Promise<{ sheets: SelectCrewRestSheet[]; days: SelectCrewRestDay[] }> { return dbStcwStorage.getCrewRestRange(crewId, startDate, endDate); }
  async getVesselCrewRest(vesselId: string, year: number, month: string): Promise<{ [crewId: string]: { sheet: SelectCrewRestSheet | null; days: SelectCrewRestDay[] } }> { return dbStcwStorage.getVesselCrewRest(vesselId, year, month); }
  async getCrewRestByDateRange(vesselId?: string, startDate?: string, endDate?: string, complianceFilter?: boolean): Promise<{ crewId: string; vesselId: string; sheet: SelectCrewRestSheet; days: SelectCrewRestDay[] }[]> { return dbStcwStorage.getCrewRestByDateRange(vesselId, startDate, endDate, complianceFilter); }

  // Work Order Checklists - delegated to dbChecklistsStorage
  async getWorkOrderWorklogs(workOrderId?: string, orgId?: string): Promise<WorkOrderWorklog[]> { return dbChecklistsStorage.getWorkOrderWorklogs(workOrderId, orgId); }
  async getWorkOrderTasks(workOrderId: string, orgId?: string): Promise<WorkOrderTask[]> { return dbChecklistsStorage.getWorkOrderTasks(workOrderId, orgId); }
  async createWorkOrderTask(task: InsertWorkOrderTask): Promise<WorkOrderTask> { return dbChecklistsStorage.createWorkOrderTask(task); }
  async updateWorkOrderTask(id: string, task: Partial<InsertWorkOrderTask>): Promise<WorkOrderTask> { return dbChecklistsStorage.updateWorkOrderTask(id, task); }
  async deleteWorkOrderTask(id: string): Promise<void> { return dbChecklistsStorage.deleteWorkOrderTask(id); }

  // Inventory - delegated to dbInventoryStorage
  async getParts(orgId?: string): Promise<Part[]> { return dbInventoryStorage.getParts(orgId); }
  async getPartsInventory(category?: string, orgId?: string, search?: string, sortBy?: string, sortOrder?: "asc" | "desc"): Promise<PartsInventory[]> { return dbInventoryStorage.getPartsInventory(category, orgId, search, sortBy, sortOrder); }
  async getPartsInventoryPaginated(orgId: string, options: { limit?: number; offset?: number; search?: string; category?: string; criticality?: string; stockStatus?: string; supplier?: string; sortBy?: string; sortOrder?: "asc" | "desc" }): Promise<{ items: any[]; total: number }> { return dbInventoryStorage.getPartsInventoryPaginated(orgId, options); }
  async getPartById(id: string, orgId?: string): Promise<PartsInventory | undefined> { return dbInventoryStorage.getPartById(id, orgId); }
  async createPart(part: InsertPartsInventory): Promise<PartsInventory> { return dbInventoryStorage.createPartsInventory(part); }
  async updatePart(id: string, updates: Partial<InsertPartsInventory>, orgId: string): Promise<PartsInventory> { return dbInventoryStorage.updatePartsInventory(id, updates); }
  async getLowStockParts(orgId?: string): Promise<PartsInventory[]> { return dbInventoryStorage.getLowStockParts(orgId); }
  async checkPartAvailabilityForWorkOrder(partId: string, quantity: number, orgId?: string): Promise<{ available: boolean; onHand: number; reserved: number }> { return dbInventoryStorage.checkPartAvailabilityForWorkOrder(partId, quantity, orgId); }
  async releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void> { return dbInventoryStorage.releasePartsFromWorkOrder(workOrderId, orgId); }
  async getPartsCatalogue(orgId?: string, search?: string, category?: string, sortBy?: string, sortOrder?: string): Promise<Part[]> { return dbInventoryStorage.getParts(orgId, category ? { category } : undefined); }
  async getPartCatalogueByNumber(partNo: string, orgId?: string): Promise<Part | undefined> { return orgId ? dbInventoryStorage.getPartByPartNumber(partNo, orgId) : undefined; }
  async deletePartCatalogue(id: string): Promise<void> { return dbInventoryStorage.deletePart(id); }
  async syncPartCostToStock(partId: string): Promise<void> { return dbInventoryStorage.syncPartCostToStock(partId); }
  async getStockByPart(partId: string, orgId?: string): Promise<Stock[]> { return dbInventoryStorage.getStockByPart(partId, orgId); }
  async getWorkOrderParts(workOrderId?: string, orgId?: string): Promise<WorkOrderParts[]> { if (!workOrderId) { return []; } return dbWorkOrderStorage.getWorkOrderParts(workOrderId, orgId); }
  async addPartToWorkOrder(workOrderPart: InsertWorkOrderParts): Promise<WorkOrderParts> { return dbInventoryStorage.addPartToWorkOrder(workOrderPart); }
  async updateWorkOrderPart(id: string, updates: Partial<InsertWorkOrderParts>): Promise<WorkOrderParts> { return dbInventoryStorage.updateWorkOrderPart(id, updates); }
  async removePartFromWorkOrder(id: string, orgId?: string): Promise<void> { return dbInventoryStorage.removePartFromWorkOrder(id, orgId); }
  async removePartAndRestoreInventory(workOrderPartId: string, orgId: string, performedBy: string): Promise<void> { return dbInventoryStorage.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy); }
  async addBulkPartsAndReserveInventory(workOrderId: string, partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>, orgId: string): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> { return dbInventoryStorage.addBulkPartsAndReserveInventory(workOrderId, partsToAdd, orgId); }
  async getPartsCostForWorkOrder(workOrderId: string): Promise<{ totalPartsCost: number; partsCount: number }> { return dbInventoryStorage.getPartsCostForWorkOrder(workOrderId); }
  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<WorkOrderHistory[]> { return dbInventoryStorage.getWorkOrderHistory(workOrderId, orgId); }
  async getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<InventoryMovement[]> { return dbInventoryStorage.getInventoryMovementsByWorkOrder(workOrderId, orgId); }
  async getWorkOrderPartsByEquipment(orgId: string, equipmentId: string): Promise<WorkOrderParts[]> { return dbInventoryStorage.getWorkOrderPartsByEquipment(orgId, equipmentId); }
  async getWorkOrderPartsByPartId(orgId: string, partId: string): Promise<WorkOrderParts[]> { return dbInventoryStorage.getWorkOrderPartsByPartId(orgId, partId); }
  async getPartsForEquipment(equipmentId: string, orgId: string): Promise<Part[]> { return dbInventoryStorage.getPartsForEquipment(equipmentId, orgId); }
  async updatePartCost(partId: string, updateData: { unitCost: number; supplier: string }, orgId?: string): Promise<PartsInventory> { return dbAnalyticsStorage.updatePartCost(partId, updateData, orgId || "default-org-id"); }
  async updatePartStockQuantities(partId: string, updateData: { quantityOnHand?: number; quantityReserved?: number; minStockLevel?: number; maxStockLevel?: number }, orgId?: string): Promise<PartsInventory> { return dbAnalyticsStorage.updatePartStockQuantities(partId, updateData, orgId || "default-org-id"); }
  async getEquipmentForPart(partId: string, orgId: string): Promise<Equipment[]> { return dbEquipmentStorage.getEquipmentRegistry(orgId).then(eqs => eqs.filter(e => ('compatibleParts' in e && Array.isArray(e.compatibleParts)) ? e.compatibleParts.includes(partId) : false)); }
  async updatePartCompatibility(partId: string, equipmentIds: string[], orgId: string): Promise<Part> { return dbInventoryStorage.updatePartCatalogue(partId, { compatibleEquipment: equipmentIds }); }

  // Clear methods & idempotency
  async clearAllAlerts(): Promise<void> { return dbAlertStorage.clearAllAlerts(); }

  // Maintenance templates - delegated to dbMaintenanceTemplatesStorage
  async getMaintenanceTemplates(orgId?: string, equipmentType?: string, isActive?: boolean): Promise<MaintenanceTemplate[]> { return dbMaintenanceTemplatesStorage.getMaintenanceTemplates(orgId, equipmentType, isActive); }
  async getMaintenanceTemplate(id: string, orgId?: string): Promise<MaintenanceTemplate | undefined> { return dbMaintenanceTemplatesStorage.getMaintenanceTemplate(id, orgId); }
  async createMaintenanceTemplate(template: InsertMaintenanceTemplate): Promise<MaintenanceTemplate> { return dbMaintenanceTemplatesStorage.createMaintenanceTemplate(template); }
  async updateMaintenanceTemplate(id: string, template: Partial<InsertMaintenanceTemplate>, orgId?: string): Promise<MaintenanceTemplate> { return dbMaintenanceTemplatesStorage.updateMaintenanceTemplate(id, template, orgId); }
  async deleteMaintenanceTemplate(id: string, orgId?: string): Promise<void> { return dbMaintenanceTemplatesStorage.deleteMaintenanceTemplate(id, orgId); }

  // Maintenance scheduling - delegated to dbMaintenanceStorage and schedulingAdapter
  async getMaintenanceSchedules(equipmentId?: string, status?: string): Promise<MaintenanceSchedule[]> { return dbMaintenanceStorage.getMaintenanceSchedules(equipmentId, status); }
  async createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule> { return dbMaintenanceStorage.createMaintenanceSchedule(schedule); }
  async updateMaintenanceSchedule(id: string, updates: Partial<InsertMaintenanceSchedule>): Promise<MaintenanceSchedule> { return dbMaintenanceStorage.updateMaintenanceSchedule(id, updates); }
  async deleteMaintenanceSchedule(id: string): Promise<void> { return dbMaintenanceStorage.deleteMaintenanceSchedule(id); }
  async getMaintenanceRecords(equipmentId?: string, fromDate?: Date, toDate?: Date): Promise<MaintenanceRecord[]> { return dbMaintenanceStorage.getMaintenanceRecords(equipmentId, fromDate, toDate); }
  async createMaintenanceCost(cost: InsertMaintenanceCost): Promise<MaintenanceCost> { return dbMaintenanceStorage.createMaintenanceCost(cost); }
  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<MaintenanceCost[]> { return dbMaintenanceStorage.getMaintenanceCostsByWorkOrder(workOrderId); }

  // Crew methods - delegated to dbCrewStorage
  async getCrew(orgId?: string, vesselId?: string): Promise<SelectCrew[]> { return dbCrewStorage.getCrew(orgId, vesselId); }
  async getCrewMember(id: string, orgId?: string): Promise<SelectCrew | undefined> { return dbCrewStorage.getCrewMember(id, orgId); }
  
  // Skills methods - direct implementation
  async getSkills(orgId?: string): Promise<SelectSkill[]> { const conditions = orgId ? eq(skills.orgId, orgId) : undefined; return conditions ? db.select().from(skills).where(conditions) : db.select().from(skills); }
  async createSkill(skillData: InsertSkill): Promise<SelectSkill> { const [newSkill] = await db.insert(skills).values(skillData).returning(); return newSkill; }
  async deleteSkill(id: string): Promise<void> { await db.delete(skills).where(eq(skills.id, id)); }

  // Deck Log methods - delegated to deckLogAdapter
  async getDeckLogDaily(orgId: string, filters?: { vesselId?: string; startDate?: string; endDate?: string; status?: string }): Promise<DeckLogDaily[]> { return this.deckLogAdapter.getDeckLogDaily(orgId, filters); }
  async getDeckLogDailyByDate(vesselId: string, logDate: string, orgId: string): Promise<DeckLogDaily | undefined> { return this.deckLogAdapter.getDeckLogDailyByDate(vesselId, logDate, orgId); }
  async createDeckLogDaily(entry: InsertDeckLogDaily): Promise<DeckLogDaily> { return this.deckLogAdapter.createDeckLogDaily(entry); }
  async upsertDeckLogHourly(entry: InsertDeckLogHourly): Promise<DeckLogHourly> { return this.deckLogAdapter.upsertDeckLogHourly(entry); }
  async createDeckLogEvent(event: InsertDeckLogEvent): Promise<DeckLogEvent> { return this.deckLogAdapter.createDeckLogEvent(event); }

  // Engine Log methods - delegated to engineLogAdapter
  async getEngineLogDaily(orgId: string, filters?: { vesselId?: string; startDate?: string; endDate?: string; status?: string }): Promise<EngineLogDaily[]> { return this.engineLogAdapter.getEngineLogDaily(orgId, filters); }
  async createEngineLogDaily(entry: InsertEngineLogDaily): Promise<EngineLogDaily> { return this.engineLogAdapter.createEngineLogDaily(entry); }
  async updateEngineLogDaily(id: string, entry: Partial<InsertEngineLogDaily>, orgId: string): Promise<EngineLogDaily> { return this.engineLogAdapter.updateEngineLogDaily(id, entry, orgId); }
  async getEngineLogHourly(dailyLogId: string, orgId: string): Promise<EngineLogHourly[]> { return this.engineLogAdapter.getEngineLogHourly(dailyLogId, orgId); }
  async upsertEngineLogHourly(entry: InsertEngineLogHourly): Promise<EngineLogHourly> { return this.engineLogAdapter.upsertEngineLogHourly(entry); }
  async getEngineLogGenerator(dailyLogId: string, orgId: string): Promise<EngineLogGenerator[]> { return this.engineLogAdapter.getEngineLogGenerator(dailyLogId, orgId); }
  async upsertEngineLogGenerator(entry: InsertEngineLogGenerator): Promise<EngineLogGenerator> { return this.engineLogAdapter.upsertEngineLogGenerator(entry); }
  async createEngineLogEvent(event: InsertEngineLogEvent): Promise<EngineLogEvent> { return this.engineLogAdapter.createEngineLogEvent(event); }

  // StormGeo - delegated to dbStormGeoStorage
  async getStormgeoSettings(orgId: string, vesselId?: string): Promise<StormgeoSetting | undefined> { return dbStormGeoStorage.getStormgeoSettings(orgId, vesselId); }
  async createStormgeoSettings(settings: InsertStormgeoSetting): Promise<StormgeoSetting> { return dbStormGeoStorage.createStormgeoSettings(settings); }
  async updateStormgeoSettings(id: string, settings: Partial<InsertStormgeoSetting>, orgId: string): Promise<StormgeoSetting> { return dbStormGeoStorage.updateStormgeoSettings(id, settings, orgId); }
  async getStormgeoSnapshots(orgId: string, filters?: { vesselId?: string; snapshotType?: string; routeId?: string; forecastTimeStart?: Date; forecastTimeEnd?: Date }): Promise<StormgeoSnapshot[]> { return dbStormGeoStorage.getStormgeoSnapshots(orgId, filters); }
  async getStormgeoSnapshotForTime(vesselId: string, forecastTime: Date, orgId: string): Promise<StormgeoSnapshot | undefined> { return dbStormGeoStorage.getStormgeoSnapshotForTime(vesselId, forecastTime, orgId); }
  async createStormgeoSnapshot(snapshot: InsertStormgeoSnapshot): Promise<StormgeoSnapshot> { return dbStormGeoStorage.createStormgeoSnapshot(snapshot); }
  async bulkCreateStormgeoSnapshots(snapshots: InsertStormgeoSnapshot[]): Promise<StormgeoSnapshot[]> { return dbStormGeoStorage.bulkCreateStormgeoSnapshots(snapshots); }
  async createDeckLogHourlyAutoFill(autoFill: InsertDeckLogHourlyAutoFill): Promise<DeckLogHourlyAutoFill> { return dbStormGeoStorage.createDeckLogHourlyAutoFill(autoFill); }
  async getStormgeoImportHistory(orgId: string, filters?: { vesselId?: string; status?: string; limit?: number }): Promise<StormgeoImportHistory[]> { return dbStormGeoStorage.getStormgeoImportHistory(orgId, filters); }
  async createStormgeoImportHistory(history: InsertStormgeoImportHistory): Promise<StormgeoImportHistory> { return dbStormGeoStorage.createStormgeoImportHistory(history); }
  async updateStormgeoImportHistory(id: string, history: Partial<InsertStormgeoImportHistory>, orgId: string): Promise<StormgeoImportHistory> { return dbStormGeoStorage.updateStormgeoImportHistory(id, history, orgId); }

  // Crew Certifications & Documents - delegated to dbCrewExtensionsStorage
  async getCrewCertifications(crewId: string, orgId: string): Promise<SelectCrewCertification[]> { return dbCrewExtensionsStorage.getCrewCertifications(crewId, orgId); }
  async createCrewCertification(data: InsertCrewCertification): Promise<SelectCrewCertification> { return dbCrewExtensionsStorage.createCrewCertification(data); }
  async updateCrewCertification(id: string, data: Partial<InsertCrewCertification>, orgId: string): Promise<SelectCrewCertification> { return dbCrewExtensionsStorage.updateCrewCertification(id, data, orgId); }
  async deleteCrewCertification(id: string, orgId: string): Promise<void> { return dbCrewExtensionsStorage.deleteCrewCertification(id, orgId); }
  async getCrewDocuments(crewId: string, orgId: string): Promise<SelectCrewDocument[]> { return dbCrewExtensionsStorage.getCrewDocuments(crewId, orgId); }
  async createCrewDocument(data: InsertCrewDocument): Promise<SelectCrewDocument> { return dbCrewExtensionsStorage.createCrewDocument(data); }
  async updateCrewDocument(id: string, data: Partial<InsertCrewDocument>, orgId: string): Promise<SelectCrewDocument> { return dbCrewExtensionsStorage.updateCrewDocument(id, data, orgId); }
  async deleteCrewDocument(id: string, orgId: string): Promise<void> { return dbCrewExtensionsStorage.deleteCrewDocument(id, orgId); }
  async updateDocumentAlertFlags(orgId: string): Promise<{ scanned: number; flagged: number; critical: number; warning: number; notice: number }> { return dbCrewExtensionsStorage.updateDocumentAlertFlags(orgId); }
  async getCrewNotificationSettings(crewId: string, orgId: string): Promise<CrewNotificationSettings | undefined> { return dbCrewExtensionsStorage.getCrewNotificationSettings(crewId, orgId); }
  async upsertCrewNotificationSettings(crewId: string, orgId: string, data: { emailAlertsEnabled?: boolean; certExpiryEmailEnabled?: boolean; documentExpiryEmailEnabled?: boolean; complianceEmailEnabled?: boolean; overrideEmail?: string | null }): Promise<CrewNotificationSettings> { return dbCrewExtensionsStorage.upsertCrewNotificationSettings(crewId, orgId, data); }
  async getAllCrewNotificationSettings(orgId: string): Promise<CrewNotificationSettings[]> { return dbCrewExtensionsStorage.getAllCrewNotificationSettings(orgId); }
  async getCertificationsExpiring(orgId: string, daysAhead: number = 90, includeAcknowledged: boolean = false): Promise<SelectCrewCertification[]> { return dbCrewExtensionsStorage.getCertificationsExpiring(orgId, daysAhead, includeAcknowledged); }
  async acknowledgeCertificationAlert(certId: string, userId?: string, notes?: string): Promise<SelectCrewCertification> { return dbCrewExtensionsStorage.acknowledgeCertificationAlert(certId, userId, notes); }
  async updateCertificationAlertFlags(orgId: string): Promise<{ scanned: number; flagged: number; critical: number; warning: number; notice: number }> { return dbCrewExtensionsStorage.updateCertificationAlertFlags(orgId); }
  async getDocumentsExpiring(orgId: string, daysAhead: number = 90, includeAcknowledged: boolean = false): Promise<SelectCrewDocument[]> { return dbCrewExtensionsStorage.getDocumentsExpiring(orgId, daysAhead, includeAcknowledged); }
  async acknowledgeDocumentAlert(docId: string, userId?: string, notes?: string): Promise<SelectCrewDocument> { return dbCrewExtensionsStorage.acknowledgeDocumentAlert(docId, userId, notes); }

  // Compliance - direct DB queries (bypassing broken logbooks adapter)
  async getComplianceFindings(orgId: string, filters?: { vesselId?: string; sourceType?: string; severity?: string; status?: string; ruleCode?: string; startDate?: string; endDate?: string }): Promise<ComplianceFinding[]> {
    const result = await db.execute(sql`
      SELECT * FROM compliance_findings 
      WHERE org_id = ${orgId}
      ${filters?.vesselId ? sql`AND vessel_id = ${filters.vesselId}` : sql``}
      ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``}
      ${filters?.severity ? sql`AND severity = ${filters.severity}` : sql``}
      ${filters?.status ? sql`AND status = ${filters.status}` : sql``}
      ${filters?.ruleCode ? sql`AND rule_code = ${filters.ruleCode}` : sql``}
      ${filters?.startDate ? sql`AND found_at >= ${filters.startDate}::timestamp` : sql``}
      ${filters?.endDate ? sql`AND found_at <= ${filters.endDate}::timestamp` : sql``}
      ORDER BY found_at DESC
    `);
    return result.rows as ComplianceFinding[];
  }
  async getComplianceRules(orgId: string, filters?: { sourceType?: string; category?: string; enabled?: boolean }): Promise<ComplianceRule[]> {
    const result = await db.execute(sql`
      SELECT * FROM compliance_rules 
      WHERE org_id = ${orgId}
      ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``}
      ${filters?.category ? sql`AND category = ${filters.category}` : sql``}
      ${filters?.enabled !== undefined ? sql`AND enabled = ${filters.enabled}` : sql``}
      ORDER BY rule_name ASC
    `);
    return result.rows as ComplianceRule[];
  }

  // Threshold Optimizations - delegated to dbMlAnalyticsStorage

  // Hub Sync - delegated to dbHubSyncStorage
  async getSheetLock(sheetType: string, sheetId: string): Promise<SelectSheetLock | undefined> { return dbHubSyncStorage.getSheetLock(sheetType, sheetId); }
  async acquireSheetLock(data: InsertSheetLock): Promise<SelectSheetLock> { return dbHubSyncStorage.acquireSheetLock(data); }
  async releaseSheetLock(sheetType: string, sheetId: string): Promise<void> { return dbHubSyncStorage.releaseSheetLock(sheetType, sheetId); }
  async getSheetVersion(sheetType: string, sheetId: string): Promise<SelectSheetVersion | undefined> { return dbHubSyncStorage.getSheetVersion(sheetType, sheetId); }
  async incrementSheetVersion(data: InsertSheetVersion): Promise<SelectSheetVersion> { return dbHubSyncStorage.incrementSheetVersion(data); }

  // Vessels - delegated to vesselService
  async getVessels(orgId?: string): Promise<SelectVessel[]> { return vesselService.getVessels(orgId); }
  async getVessel(id: string, orgId?: string): Promise<SelectVessel | undefined> { return vesselService.getVessel(id, orgId); }
  async createVessel(vessel: InsertVessel): Promise<SelectVessel> { return vesselService.createVessel(vessel); }
  async updateVessel(id: string, updates: Partial<InsertVessel>, orgId: string): Promise<SelectVessel> { return vesselService.updateVessel(id, updates, orgId); }
  async deleteVessel(id: string, deleteEquipment?: boolean, orgId?: string): Promise<void> { return vesselService.deleteVessel(id, orgId); }

  // Port calls & drydock windows - delegated to dbVesselStorage
  async getPortCalls(vesselId?: string, orgId?: string): Promise<SelectPortCall[]> { return dbVesselStorage.getPortCalls(vesselId, orgId); }
  async getDrydockWindows(orgId?: string, vesselId?: string): Promise<SelectDrydockWindow[]> { return dbVesselStorage.getDrydockWindows(orgId, vesselId); }

  // Shift templates and crew assignments - delegated to dbCrewStorage
  async getShiftTemplates(orgId?: string): Promise<SelectShiftTemplate[]> { return dbCrewStorage.getShiftTemplates(orgId); }
  async createShiftTemplate(data: InsertShiftTemplate): Promise<SelectShiftTemplate> { return dbCrewStorage.createShiftTemplate(data); }
  async deleteShiftTemplate(id: string, orgId: string): Promise<void> { return dbCrewStorage.deleteShiftTemplate(id, orgId); }
  async getCrewAssignments(orgId: string, date?: string, vesselId?: string): Promise<SelectCrewAssignment[]> { return dbCrewStorage.getCrewAssignments(orgId, date, vesselId); }
  async createCrewAssignment(data: InsertCrewAssignment): Promise<SelectCrewAssignment> { return dbCrewStorage.createCrewAssignment(data); }
  async updateCrewAssignment(id: string, updates: Partial<InsertCrewAssignment>, orgId: string): Promise<SelectCrewAssignment> { return dbCrewStorage.updateCrewAssignment(id, updates, orgId); }
  async deleteCrewAssignment(id: string, orgId: string): Promise<void> { return dbCrewStorage.deleteCrewAssignment(id, orgId); }
  async getCrewAssignmentsByDateRange(from: Date, to: Date, orgId?: string): Promise<SelectCrewAssignment[]> { return dbCrewStorage.getCrewAssignmentsByDateRange(from, to, orgId); }
  async deleteCrewAssignmentsByRunId(orgId: string, runId: string): Promise<number> { return dbCrewStorage.deleteCrewAssignmentsByRunId(orgId, runId); }
  async getCrewLeave(crewId: string, orgId: string): Promise<SelectCrewLeave[]> { return dbCrewStorage.getCrewLeave(crewId, orgId); }
  async createCrewLeave(data: InsertCrewLeave): Promise<SelectCrewLeave> { return dbCrewStorage.createCrewLeave(data); }
  async updateCrewLeave(id: string, updates: Partial<InsertCrewLeave>, orgId: string): Promise<SelectCrewLeave> { return dbCrewStorage.updateCrewLeave(id, updates, orgId); }
  async deleteCrewLeave(id: string, orgId: string): Promise<void> { return dbCrewStorage.deleteCrewLeave(id, orgId); }
  async getCrewSkills(crewId: string): Promise<SelectCrewSkill[]> { return dbCrewStorage.getCrewSkills(crewId); }

  // Scheduler runs - delegated to dbSchedulerStorage
  async getSchedulerRuns(orgId: string, limit?: number): Promise<any[]> { return dbSchedulerStorage.getSchedulerRuns(orgId, undefined, limit); }
  async getSchedulerRun(id: string): Promise<any> { return dbSchedulerStorage.getSchedulerRun(id); }
  async getScheduleAssignmentsByRun(runId: string): Promise<any[]> { return dbSchedulerStorage.getScheduleAssignmentsByRun?.(runId) ?? []; }
  async createSchedulerRun(run: any): Promise<any> { return dbSchedulerStorage.createSchedulerRun(run); }
  async deleteSchedulerRuns(orgId: string): Promise<void> { return dbSchedulerStorage.deleteSchedulerRuns(orgId); }
  async deleteScheduleAssignmentsByOrg(orgId: string): Promise<void> { return dbSchedulerStorage.deleteScheduleAssignmentsByOrg(orgId); }
  async deleteScheduleUnfilledByOrg(orgId: string): Promise<void> { return dbSchedulerStorage.deleteScheduleUnfilledByOrg(orgId); }

  // Insights - delegated to analyticsAdapter
  async createInsightSnapshot(snapshot: InsertInsightSnapshot): Promise<InsightSnapshot> { return this.analyticsAdapter.createInsightSnapshot(snapshot); }

  // Admin sessions & audit - delegated to dbSystemAdminStorage
  async getAdminSessionByToken(tokenHash: string): Promise<AdminSession | undefined> { return dbSystemAdminStorage.getAdminSessionByToken(tokenHash); }
  async updateAdminSessionActivity(sessionId: string): Promise<void> { return dbSystemAdminStorage.updateAdminSessionActivity(sessionId); }
  async createAdminAuditEvent(event: InsertAdminAuditEvent): Promise<AdminAuditEvent> { return dbSystemAdminStorage.createAdminAuditEvent(event); }
  async updateAdminAuditEvent(id: string, updates: Partial<Pick<AdminAuditEvent, "outcome" | "severity" | "details">>): Promise<AdminAuditEvent> { return dbSystemAdminStorage.updateAdminAuditEvent(id, updates); }

  // Admin system settings - delegated to dbSystemAdminStorage

  // ML Models - delegated to dbMlAnalyticsStorage
  async getMlModels(orgId?: string, modelType?: string): Promise<MlModel[]> { return dbMlAnalyticsStorage.getMlModels(orgId, modelType); }
  async getMlModel(id: string): Promise<MlModel | undefined> { return dbMlAnalyticsStorage.getMlModel(id); }
  async createMlModel(model: InsertMlModel): Promise<MlModel> { return dbMlAnalyticsStorage.createMlModel(model); }
  async updateMlModel(id: string, updates: Partial<InsertMlModel>): Promise<MlModel> { return dbMlAnalyticsStorage.updateMlModel(id, updates); }
  async deleteMlModel(id: string): Promise<void> { return dbMlAnalyticsStorage.deleteMlModel(id); }
  async getMlModelAccuracyHistory(modelId: string): Promise<MlModelAccuracyHistory[]> { return dbMlAnalyticsStorage.getMlModelAccuracyHistory(modelId); }
  async getEngineerOverrides(orgId: string, filters?: { equipmentId?: string; engineerId?: string; overrideType?: string; outcomeStatus?: string; fromDate?: Date; toDate?: Date }): Promise<EngineerOverride[]> { return dbMlAnalyticsStorage.getEngineerOverrides(orgId, filters); }
  async createEngineerOverride(override: InsertEngineerOverride, orgId: string): Promise<EngineerOverride> { return dbMlAnalyticsStorage.createEngineerOverride(override, orgId); }

  // Equipment - delegated to dbEquipmentStorage
  async getEquipmentRegistry(orgId?: string): Promise<any[]> { return dbEquipmentStorage.getEquipmentRegistry(orgId); }
  async getEquipment(orgId: string, equipmentId: string): Promise<any | undefined> { return dbEquipmentStorage.getEquipment(orgId, equipmentId); }
  async getEquipmentHealth(orgId: string, vesselId?: string, equipmentId?: string): Promise<any[]> { return dbEquipmentStorage.getEquipmentHealth(orgId, { vesselId, equipmentId }); }
  async deleteEquipment(id: string, orgId?: string): Promise<void> { return dbEquipmentStorage.deleteEquipment(id, orgId); }
  async getVesselEquipment(vesselId: string, orgId?: string): Promise<any[]> { return dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || ''); }
  async assignEquipmentToVessel(vesselId: string, equipmentId: string, orgId?: string): Promise<any> { return dbEquipmentStorage.associateEquipmentToVessel(equipmentId, vesselId, orgId || ''); }
  async unassignEquipmentFromVessel(vesselId: string, equipmentId: string, orgId?: string): Promise<void> { return dbEquipmentStorage.disassociateEquipmentFromVessel(equipmentId, orgId || ''); }

  // Users & Organizations - delegated to dbUserStorage
  async getOrganizations(): Promise<Organization[]> { return dbUserStorage.getOrganizations(); }
  async getOrganization(id: string): Promise<Organization | undefined> { return dbUserStorage.getOrganization(id); }
  async createOrganization(org: InsertOrganization): Promise<Organization> { return dbUserStorage.createOrganization(org); }
  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> { return dbUserStorage.updateOrganization(id, updates); }
  async getUsers(orgId?: string): Promise<User[]> { return dbUserStorage.getUsers(orgId); }
  async getUser(id: string): Promise<User | undefined> { return dbUserStorage.getUser(id); }
  async getUserByEmail(email: string, orgId?: string): Promise<User | undefined> { return dbUserStorage.getUserByEmail(email, orgId); }
  async createUser(user: InsertUser): Promise<User> { return dbUserStorage.createUser(user); }

  // Additional delegated methods for remaining functionality

  // Missing methods - added for proper interface compliance with tenant isolation
  async getDevicesWithStatus(orgId?: string): Promise<any[]> {
    const deviceList = await dbDevicesStorage.getDevices(orgId);
    const heartbeats = orgId ? await dbDevicesStorage.getHeartbeatsByOrg(orgId) : await dbDevicesStorage.getHeartbeats();
    return deviceList.map((device) => {
      const hb = heartbeats.find((x) => x.deviceId === device.id);
      let status = "Offline";
      if (hb) {
        const timeDiff = Date.now() - (hb.ts?.getTime() || 0);
        if (timeDiff < 5 * 60 * 1000) {
          if ((hb.cpuPct || 0) > 90 || (hb.memPct || 0) > 90 || (hb.diskFreeGb || 0) < 5) { status = "Critical"; }
          else if ((hb.cpuPct || 0) > 80 || (hb.memPct || 0) > 80 || (hb.diskFreeGb || 0) < 10) { status = "Warning"; }
          else { status = "Online"; }
        }
      }
      return { ...device, status, lastHeartbeat: hb };
    });
  }

  async getLatestInsightSnapshot(orgId: string, scope: string): Promise<InsightSnapshot | undefined> {
    const [result] = await db.select().from(insightSnapshots).where(and(eq(insightSnapshots.orgId, orgId), eq(insightSnapshots.scope, scope))).orderBy(sql`${insightSnapshots.createdAt} DESC`).limit(1);
    return result;
  }

  async getActiveDtcs(equipmentId: string, orgId?: string): Promise<any[]> {
    return dbDtcStorage.getActiveDtcs(equipmentId, orgId);
  }

  // Transport Settings - stub implementations (no database table yet)

  // Error Logs

  async getNotificationSettings(orgId?: string, filters?: any): Promise<any[]> {
    return dbNotificationsStorage.getNotificationSettings(orgId, filters?.userId);
  }

  async getNotificationQueue(orgId?: string, filters?: any): Promise<any[]> {
    return dbNotificationsStorage.getEmailQueue(filters?.status);
  }

  [key: string]: any;
}
