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
  async getHeartbeats(): Promise<EdgeHeartbeat[]> { return dbDevicesStorage.getHeartbeats(); }
  async getHeartbeat(deviceId: string): Promise<EdgeHeartbeat | undefined> { return dbDevicesStorage.getHeartbeat(deviceId); }
  async upsertHeartbeat(heartbeat: InsertHeartbeat): Promise<EdgeHeartbeat> { return dbDevicesStorage.upsertHeartbeat(heartbeat); }
  async getPdmScores(equipmentId: string | undefined, orgId: string): Promise<PdmScoreLog[]> { return dbDevicesStorage.getPdmScores(equipmentId, orgId); }
  async createPdmScore(score: InsertPdmScore): Promise<PdmScoreLog> { return dbDevicesStorage.createPdmScore(score); }
  async getLatestPdmScore(equipmentId: string): Promise<PdmScoreLog | undefined> { return dbDevicesStorage.getLatestPdmScore(equipmentId); }

  // Work order methods - delegated to workOrderService
  async getWorkOrders(equipmentId?: string, orgId?: string, filters?: WorkOrderFilters): Promise<WorkOrder[]> { return workOrderService.getWorkOrdersWithDetails(equipmentId, orgId, filters); }
  async getWorkOrdersPaginated(equipmentId: string | undefined, orgId: string | undefined, limit: number, offset: number, filters?: WorkOrderFilters): Promise<{ items: WorkOrder[]; total: number }> { return workOrderService.getWorkOrdersPaginated(equipmentId, orgId, limit, offset, filters); }
  async getWorkOrderById(id: string, orgId: string): Promise<WorkOrder | undefined> { return workOrderService.getWorkOrderById(id, orgId); }
  async generateWorkOrderNumber(orgId: string): Promise<string> { return workOrderService.generateWorkOrderNumber(orgId); }
  async createWorkOrder(order: InsertWorkOrder & { woNumber?: string; id?: string }): Promise<WorkOrder> { return workOrderService.createWorkOrder(order); }
  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder> { return workOrderService.updateWorkOrderWithDowntimeTracking(id, updates); }

  async closeWorkOrder(id: string, closeData: { notes?: string; completedBy?: string }): Promise<WorkOrder> {
    const closedOrder = await db.transaction(async (tx) => {
      const txParts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, id));
      await tx.select().from(stock).where(sql`${stock.partId} = ANY(${txParts.map((p) => p.partId)})`).for("update");
      const [workOrder] = await tx.select().from(workOrders).where(eq(workOrders.id, id)).limit(1).for("update");
      if (!workOrder) { throw new Error(`Work order ${id} not found`); }
      if (workOrder.status === "completed") { throw new Error(`Work order ${id} is already completed`); }
      const lockedParts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, id)).for("update");
      for (const part of lockedParts) {
        const [targetStock] = await tx.select().from(stock).where(and(eq(stock.partId, part.partId), eq(stock.orgId, workOrder.orgId), sql`${stock.quantityReserved} > 0`)).orderBy(sql`${stock.quantityReserved} DESC`).limit(1);
        if (targetStock) {
          await tx.update(stock).set({ quantityReserved: sql`GREATEST(0, ${stock.quantityReserved} - ${part.quantityUsed})`, updatedAt: new Date() }).where(eq(stock.id, targetStock.id));
        }
      }
      const finalParts = await tx.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, id));
      if (finalParts.length !== lockedParts.length) { throw new Error(`Concurrent modification detected: parts were added to work order ${id} during close operation.`); }
      const finalUpdates: Partial<InsertWorkOrder> = { status: "completed" as const, actualEndDate: new Date() };
      if (workOrder.affectsVesselDowntime && workOrder.equipmentId && workOrder.vesselDowntimeStartedAt) {
        const eqRes = await tx.select().from(equipment).where(eq(equipment.id, workOrder.equipmentId)).limit(1);
        if (eqRes.length > 0 && eqRes[0].vesselId) {
          const vesselId = eqRes[0].vesselId;
          const startTime = new Date(workOrder.vesselDowntimeStartedAt);
          const downtimeDays = (new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
          const vessel = await tx.select().from(vessels).where(eq(vessels.id, vesselId)).limit(1);
          if (vessel.length > 0) { const cd = Number.parseFloat(vessel[0].downtimeDays || "0"); await tx.update(vessels).set({ downtimeDays: (cd + downtimeDays).toFixed(2), updatedAt: new Date() }).where(eq(vessels.id, vesselId)); }
          finalUpdates.vesselDowntimeStartedAt = null;
        }
      }

      if (closeData.notes || closeData.completedBy) { await tx.insert(workOrderWorklogs).values({ workOrderId: id, orgId: workOrder.orgId, performedBy: closeData.completedBy || "system", laborHours: 0, laborCost: 0, notes: closeData.notes || "Work order completed", performedAt: new Date() }); }
      const [updated] = await tx.update(workOrders).set(finalUpdates).where(eq(workOrders.id, id)).returning();
      if (!updated) { throw new Error(`Failed to update work order ${id}`); }
      return updated;
    });
    const wsServer = getWebSocketServer(); wsServer?.broadcastWorkOrderChange("update", closedOrder);
    return closedOrder;
  }

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
  async createWorkOrderCompletion(completion: InsertWorkOrderCompletion): Promise<WorkOrderCompletion> { const [r] = await db.insert(workOrderCompletions).values(completion).returning(); return r; }
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
      for (const woPart of woParts) {
        const [currentStock] = await tx.select().from(stock).where(and(eq(stock.partId, woPart.partId), eq(stock.orgId, completionData.orgId))).limit(1);
        if (currentStock) {
          const quantityBefore = Math.round(currentStock.quantityOnHand ?? 0), reservedBefore = Math.round(currentStock.quantityReserved ?? 0), quantityToConsume = woPart.quantityUsed;
          await tx.update(stock).set({ quantityOnHand: sql`GREATEST(0, ${stock.quantityOnHand} - ${quantityToConsume})`, quantityReserved: sql`GREATEST(0, ${stock.quantityReserved} - ${quantityToConsume})`, updatedAt: now }).where(eq(stock.id, currentStock.id));
          await tx.insert(inventoryMovements).values({ orgId: completionData.orgId, partId: woPart.partId, workOrderId, movementType: "consume", quantity: -quantityToConsume, quantityBefore, quantityAfter: Math.max(0, quantityBefore - quantityToConsume), reservedBefore, reservedAfter: Math.max(0, reservedBefore - quantityToConsume), performedBy: completionData.completedBy || "system", notes: `Consumed during work order completion: ${updatedWorkOrder.woNumber || workOrderId}` });
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
  async getTelemetryTrends(equipmentId?: string, hours: number = 24): Promise<TelemetryTrend[]> { return dbTelemetryStorage.getTelemetryTrends(equipmentId, hours); }
  async createTelemetryReading(reading: InsertTelemetry): Promise<EquipmentTelemetry> { return dbTelemetryStorage.createTelemetryReading(reading); }
  async getTelemetryHistory(arg1: string, arg2: string, arg3?: number | string, arg4?: Date, arg5?: Date): Promise<EquipmentTelemetry[]> { return dbTelemetryStorage.getTelemetryHistory(arg1, arg2, arg3, arg4, arg5); }
  async getTelemetryByEquipmentAndDateRange(equipmentId: string, startDate: Date, endDate: Date, orgId?: string): Promise<EquipmentTelemetry[]> { return dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(equipmentId, startDate, endDate, orgId); }
  async getLatestTelemetryReadings(vesselId?: string, equipmentId?: string, sensorType?: string, limit: number = 500, orgId?: string): Promise<EquipmentTelemetry[]> { return dbTelemetryStorage.getLatestTelemetryReadings(vesselId, equipmentId, sensorType, limit, orgId); }
  async getVesselFleetOverview(orgId?: string): Promise<{ vessels: number; signalsMapped: number; signalsDiscovered: number; latestPerVessel: Array<{ vesselId: string; lastTs: string }>; dq7d: Record<string, number> }> {
    const v = await vesselService.getVessels(orgId);
    return { vessels: v.length, signalsMapped: 0, signalsDiscovered: 0, latestPerVessel: v.map(x => ({ vesselId: x.id, lastTs: new Date().toISOString() })), dq7d: {} };
  }

  // Sensor configuration methods - delegated to dbSensorsStorage
  async getSensorConfigurations(orgId?: string, equipmentId?: string, sensorType?: string): Promise<SensorConfiguration[]> { return dbSensorsStorage.getSensorConfigurations(orgId, equipmentId, sensorType); }
  async getSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<SensorConfiguration | undefined> { return dbSensorsStorage.getSensorConfiguration(equipmentId, sensorType, orgId); }
  async createSensorConfiguration(config: InsertSensorConfiguration): Promise<SensorConfiguration> { return dbSensorsStorage.createSensorConfiguration(config); }
  async bulkCreateSensorConfigurations(configs: InsertSensorConfiguration[], overwriteExisting?: boolean): Promise<SensorConfiguration[]> { return dbSensorsStorage.bulkCreateSensorConfigurations(configs, overwriteExisting); }
  async updateSensorConfiguration(equipmentId: string, sensorType: string, config: Partial<InsertSensorConfiguration>, orgId?: string): Promise<SensorConfiguration> { return dbSensorsStorage.updateSensorConfiguration(equipmentId, sensorType, config, orgId); }
  async deleteSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<void> { return dbSensorsStorage.deleteSensorConfiguration(equipmentId, sensorType, orgId); }
  async updateSensorConfigurationById(id: string, config: Partial<InsertSensorConfiguration>, orgId?: string): Promise<SensorConfiguration> { return dbSensorsStorage.updateSensorConfigurationById(id, config, orgId); }
  async deleteSensorConfigurationById(id: string, orgId?: string): Promise<void> { return dbSensorsStorage.deleteSensorConfigurationById(id, orgId); }
  async getSensorState(equipmentId: string, sensorType: string, orgId?: string): Promise<SensorState | undefined> { return dbSensorsStorage.getSensorState(equipmentId, sensorType, orgId); }
  async upsertSensorState(state: InsertSensorState): Promise<SensorState> { return dbSensorsStorage.upsertSensorState(state); }
  async getLatestTelemetryForSensor(equipmentId: string, sensorType: string, orgId: string): Promise<{ ts: Date; value: number } | undefined> { return dbSensorsStorage.getLatestTelemetryForSensor(equipmentId, sensorType, orgId); }
  async getLatestTelemetryForSensors(sensors: Array<{ equipmentId: string; sensorType: string }>, orgId: string): Promise<Array<{ equipmentId: string; sensorType: string; ts: Date | null; value: number | null }>> { return dbSensorsStorage.getLatestTelemetryForSensors(sensors, orgId); }
  async getSensorTemplates(orgId: string, equipmentType?: string): Promise<SensorTemplate[]> { return dbSensorsStorage.getSensorTemplates(orgId, equipmentType); }
  async getSensorTemplateById(id: string, orgId: string): Promise<SensorTemplate | null> { return dbSensorsStorage.getSensorTemplateById(id, orgId); }
  async createSensorTemplate(template: InsertSensorTemplate & { orgId: string }): Promise<SensorTemplate> { return dbSensorsStorage.createSensorTemplate(template); }
  async updateSensorTemplate(id: string, orgId: string, data: Partial<InsertSensorTemplate>): Promise<SensorTemplate> { return dbSensorsStorage.updateSensorTemplate(id, orgId, data); }
  async deleteSensorTemplate(id: string, orgId: string): Promise<void> { return dbSensorsStorage.deleteSensorTemplate(id, orgId); }

  // Alert methods - delegated to dbAlertStorage
  async getAlertConfigurations(equipmentId?: string): Promise<AlertConfiguration[]> { return dbAlertStorage.getAlertConfigurations(equipmentId); }
  async createAlertConfiguration(config: InsertAlertConfig): Promise<AlertConfiguration> { return dbAlertStorage.createAlertConfiguration(config); }
  async updateAlertConfiguration(id: string, config: Partial<InsertAlertConfig>): Promise<AlertConfiguration> { return dbAlertStorage.updateAlertConfiguration(id, config); }
  async deleteAlertConfiguration(id: string): Promise<void> { return dbAlertStorage.deleteAlertConfiguration(id); }
  async getAlertNotifications(acknowledged?: boolean, orgId?: string): Promise<AlertNotification[]> { return dbAlertStorage.getAlertNotifications(acknowledged, orgId); }
  async getAlertNotificationsPaginated(acknowledged: boolean | undefined, orgId: string | undefined, limit: number, offset: number): Promise<{ items: AlertNotification[]; total: number }> { return dbAlertStorage.getAlertNotificationsPaginated(acknowledged, orgId, limit, offset); }
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
  async logComplianceAction(data: InsertComplianceAuditLog): Promise<ComplianceAuditLog> { return dbComplianceStorage.logComplianceAction(data); }
  async getComplianceAuditLog(filters?: { entityType?: string; entityId?: string; complianceStandard?: string; startDate?: Date; endDate?: Date }): Promise<ComplianceAuditLog[]> { return dbComplianceStorage.getComplianceAuditLog(filters); }

  // Settings - delegated to dbSettingsStorage
  async getSettings(): Promise<SystemSettings> { return dbSettingsStorage.getSettings(); }
  async updateSettings(updates: Partial<InsertSettings>): Promise<SystemSettings> { return dbSettingsStorage.updateSettings(updates); }

  // Dashboard metrics - delegated to analyticsAdapter
  async getDashboardMetrics(orgId: string): Promise<DashboardMetrics> { return this.analyticsAdapter.getDashboardMetrics(orgId); }
  async recordMetricsHistory(orgId: string, metrics: Omit<DashboardMetrics, "trends">, equipmentStats: { total: number; healthy: number; warning: number; critical: number }): Promise<void> { return dbAnalyticsStorage.recordMetricsHistory(orgId, metrics, equipmentStats); }
  async getMetricsHistory(orgId: string, days?: number): Promise<any[]> { return dbAnalyticsStorage.getMetricsHistory(orgId, days); }

  // STCW Hours of Rest - delegated to dbStcwStorage
  async createCrewRestSheet(sheet: InsertCrewRestSheet): Promise<SelectCrewRestSheet> { return dbStcwStorage.createCrewRestSheet(sheet); }
  async upsertCrewRestDay(sheetId: string, dayData: any): Promise<SelectCrewRestDay> { return dbStcwStorage.upsertCrewRestDay(sheetId, dayData); }
  async getCrewRestMonth(crewId: string, year: number, month: string): Promise<{ sheet: SelectCrewRestSheet | null; days: any[] }> { return dbStcwStorage.getCrewRestMonth(crewId, year, month); }
  async getCrewRestRange(crewId: string, startDate: string, endDate: string): Promise<{ sheets: SelectCrewRestSheet[]; days: SelectCrewRestDay[] }> { return dbStcwStorage.getCrewRestRange(crewId, startDate, endDate); }
  async getMultipleCrewRest(crewIds: string[], year: number, month: string): Promise<{ [crewId: string]: { sheet: SelectCrewRestSheet | null; days: SelectCrewRestDay[] } }> { return dbStcwStorage.getMultipleCrewRest(crewIds, year, month); }
  async getVesselCrewRest(vesselId: string, year: number, month: string): Promise<{ [crewId: string]: { sheet: SelectCrewRestSheet | null; days: SelectCrewRestDay[] } }> { return dbStcwStorage.getVesselCrewRest(vesselId, year, month); }
  async getCrewRestByDateRange(vesselId?: string, startDate?: string, endDate?: string, complianceFilter?: boolean): Promise<{ crewId: string; vesselId: string; sheet: SelectCrewRestSheet; days: SelectCrewRestDay[] }[]> { return dbStcwStorage.getCrewRestByDateRange(vesselId, startDate, endDate, complianceFilter); }

  // Work Order Checklists - delegated to dbChecklistsStorage
  async getWorkOrderChecklists(workOrderId?: string, orgId?: string): Promise<WorkOrderChecklist[]> { return dbChecklistsStorage.getWorkOrderChecklists(workOrderId, orgId); }
  async createWorkOrderChecklist(checklist: InsertWorkOrderChecklist): Promise<WorkOrderChecklist> { return dbChecklistsStorage.createWorkOrderChecklist(checklist); }
  async updateWorkOrderChecklist(id: string, updates: Partial<InsertWorkOrderChecklist>): Promise<WorkOrderChecklist> { return dbChecklistsStorage.updateWorkOrderChecklist(id, updates); }
  async deleteWorkOrderChecklist(id: string): Promise<void> { return dbChecklistsStorage.deleteWorkOrderChecklist(id); }
  async getWorkOrderWorklogs(workOrderId?: string, orgId?: string): Promise<WorkOrderWorklog[]> { return dbChecklistsStorage.getWorkOrderWorklogs(workOrderId, orgId); }
  async createWorkOrderWorklog(worklog: InsertWorkOrderWorklog): Promise<WorkOrderWorklog> { return dbChecklistsStorage.createWorkOrderWorklog(worklog); }
  async updateWorkOrderWorklog(id: string, updates: Partial<InsertWorkOrderWorklog>): Promise<WorkOrderWorklog> { return dbChecklistsStorage.updateWorkOrderWorklog(id, updates); }
  async deleteWorkOrderWorklog(id: string): Promise<void> { return dbChecklistsStorage.deleteWorkOrderWorklog(id); }
  async calculateWorklogCosts(workOrderId: string): Promise<{ totalLaborHours: number; totalLaborCost: number }> { return dbChecklistsStorage.calculateWorklogCosts(workOrderId); }
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
  async deletePart(id: string, orgId: string): Promise<void> { return dbInventoryStorage.deletePartsInventory(id, orgId); }
  async getLowStockParts(orgId?: string): Promise<PartsInventory[]> { return dbInventoryStorage.getLowStockParts(orgId); }
  async reservePart(partId: string, quantity: number): Promise<PartsInventory> { return dbInventoryStorage.reservePart(partId, quantity); }
  async checkPartAvailabilityForWorkOrder(partId: string, quantity: number, orgId?: string): Promise<{ available: boolean; onHand: number; reserved: number }> { return dbInventoryStorage.checkPartAvailabilityForWorkOrder(partId, quantity, orgId); }
  async reservePartsForWorkOrder(workOrderId: string): Promise<void> { return dbInventoryStorage.reservePartsForWorkOrder(workOrderId); }
  async releasePartsFromWorkOrder(workOrderId: string, orgId: string): Promise<void> { return dbInventoryStorage.releasePartsFromWorkOrder(workOrderId, orgId); }
  async getPartsCatalogue(orgId?: string, search?: string, category?: string, sortBy?: string, sortOrder?: string): Promise<Part[]> { return dbInventoryStorage.getParts(orgId, category ? { category } : undefined); }
  async getPartCatalogueByNumber(partNo: string, orgId?: string): Promise<Part | undefined> { return orgId ? dbInventoryStorage.getPartByPartNumber(partNo, orgId) : undefined; }
  async getPartCatalogueById(id: string, orgId?: string): Promise<Part | undefined> { return dbInventoryStorage.getPart(id, orgId); }
  async createPartCatalogue(part: InsertPart): Promise<Part> { return dbInventoryStorage.createPart(part); }
  async updatePartCatalogue(id: string, updates: Partial<InsertPart>): Promise<Part> { return dbInventoryStorage.updatePart(id, updates); }
  async deletePartCatalogue(id: string): Promise<void> { return dbInventoryStorage.deletePart(id); }
  async syncPartCostToStock(partId: string): Promise<void> { return dbInventoryStorage.syncPartCostToStock(partId); }
  async syncStockCostFromPart(partId: string): Promise<void> { return dbInventoryStorage.syncStockCostFromPart(partId); }
  async getStock(orgId?: string, search?: string, location?: string, sortBy?: string): Promise<Stock[]> { return dbInventoryStorage.getStock(orgId, search, location, sortBy); }
  async getStockByPart(partId: string, orgId?: string): Promise<Stock[]> { return dbInventoryStorage.getStockByPart(partId, orgId); }
  async getStockByPartNumber(partNo: string, orgId?: string): Promise<Stock[]> { return dbInventoryStorage.getStockByPartNumber(partNo, orgId); }
  async createStock(stockData: InsertStock): Promise<Stock> { return dbInventoryStorage.createStock(stockData); }
  async updateStock(id: string, updates: Partial<InsertStock>): Promise<Stock> { return dbInventoryStorage.updateStock(id, updates); }
  async deleteStock(id: string): Promise<void> { return dbInventoryStorage.deleteStock(id); }
  async updateStockQuantities(stockId: string, onHand?: number, reserved?: number): Promise<Stock> { return dbInventoryStorage.updateStockQuantities(stockId, onHand, reserved); }
  async getWorkOrderParts(workOrderId?: string, orgId?: string): Promise<WorkOrderParts[]> { if (!workOrderId) { return []; } return dbWorkOrderStorage.getWorkOrderParts(workOrderId, orgId); }
  async addPartToWorkOrder(workOrderPart: InsertWorkOrderParts): Promise<WorkOrderParts> { return dbInventoryStorage.addPartToWorkOrder(workOrderPart); }
  async updateWorkOrderPart(id: string, updates: Partial<InsertWorkOrderParts>): Promise<WorkOrderParts> { return dbInventoryStorage.updateWorkOrderPart(id, updates); }
  async removePartFromWorkOrder(id: string, orgId?: string): Promise<void> { return dbInventoryStorage.removePartFromWorkOrder(id, orgId); }
  async removePartAndRestoreInventory(workOrderPartId: string, orgId: string, performedBy: string): Promise<void> { return dbInventoryStorage.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy); }
  async addBulkPartsToWorkOrder(workOrderId: string, partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>, orgId: string): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> { return dbInventoryStorage.addBulkPartsToWorkOrder(workOrderId, partsToAdd, orgId); }
  async addBulkPartsAndReserveInventory(workOrderId: string, partsToAdd: Array<{ partId: string; quantity: number; usedBy: string; notes?: string }>, orgId: string): Promise<{ added: WorkOrderParts[]; updated: WorkOrderParts[]; errors: string[] }> { return dbInventoryStorage.addBulkPartsAndReserveInventory(workOrderId, partsToAdd, orgId); }
  async getPartsCostForWorkOrder(workOrderId: string): Promise<{ totalPartsCost: number; partsCount: number }> { return dbInventoryStorage.getPartsCostForWorkOrder(workOrderId); }
  async getWorkOrderHistory(workOrderId: string, orgId: string): Promise<WorkOrderHistory[]> { return dbInventoryStorage.getWorkOrderHistory(workOrderId, orgId); }
  async addWorkOrderHistoryEntry(entry: InsertWorkOrderHistory): Promise<WorkOrderHistory> { return dbInventoryStorage.addWorkOrderHistoryEntry(entry); }
  async getPartStockWithSupplierLeadTime(partId: string, orgId: string) { return dbInventoryStorage.getPartStockWithSupplierLeadTime(partId, orgId); }
  async getInventoryMovementsByWorkOrder(workOrderId: string, orgId: string): Promise<InventoryMovement[]> { return dbInventoryStorage.getInventoryMovementsByWorkOrder(workOrderId, orgId); }
  async getWorkOrderPartsByEquipment(orgId: string, equipmentId: string): Promise<WorkOrderParts[]> { return dbInventoryStorage.getWorkOrderPartsByEquipment(orgId, equipmentId); }
  async getWorkOrderPartsByPartId(orgId: string, partId: string): Promise<WorkOrderParts[]> { return dbInventoryStorage.getWorkOrderPartsByPartId(orgId, partId); }
  async getPartsForEquipment(equipmentId: string, orgId: string): Promise<Part[]> { return dbInventoryStorage.getPartsForEquipment(equipmentId, orgId); }
  async seedStockForParts(orgId: string): Promise<void> { return dbInventoryStorage.seedStockForParts(orgId); }
  async updatePartCost(partId: string, updateData: { unitCost: number; supplier: string }, orgId?: string): Promise<PartsInventory> { return dbAnalyticsStorage.updatePartCost(partId, updateData, orgId || "default-org-id"); }
  async updatePartStockQuantities(partId: string, updateData: { quantityOnHand?: number; quantityReserved?: number; minStockLevel?: number; maxStockLevel?: number }, orgId?: string): Promise<PartsInventory> { return dbAnalyticsStorage.updatePartStockQuantities(partId, updateData, orgId || "default-org-id"); }
  async getEquipmentForPart(partId: string, orgId: string): Promise<Equipment[]> { return dbEquipmentStorage.getEquipmentRegistry(orgId).then(eqs => eqs.filter(e => ('compatibleParts' in e && Array.isArray(e.compatibleParts)) ? e.compatibleParts.includes(partId) : false)); }
  async updatePartCompatibility(partId: string, equipmentIds: string[], orgId: string): Promise<Part> { return dbInventoryStorage.updatePartCatalogue(partId, { compatibleEquipment: equipmentIds }); }

  // Clear methods & idempotency
  async clearOrphanedTelemetryData(): Promise<void> { return dbTelemetryStorage.clearOrphanedTelemetryData(); }
  async clearAllAlerts(): Promise<void> { return dbAlertStorage.clearAllAlerts(); }
  async clearAllWorkOrders(): Promise<void> { return dbWorkOrderStorage.clearAllWorkOrders(); }
  async clearAllMaintenanceSchedules(): Promise<void> { return dbMaintenanceStorage.clearAllMaintenanceSchedules(); }
  async checkIdempotency(key: string, endpoint: string): Promise<boolean> { const r = await db.select().from(idempotencyLog).where(eq(idempotencyLog.key, key)).limit(1); return r.length > 0; }
  async recordIdempotency(key: string, endpoint: string): Promise<void> { await db.insert(idempotencyLog).values({ key, endpoint, createdAt: new Date() }).onConflictDoNothing(); }

  // Maintenance templates - delegated to dbMaintenanceTemplatesStorage
  async getMaintenanceTemplates(orgId?: string, equipmentType?: string, isActive?: boolean): Promise<MaintenanceTemplate[]> { return dbMaintenanceTemplatesStorage.getMaintenanceTemplates(orgId, equipmentType, isActive); }
  async getMaintenanceTemplate(id: string, orgId?: string): Promise<MaintenanceTemplate | undefined> { return dbMaintenanceTemplatesStorage.getMaintenanceTemplate(id, orgId); }
  async createMaintenanceTemplate(template: InsertMaintenanceTemplate): Promise<MaintenanceTemplate> { return dbMaintenanceTemplatesStorage.createMaintenanceTemplate(template); }
  async updateMaintenanceTemplate(id: string, template: Partial<InsertMaintenanceTemplate>, orgId?: string): Promise<MaintenanceTemplate> { return dbMaintenanceTemplatesStorage.updateMaintenanceTemplate(id, template, orgId); }
  async deleteMaintenanceTemplate(id: string, orgId?: string): Promise<void> { return dbMaintenanceTemplatesStorage.deleteMaintenanceTemplate(id, orgId); }
  async cloneMaintenanceTemplate(id: string, newName: string, orgId?: string): Promise<MaintenanceTemplate> { return dbMaintenanceTemplatesStorage.cloneMaintenanceTemplate(id, newName, orgId); }

  // Maintenance scheduling - delegated to dbMaintenanceStorage and schedulingAdapter
  async getMaintenanceSchedules(equipmentId?: string, status?: string): Promise<MaintenanceSchedule[]> { return dbMaintenanceStorage.getMaintenanceSchedules(equipmentId, status); }
  async createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule> { return dbMaintenanceStorage.createMaintenanceSchedule(schedule); }
  async updateMaintenanceSchedule(id: string, updates: Partial<InsertMaintenanceSchedule>): Promise<MaintenanceSchedule> { return dbMaintenanceStorage.updateMaintenanceSchedule(id, updates); }
  async deleteMaintenanceSchedule(id: string): Promise<void> { return dbMaintenanceStorage.deleteMaintenanceSchedule(id); }
  async getMaintenanceRecords(equipmentId?: string, fromDate?: Date, toDate?: Date): Promise<MaintenanceRecord[]> { return dbMaintenanceStorage.getMaintenanceRecords(equipmentId, fromDate, toDate); }
  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> { return dbMaintenanceStorage.createMaintenanceRecord(record); }
  async processCompletedMaintenance(scheduleId: string, record: InsertMaintenanceRecord): Promise<{ schedule: MaintenanceSchedule; record: MaintenanceRecord }> {
    const schedule = await dbMaintenanceStorage.updateMaintenanceSchedule(scheduleId, { status: "completed" });
    const newRecord = await dbMaintenanceStorage.createMaintenanceRecord(record);
    return { schedule, record: newRecord };
  }
  async getMaintenanceCosts(equipmentId?: string): Promise<MaintenanceCost[]> { return dbMaintenanceStorage.getMaintenanceCosts(equipmentId); }
  async createMaintenanceCost(cost: InsertMaintenanceCost): Promise<MaintenanceCost> { return dbMaintenanceStorage.createMaintenanceCost(cost); }
  async getMaintenanceCostsByWorkOrder(workOrderId: string): Promise<MaintenanceCost[]> { return dbMaintenanceStorage.getMaintenanceCostsByWorkOrder(workOrderId); }
  async getScheduleEfficiency(): Promise<{ totalScheduled: number; completed: number; overdue: number; onTime: number }> {
    const schedules = await dbMaintenanceStorage.getMaintenanceSchedules();
    const completed = schedules.filter(s => s.status === "completed").length;
    const overdue = schedules.filter(s => s.status === "overdue" || (s.status === "scheduled" && s.scheduledDate < new Date())).length;
    const onTime = schedules.filter(s => s.status === "completed" && s.completedDate && s.completedDate <= s.scheduledDate).length;
    return { totalScheduled: schedules.length, completed, overdue, onTime };
  }
  async triggerAutoSchedulingForEquipment(equipmentId: string): Promise<MaintenanceSchedule[]> {
    const pdmScore = 75;
    const schedule = await this.schedulingAdapter.autoScheduleMaintenance(equipmentId, pdmScore);
    return schedule ? [schedule] : [];
  }
  async triggerAutoSchedulingForAllEquipment(): Promise<{ scheduled: MaintenanceSchedule[]; errors: string[] }> {
    return { scheduled: [], errors: [] };
  }

  // Crew methods - delegated to dbCrewStorage
  async getCrew(orgId?: string, vesselId?: string): Promise<SelectCrew[]> { return dbCrewStorage.getCrew(orgId, vesselId); }
  async getCrewMember(id: string, orgId?: string): Promise<SelectCrew | undefined> { return dbCrewStorage.getCrewMember(id, orgId); }
  async createCrewMember(crewData: InsertCrew): Promise<SelectCrew> { return dbCrewStorage.createCrewMember(crewData); }
  async createCrew(crewData: InsertCrew): Promise<SelectCrew> { return this.createCrewMember(crewData); }
  async updateCrewMember(id: string, updates: Partial<InsertCrew>): Promise<SelectCrew> { return dbCrewStorage.updateCrewMember(id, updates); }
  async updateCrew(id: string, updates: Partial<InsertCrew>): Promise<SelectCrew> { return this.updateCrewMember(id, updates); }
  async deleteCrewMember(id: string): Promise<void> { return dbCrewStorage.deleteCrewMember(id); }
  async deleteCrew(id: string): Promise<void> { return this.deleteCrewMember(id); }
  async getCrewWithSkills(orgId?: string): Promise<CrewWithSkills[]> { return crewService.getCrewWithSkills(orgId); }
  
  // Skills methods - direct implementation
  async getSkills(orgId?: string): Promise<SelectSkill[]> { const conditions = orgId ? eq(skills.orgId, orgId) : undefined; return conditions ? db.select().from(skills).where(conditions) : db.select().from(skills); }
  async createSkill(skillData: InsertSkill): Promise<SelectSkill> { const [newSkill] = await db.insert(skills).values(skillData).returning(); return newSkill; }
  async updateSkill(id: string, updates: Partial<InsertSkill>): Promise<SelectSkill> { const [updated] = await db.update(skills).set({ ...updates, updatedAt: new Date() }).where(eq(skills.id, id)).returning(); if (!updated) { throw new Error(`Skill ${id} not found`); } return updated; }
  async deleteSkill(id: string): Promise<void> { await db.delete(skills).where(eq(skills.id, id)); }
  async updateCrewRate(crewId: string, updateData: { currentRate: number; overtimeMultiplier: number; effectiveDate: Date }): Promise<SelectCrew> { return dbCrewStorage.updateCrewRate(crewId, updateData); }
  async getExpenses(orgId?: string): Promise<Expense[]> { return dbAnalyticsStorage.getExpenses(orgId); }
  async createExpense(expense: InsertExpense): Promise<Expense> { return dbAnalyticsStorage.createExpense(expense); }
  async updateExpenseStatus(expenseId: string, status: "pending" | "approved" | "rejected"): Promise<Expense> { return dbAnalyticsStorage.updateExpenseStatus(expenseId, status); }
  async getCostSummaryByEquipment(equipmentId?: string, months?: number): Promise<{ equipmentId: string; totalCost: number; costByType: Record<string, number> }[]> { return dbAnalyticsStorage.getCostSummaryByEquipment(equipmentId, months); }
  async getCostTrends(months?: number): Promise<{ month: string; totalCost: number; costByType: Record<string, number> }[]> { return dbAnalyticsStorage.getCostTrends(months); }
  async getEquipmentLifecycle(equipmentId?: string): Promise<EquipmentLifecycle[]> { return dbAnalyticsStorage.getEquipmentLifecycle(equipmentId); }
  async upsertEquipmentLifecycle(lifecycle: InsertEquipmentLifecycle): Promise<EquipmentLifecycle> { return dbAnalyticsStorage.upsertEquipmentLifecycle(lifecycle); }
  async updateEquipmentLifecycle(id: string, updates: Partial<InsertEquipmentLifecycle>): Promise<EquipmentLifecycle> { return dbAnalyticsStorage.updateEquipmentLifecycle(id, updates); }
  async getReplacementRecommendations(): Promise<EquipmentLifecycle[]> { return dbAnalyticsStorage.getReplacementRecommendations(); }
  async getPerformanceMetrics(equipmentId?: string, dateFrom?: Date, dateTo?: Date): Promise<PerformanceMetric[]> { return dbAnalyticsStorage.getPerformanceMetrics(equipmentId, dateFrom, dateTo); }
  async createPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> { return dbAnalyticsStorage.createPerformanceMetric(metric); }
  async getFleetPerformanceOverview(): Promise<{ equipmentId: string; averageScore: number; reliability: number; availability: number; efficiency: number }[]> { return dbAnalyticsStorage.getFleetPerformanceOverview(); }
  async getPerformanceTrends(equipmentId: string, months?: number): Promise<{ month: string; performanceScore: number; availability: number; efficiency: number }[]> { return dbAnalyticsStorage.getPerformanceTrends(equipmentId, months); }

  // Deck Log methods - delegated to deckLogAdapter
  async getDeckLogDaily(orgId: string, filters?: { vesselId?: string; startDate?: string; endDate?: string; status?: string }): Promise<DeckLogDaily[]> { return this.deckLogAdapter.getDeckLogDaily(orgId, filters); }
  async getDeckLogDailyById(id: string, orgId: string): Promise<DeckLogDaily | undefined> { return this.deckLogAdapter.getDeckLogDailyById(id, orgId); }
  async getDeckLogDailyByDate(vesselId: string, logDate: string, orgId: string): Promise<DeckLogDaily | undefined> { return this.deckLogAdapter.getDeckLogDailyByDate(vesselId, logDate, orgId); }
  async createDeckLogDaily(entry: InsertDeckLogDaily): Promise<DeckLogDaily> { return this.deckLogAdapter.createDeckLogDaily(entry); }
  async updateDeckLogDaily(id: string, entry: Partial<InsertDeckLogDaily>, orgId: string): Promise<DeckLogDaily> { return this.deckLogAdapter.updateDeckLogDaily(id, entry, orgId); }
  async deleteDeckLogDaily(id: string, orgId: string): Promise<void> { return this.deckLogAdapter.deleteDeckLogDaily(id, orgId); }
  async signDeckLogDaily(id: string, signData: { signedByCrewId: string; signedByName: string; signedByRank: string }, orgId: string): Promise<DeckLogDaily> { return this.deckLogAdapter.signDeckLogDaily(id, signData, orgId); }
  async getDeckLogHourly(dailyLogId: string, orgId: string): Promise<DeckLogHourly[]> { return this.deckLogAdapter.getDeckLogHourly(dailyLogId, orgId); }
  async getDeckLogHourlyByHour(dailyLogId: string, hour: number, orgId: string): Promise<DeckLogHourly | undefined> { return this.deckLogAdapter.getDeckLogHourlyByHour(dailyLogId, hour, orgId); }
  async upsertDeckLogHourly(entry: InsertDeckLogHourly): Promise<DeckLogHourly> { return this.deckLogAdapter.upsertDeckLogHourly(entry); }
  async bulkUpsertDeckLogHourly(entries: InsertDeckLogHourly[]): Promise<DeckLogHourly[]> { return this.deckLogAdapter.bulkUpsertDeckLogHourly(entries); }
  async deleteDeckLogHourly(id: string, orgId: string): Promise<void> { return this.deckLogAdapter.deleteDeckLogHourly(id, orgId); }
  async getDeckLogWatch(dailyLogId: string, orgId: string): Promise<DeckLogWatch[]> { return this.deckLogAdapter.getDeckLogWatch(dailyLogId, orgId); }
  async getDeckLogWatchByPeriod(dailyLogId: string, watchPeriod: string, orgId: string): Promise<DeckLogWatch | undefined> { return this.deckLogAdapter.getDeckLogWatchByPeriod(dailyLogId, watchPeriod, orgId); }
  async upsertDeckLogWatch(entry: InsertDeckLogWatch): Promise<DeckLogWatch> { return this.deckLogAdapter.upsertDeckLogWatch(entry); }
  async deleteDeckLogWatch(id: string, orgId: string): Promise<void> { return this.deckLogAdapter.deleteDeckLogWatch(id, orgId); }
  async getDeckLogComplete(dailyLogId: string, orgId: string): Promise<{ daily: DeckLogDaily; hourly: DeckLogHourly[]; watches: DeckLogWatch[] } | undefined> { return this.deckLogAdapter.getDeckLogComplete(dailyLogId, orgId); }
  async getDeckLogEvents(dayId: string, orgId: string, filters?: { eventType?: string; source?: string; startTime?: Date; endTime?: Date }): Promise<DeckLogEvent[]> { return this.deckLogAdapter.getDeckLogEvents(dayId, orgId, filters); }
  async getDeckLogEventById(id: string, orgId: string): Promise<DeckLogEvent | undefined> { return this.deckLogAdapter.getDeckLogEventById(id, orgId); }
  async getDeckLogEventByIdempotencyKey(key: string, orgId: string): Promise<DeckLogEvent | undefined> { return this.deckLogAdapter.getDeckLogEventByIdempotencyKey(key, orgId); }
  async createDeckLogEvent(event: InsertDeckLogEvent): Promise<DeckLogEvent> { return this.deckLogAdapter.createDeckLogEvent(event); }
  async updateDeckLogEvent(id: string, event: Partial<InsertDeckLogEvent>, orgId: string): Promise<DeckLogEvent> { return this.deckLogAdapter.updateDeckLogEvent(id, event, orgId); }
  async deleteDeckLogEvent(id: string, orgId: string): Promise<void> { return this.deckLogAdapter.deleteDeckLogEvent(id, orgId); }
  async lockDeckLogDaily(id: string, lockData: { lockedByUserId: string; lockedByUserName: string }, orgId: string): Promise<DeckLogDaily> { return this.deckLogAdapter.lockDeckLogDaily(id, lockData, orgId); }
  async unlockDeckLogDaily(id: string, orgId: string): Promise<DeckLogDaily> { return this.deckLogAdapter.unlockDeckLogDaily(id, orgId); }

  // Engine Log methods - delegated to engineLogAdapter
  async getEngineLogDaily(orgId: string, filters?: { vesselId?: string; startDate?: string; endDate?: string; status?: string }): Promise<EngineLogDaily[]> { return this.engineLogAdapter.getEngineLogDaily(orgId, filters); }
  async getEngineLogDailyById(id: string, orgId: string): Promise<EngineLogDaily | undefined> { return this.engineLogAdapter.getEngineLogDailyById(id, orgId); }
  async createEngineLogDaily(entry: InsertEngineLogDaily): Promise<EngineLogDaily> { return this.engineLogAdapter.createEngineLogDaily(entry); }
  async updateEngineLogDaily(id: string, entry: Partial<InsertEngineLogDaily>, orgId: string): Promise<EngineLogDaily> { return this.engineLogAdapter.updateEngineLogDaily(id, entry, orgId); }
  async deleteEngineLogDaily(id: string, orgId: string): Promise<void> { return this.engineLogAdapter.deleteEngineLogDaily(id, orgId); }
  async getEngineLogHourly(dailyLogId: string, orgId: string): Promise<EngineLogHourly[]> { return this.engineLogAdapter.getEngineLogHourly(dailyLogId, orgId); }
  async upsertEngineLogHourly(entry: InsertEngineLogHourly): Promise<EngineLogHourly> { return this.engineLogAdapter.upsertEngineLogHourly(entry); }
  async getEngineLogGenerator(dailyLogId: string, orgId: string): Promise<EngineLogGenerator[]> { return this.engineLogAdapter.getEngineLogGenerator(dailyLogId, orgId); }
  async upsertEngineLogGenerator(entry: InsertEngineLogGenerator): Promise<EngineLogGenerator> { return this.engineLogAdapter.upsertEngineLogGenerator(entry); }
  async getEngineLogWatch(dailyLogId: string, orgId: string): Promise<EngineLogWatch[]> { return this.engineLogAdapter.getEngineLogWatch(dailyLogId, orgId); }
  async upsertEngineLogWatch(entry: InsertEngineLogWatch): Promise<EngineLogWatch> { return this.engineLogAdapter.upsertEngineLogWatch(entry); }
  async getEngineLogEvents(dayId: string, orgId: string, filters?: { eventType?: string; source?: string; startTime?: Date; endTime?: Date }): Promise<EngineLogEvent[]> { return this.engineLogAdapter.getEngineLogEvents(dayId, orgId, filters); }
  async createEngineLogEvent(event: InsertEngineLogEvent): Promise<EngineLogEvent> { return this.engineLogAdapter.createEngineLogEvent(event); }
  async updateEngineLogEvent(id: string, event: Partial<InsertEngineLogEvent>, orgId: string): Promise<EngineLogEvent> { return this.engineLogAdapter.updateEngineLogEvent(id, event, orgId); }
  async deleteEngineLogEvent(id: string, orgId: string): Promise<void> { return this.engineLogAdapter.deleteEngineLogEvent(id, orgId); }

  // StormGeo - delegated to dbStormGeoStorage
  async getStormgeoSettings(orgId: string, vesselId?: string): Promise<StormgeoSetting | undefined> { return dbStormGeoStorage.getStormgeoSettings(orgId, vesselId); }
  async createStormgeoSettings(settings: InsertStormgeoSetting): Promise<StormgeoSetting> { return dbStormGeoStorage.createStormgeoSettings(settings); }
  async updateStormgeoSettings(id: string, settings: Partial<InsertStormgeoSetting>, orgId: string): Promise<StormgeoSetting> { return dbStormGeoStorage.updateStormgeoSettings(id, settings, orgId); }
  async deleteStormgeoSettings(id: string, orgId: string): Promise<void> { return dbStormGeoStorage.deleteStormgeoSettings(id, orgId); }
  async getStormgeoSnapshots(orgId: string, filters?: { vesselId?: string; snapshotType?: string; routeId?: string; forecastTimeStart?: Date; forecastTimeEnd?: Date }): Promise<StormgeoSnapshot[]> { return dbStormGeoStorage.getStormgeoSnapshots(orgId, filters); }
  async getStormgeoSnapshotById(id: string, orgId: string): Promise<StormgeoSnapshot | undefined> { return dbStormGeoStorage.getStormgeoSnapshotById(id, orgId); }
  async getStormgeoSnapshotForTime(vesselId: string, forecastTime: Date, orgId: string): Promise<StormgeoSnapshot | undefined> { return dbStormGeoStorage.getStormgeoSnapshotForTime(vesselId, forecastTime, orgId); }
  async createStormgeoSnapshot(snapshot: InsertStormgeoSnapshot): Promise<StormgeoSnapshot> { return dbStormGeoStorage.createStormgeoSnapshot(snapshot); }
  async bulkCreateStormgeoSnapshots(snapshots: InsertStormgeoSnapshot[]): Promise<StormgeoSnapshot[]> { return dbStormGeoStorage.bulkCreateStormgeoSnapshots(snapshots); }
  async deleteStormgeoSnapshot(id: string, orgId: string): Promise<void> { return dbStormGeoStorage.deleteStormgeoSnapshot(id, orgId); }
  async deleteStormgeoSnapshotsByRoute(routeId: string, orgId: string): Promise<void> { return dbStormGeoStorage.deleteStormgeoSnapshotsByRoute(routeId, orgId); }
  async getDeckLogHourlyAutoFill(hourlyLogId: string): Promise<DeckLogHourlyAutoFill | undefined> { return dbStormGeoStorage.getDeckLogHourlyAutoFill(hourlyLogId); }
  async createDeckLogHourlyAutoFill(autoFill: InsertDeckLogHourlyAutoFill): Promise<DeckLogHourlyAutoFill> { return dbStormGeoStorage.createDeckLogHourlyAutoFill(autoFill); }
  async updateDeckLogHourlyAutoFill(id: string, autoFill: Partial<InsertDeckLogHourlyAutoFill>): Promise<DeckLogHourlyAutoFill> { return dbStormGeoStorage.updateDeckLogHourlyAutoFill(id, autoFill); }
  async markAutoFillOverridden(hourlyLogId: string, overriddenFields: string[], userId: string, userName: string): Promise<DeckLogHourlyAutoFill> { return dbStormGeoStorage.markAutoFillOverridden(hourlyLogId, overriddenFields, userId, userName); }
  async getStormgeoImportHistory(orgId: string, filters?: { vesselId?: string; status?: string; limit?: number }): Promise<StormgeoImportHistory[]> { return dbStormGeoStorage.getStormgeoImportHistory(orgId, filters); }
  async getStormgeoImportHistoryById(id: string, orgId: string): Promise<StormgeoImportHistory | undefined> { return dbStormGeoStorage.getStormgeoImportHistoryById(id, orgId); }
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
  async getExpiringCertifications(orgId: string, daysAhead: number): Promise<{ type: "certification"; id: string; crewId: string; crewName: string; name: string; expiryDate: Date; daysRemaining: number }[]> { return dbCrewExtensionsStorage.getExpiringCertifications(orgId, daysAhead); }
  async getExpiringDocuments(orgId: string, daysAhead: number): Promise<{ type: "document"; id: string; crewId: string; crewName: string; name: string; expiryDate: Date; daysRemaining: number }[]> { return dbCrewExtensionsStorage.getExpiringDocuments(orgId, daysAhead); }
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
  async getThresholdOptimizations(orgId: string, equipmentId?: string, sensorType?: string): Promise<ThresholdOptimization[]> { return dbMlAnalyticsStorage.getThresholdOptimizations(orgId, equipmentId, sensorType); }
  async getThresholdOptimization(id: number, orgId: string): Promise<ThresholdOptimization | undefined> { return dbMlAnalyticsStorage.getThresholdOptimization(id, orgId); }

  // Hub Sync - delegated to dbHubSyncStorage
  async getDeviceRegistry(deviceId: string, orgId: string): Promise<SelectDeviceRegistry | undefined> { return dbHubSyncStorage.getDeviceRegistry(deviceId, orgId); }
  async upsertDeviceRegistry(data: InsertDeviceRegistry): Promise<SelectDeviceRegistry> { return dbHubSyncStorage.upsertDeviceRegistry(data); }
  async getReplayRequests(deviceId: string, status?: string): Promise<SelectReplayIncoming[]> { return dbHubSyncStorage.getReplayRequests(deviceId, status); }
  async createReplayRequest(data: InsertReplayIncoming): Promise<SelectReplayIncoming> { return dbHubSyncStorage.createReplayRequest(data); }
  async updateReplayRequest(id: string, updates: Partial<InsertReplayIncoming>): Promise<SelectReplayIncoming> { return dbHubSyncStorage.updateReplayRequest(id, updates); }
  async getSheetLock(sheetType: string, sheetId: string): Promise<SelectSheetLock | undefined> { return dbHubSyncStorage.getSheetLock(sheetType, sheetId); }
  async acquireSheetLock(data: InsertSheetLock): Promise<SelectSheetLock> { return dbHubSyncStorage.acquireSheetLock(data); }
  async releaseSheetLock(sheetType: string, sheetId: string): Promise<void> { return dbHubSyncStorage.releaseSheetLock(sheetType, sheetId); }
  async getSheetVersion(sheetType: string, sheetId: string): Promise<SelectSheetVersion | undefined> { return dbHubSyncStorage.getSheetVersion(sheetType, sheetId); }
  async incrementSheetVersion(data: InsertSheetVersion): Promise<SelectSheetVersion> { return dbHubSyncStorage.incrementSheetVersion(data); }

  // Vessels - delegated to vesselService
  async getVessels(orgId?: string): Promise<SelectVessel[]> { return vesselService.getVessels(orgId); }
  async getVessel(id: string, orgId?: string): Promise<SelectVessel | undefined> { return vesselService.getVessel(id, orgId); }
  async getVesselByName(name: string, orgId?: string): Promise<SelectVessel | undefined> { return vesselService.getVesselByName(name, orgId); }
  async createVessel(vessel: InsertVessel): Promise<SelectVessel> { return vesselService.createVessel(vessel); }
  async updateVessel(id: string, updates: Partial<InsertVessel>, orgId: string): Promise<SelectVessel> { return vesselService.updateVessel(id, updates, orgId); }
  async deleteVessel(id: string, deleteEquipment?: boolean, orgId?: string): Promise<void> { return vesselService.deleteVessel(id, orgId); }

  // Port calls & drydock windows - delegated to dbVesselStorage
  async getPortCalls(vesselId?: string, orgId?: string): Promise<SelectPortCall[]> { return dbVesselStorage.getPortCalls(vesselId, orgId); }
  async createPortCall(data: InsertPortCall): Promise<SelectPortCall> { return dbVesselStorage.createPortCall(data); }
  async updatePortCall(id: string, updates: Partial<InsertPortCall>, orgId: string): Promise<SelectPortCall> { return dbVesselStorage.updatePortCall(id, updates, orgId); }
  async deletePortCall(id: string, orgId: string): Promise<void> { return dbVesselStorage.deletePortCall(id, orgId); }
  async getDrydockWindows(orgId?: string, vesselId?: string): Promise<SelectDrydockWindow[]> { return dbVesselStorage.getDrydockWindows(orgId, vesselId); }
  async createDrydockWindow(data: InsertDrydockWindow): Promise<SelectDrydockWindow> { return dbVesselStorage.createDrydockWindow(data); }
  async updateDrydockWindow(id: string, updates: Partial<InsertDrydockWindow>, orgId: string): Promise<SelectDrydockWindow> { return dbVesselStorage.updateDrydockWindow(id, updates, orgId); }
  async deleteDrydockWindow(id: string, orgId: string): Promise<void> { return dbVesselStorage.deleteDrydockWindow(id, orgId); }

  // Shift templates and crew assignments - delegated to dbCrewStorage
  async getShiftTemplates(orgId?: string): Promise<SelectShiftTemplate[]> { return dbCrewStorage.getShiftTemplates(orgId); }
  async createShiftTemplate(data: InsertShiftTemplate): Promise<SelectShiftTemplate> { return dbCrewStorage.createShiftTemplate(data); }
  async updateShiftTemplate(id: string, updates: Partial<InsertShiftTemplate>, orgId: string): Promise<SelectShiftTemplate> { return dbCrewStorage.updateShiftTemplate(id, updates, orgId); }
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
  async getInsightSnapshots(orgId: string, filters?: { vesselId?: string; equipmentId?: string; snapshotType?: string; startDate?: Date; endDate?: Date }): Promise<InsightSnapshot[]> { return this.analyticsAdapter.getInsightSnapshots(orgId, filters); }
  async getInsightSnapshot(id: string, orgId: string): Promise<InsightSnapshot | undefined> { return this.analyticsAdapter.getInsightSnapshot(id, orgId); }
  async createInsightSnapshot(snapshot: InsertInsightSnapshot): Promise<InsightSnapshot> { return this.analyticsAdapter.createInsightSnapshot(snapshot); }
  async updateInsightSnapshot(id: string, updates: Partial<InsertInsightSnapshot>, orgId: string): Promise<InsightSnapshot> { return this.analyticsAdapter.updateInsightSnapshot(id, updates, orgId); }
  async deleteInsightSnapshot(id: string, orgId: string): Promise<void> { return this.analyticsAdapter.deleteInsightSnapshot(id, orgId); }
  async getInsightReports(orgId: string, filters?: { vesselId?: string; reportType?: string; status?: string; startDate?: Date; endDate?: Date }): Promise<InsightReport[]> { return this.analyticsAdapter.getInsightReports(orgId, filters); }
  async getInsightReport(id: string, orgId: string): Promise<InsightReport | undefined> { return this.analyticsAdapter.getInsightReport(id, orgId); }
  async createInsightReport(report: InsertInsightReport): Promise<InsightReport> { return this.analyticsAdapter.createInsightReport(report); }
  async updateInsightReport(id: string, updates: Partial<InsertInsightReport>, orgId: string): Promise<InsightReport> { return this.analyticsAdapter.updateInsightReport(id, updates, orgId); }
  async deleteInsightReport(id: string, orgId: string): Promise<void> { return this.analyticsAdapter.deleteInsightReport(id, orgId); }

  // Admin sessions & audit - delegated to dbSystemAdminStorage
  async getAdminSessions(orgId?: string): Promise<AdminSession[]> { return dbSystemAdminStorage.getAdminSessions(orgId); }
  async createAdminSession(session: InsertAdminSession): Promise<AdminSession> { return dbSystemAdminStorage.createAdminSession(session); }
  async updateAdminSession(id: string, updates: Partial<InsertAdminSession>): Promise<AdminSession> { return dbSystemAdminStorage.updateAdminSession(id, updates); }
  async deleteAdminSession(id: string): Promise<void> { return dbSystemAdminStorage.deleteAdminSession(id); }
  async getAdminSessionByToken(tokenHash: string): Promise<AdminSession | undefined> { return dbSystemAdminStorage.getAdminSessionByToken(tokenHash); }
  async updateAdminSessionActivity(sessionId: string): Promise<void> { return dbSystemAdminStorage.updateAdminSessionActivity(sessionId); }
  async invalidateAllAdminSessions(): Promise<void> { return dbSystemAdminStorage.invalidateAllAdminSessions(); }
  async getAdminAuditEvents(orgId?: string, filters?: { action?: string; entityType?: string; startDate?: Date; endDate?: Date }): Promise<AdminAuditEvent[]> { return dbSystemAdminStorage.getAdminAuditEvents(orgId, filters); }
  async createAdminAuditEvent(event: InsertAdminAuditEvent): Promise<AdminAuditEvent> { return dbSystemAdminStorage.createAdminAuditEvent(event); }
  async updateAdminAuditEvent(id: string, updates: Partial<Pick<AdminAuditEvent, "outcome" | "severity" | "details">>): Promise<AdminAuditEvent> { return dbSystemAdminStorage.updateAdminAuditEvent(id, updates); }

  // Admin system settings - delegated to dbSystemAdminStorage
  async getAdminSystemSettings(orgId?: string, category?: string): Promise<any[]> { return dbSystemAdminStorage.getAdminSystemSettings(orgId, category); }
  async getAdminSystemSetting(orgId: string, category: string, key: string): Promise<any> { return dbSystemAdminStorage.getAdminSystemSetting(orgId, category, key); }
  async createAdminSystemSetting(setting: any): Promise<any> { return dbSystemAdminStorage.createAdminSystemSetting(setting); }
  async updateAdminSystemSetting(id: string, setting: any): Promise<any> { return dbSystemAdminStorage.updateAdminSystemSetting(id, setting); }
  async deleteAdminSystemSetting(id: string): Promise<void> { return dbSystemAdminStorage.deleteAdminSystemSetting(id); }
  async getIntegrationConfigs(orgId?: string, type?: string): Promise<any[]> { return dbSystemAdminStorage.getIntegrationConfigs(orgId, type); }
  async getIntegrationConfig(id: string, orgId?: string): Promise<any> { return dbSystemAdminStorage.getIntegrationConfig(id, orgId); }
  async createIntegrationConfig(config: any): Promise<any> { return dbSystemAdminStorage.createIntegrationConfig(config); }
  async updateIntegrationConfig(id: string, config: any): Promise<any> { return dbSystemAdminStorage.updateIntegrationConfig(id, config); }
  async deleteIntegrationConfig(id: string): Promise<void> { return dbSystemAdminStorage.deleteIntegrationConfig(id); }
  async updateIntegrationHealth(id: string, healthStatus: string, errorMessage?: string): Promise<any> { return dbSystemAdminStorage.updateIntegrationHealth(id, healthStatus, errorMessage); }
  async getMaintenanceWindows(orgId?: string, status?: string): Promise<any[]> { return dbSystemAdminStorage.getMaintenanceWindows(orgId, status); }
  async getMaintenanceWindow(id: string, orgId?: string): Promise<any> { return dbSystemAdminStorage.getMaintenanceWindow(id, orgId); }
  async createMaintenanceWindow(window: any): Promise<any> { return dbSystemAdminStorage.createMaintenanceWindow(window); }
  async updateMaintenanceWindow(id: string, window: any): Promise<any> { return dbSystemAdminStorage.updateMaintenanceWindow(id, window); }
  async deleteMaintenanceWindow(id: string): Promise<void> { return dbSystemAdminStorage.deleteMaintenanceWindow(id); }
  async getActiveMaintenanceWindows(orgId?: string): Promise<any[]> { return dbSystemAdminStorage.getActiveMaintenanceWindows(orgId); }
  async getSystemHealthChecks(orgId?: string, category?: string): Promise<any[]> { return dbSystemAdminStorage.getSystemHealthChecks(orgId, category); }
  async getSystemHealthCheck(id: string, orgId?: string): Promise<any> { return dbSystemAdminStorage.getSystemHealthCheck(id, orgId); }
  async createSystemHealthCheck(check: any): Promise<any> { return dbSystemAdminStorage.createSystemHealthCheck(check); }
  async updateSystemHealthCheck(id: string, check: any, orgId: string): Promise<any> { return dbSystemAdminStorage.updateSystemHealthCheck(id, check, orgId); }
  async deleteSystemHealthCheck(id: string, orgId: string): Promise<void> { return dbSystemAdminStorage.deleteSystemHealthCheck(id, orgId); }
  async updateHealthCheckStatus(id: string, status: string, orgId: string, message?: string, responseTime?: number): Promise<any> { return dbSystemAdminStorage.updateHealthCheckStatus(id, status, orgId, message, responseTime); }
  async getFailingHealthChecks(orgId?: string): Promise<any[]> { return dbSystemAdminStorage.getFailingHealthChecks(orgId); }
  async getMetricTrends(orgId: string, metricName: string, hours: number): Promise<any[]> { return dbSystemAdminStorage.getMetricTrends(orgId, metricName, hours); }
  async getSystemHealth(orgId?: string): Promise<any> { return dbSystemAdminStorage.getSystemHealth(orgId); }

  // ML Models - delegated to dbMlAnalyticsStorage
  async getMlModels(orgId?: string, modelType?: string): Promise<MlModel[]> { return dbMlAnalyticsStorage.getMlModels(orgId, modelType); }
  async getMlModel(id: string): Promise<MlModel | undefined> { return dbMlAnalyticsStorage.getMlModel(id); }
  async createMlModel(model: InsertMlModel): Promise<MlModel> { return dbMlAnalyticsStorage.createMlModel(model); }
  async updateMlModel(id: string, updates: Partial<InsertMlModel>): Promise<MlModel> { return dbMlAnalyticsStorage.updateMlModel(id, updates); }
  async deleteMlModel(id: string): Promise<void> { return dbMlAnalyticsStorage.deleteMlModel(id); }
  async getMlModelAccuracyHistory(modelId: string): Promise<MlModelAccuracyHistory[]> { return dbMlAnalyticsStorage.getMlModelAccuracyHistory(modelId); }
  async createMlModelAccuracyHistory(history: InsertMlModelAccuracyHistory): Promise<MlModelAccuracyHistory> { return dbMlAnalyticsStorage.createMlModelAccuracyHistory(history); }
  async getEngineerOverrides(orgId: string, filters?: { equipmentId?: string; engineerId?: string; overrideType?: string; outcomeStatus?: string; fromDate?: Date; toDate?: Date }): Promise<EngineerOverride[]> { return dbMlAnalyticsStorage.getEngineerOverrides(orgId, filters); }
  async createEngineerOverride(override: InsertEngineerOverride, orgId: string): Promise<EngineerOverride> { return dbMlAnalyticsStorage.createEngineerOverride(override, orgId); }
  async updateEngineerOverride(id: string, updates: Partial<InsertEngineerOverride>, orgId: string): Promise<EngineerOverride> { return dbMlAnalyticsStorage.updateEngineerOverride(id, updates, orgId); }
  async deleteEngineerOverride(id: string, orgId: string): Promise<void> { return dbMlAnalyticsStorage.deleteEngineerOverride(id, orgId); }
  async expireEngineerOverride(id: string, expiredBy: string, orgId: string): Promise<EngineerOverride> { return dbMlAnalyticsStorage.expireEngineerOverride(id, expiredBy, orgId); }

  // Equipment - delegated to dbEquipmentStorage
  async getEquipmentRegistry(orgId?: string): Promise<any[]> { return dbEquipmentStorage.getEquipmentRegistry(orgId); }
  async getEquipment(orgId: string, equipmentId: string): Promise<any | undefined> { return dbEquipmentStorage.getEquipment(orgId, equipmentId); }
  async getEquipmentHealth(orgId: string, vesselId?: string, equipmentId?: string): Promise<any[]> { return dbEquipmentStorage.getEquipmentHealth(orgId, { vesselId, equipmentId }); }
  async registerEquipment(data: any): Promise<any> { return dbEquipmentStorage.registerEquipment(data); }
  async updateEquipmentRegistry(id: string, updates: any, orgId: string): Promise<any> { return dbEquipmentStorage.updateEquipmentRegistry(id, updates, orgId); }
  async deleteEquipmentFromRegistry(id: string, orgId: string): Promise<void> { return dbEquipmentStorage.deleteEquipment(id, orgId); }
  async deleteEquipment(id: string, orgId?: string): Promise<void> { return dbEquipmentStorage.deleteEquipment(id, orgId); }

  // Users & Organizations - delegated to dbUserStorage
  async getOrganizations(): Promise<Organization[]> { return dbUserStorage.getOrganizations(); }
  async getOrganization(id: string): Promise<Organization | undefined> { return dbUserStorage.getOrganization(id); }
  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> { return dbUserStorage.getOrganizationBySlug(slug); }
  async createOrganization(org: InsertOrganization): Promise<Organization> { return dbUserStorage.createOrganization(org); }
  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> { return dbUserStorage.updateOrganization(id, updates); }
  async deleteOrganization(id: string): Promise<void> { return dbUserStorage.deleteOrganization(id); }
  async getUsers(orgId?: string): Promise<User[]> { return dbUserStorage.getUsers(orgId); }
  async getUser(id: string): Promise<User | undefined> { return dbUserStorage.getUser(id); }
  async getUserByEmail(email: string, orgId?: string): Promise<User | undefined> { return dbUserStorage.getUserByEmail(email, orgId); }
  async createUser(user: InsertUser): Promise<User> { return dbUserStorage.createUser(user); }
  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> { return dbUserStorage.updateUser(id, updates); }
  async deleteUser(id: string): Promise<void> { return dbUserStorage.deleteUser(id); }

  // Additional delegated methods for remaining functionality
  async getOptimizations(orgId: string): Promise<any[]> { return dbOptimizerStorage.getOptimizations(orgId); }
  async createOptimization(data: any): Promise<any> { return dbOptimizerStorage.createOptimization(data); }

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

  async getActiveDtcsBatch(equipmentIds: string[], orgId?: string): Promise<any[]> {
    return dbDtcStorage.getActiveDtcsBatch(equipmentIds, orgId);
  }

  // Transport Settings - stub implementations (no database table yet)
  async getTransportSettings(): Promise<any | undefined> {
    return undefined;
  }

  async createTransportSettings(settings: any): Promise<any> {
    return { id: `ts-${Date.now()}`, ...settings, createdAt: new Date() };
  }

  async updateTransportSettings(id: string, settings: any): Promise<any> {
    return { id, ...settings, updatedAt: new Date() };
  }

  // Error Logs
  async getErrorLogs(filters?: { orgId?: string; level?: string; source?: string; dateFrom?: Date; dateTo?: Date; limit?: number }): Promise<ErrorLog[]> {
    const conditions: any[] = [];
    if (filters?.orgId) conditions.push(eq(errorLogs.orgId, filters.orgId));
    if (filters?.level) conditions.push(eq(errorLogs.severity, filters.level));
    if (filters?.source) conditions.push(eq(errorLogs.category, filters.source));
    
    let query = db.select().from(errorLogs);
    if (conditions.length > 0) query = query.where(and(...conditions));
    query = query.orderBy(sql`${errorLogs.timestamp} DESC`);
    if (filters?.limit) query = query.limit(filters.limit);
    
    return query;
  }

  async createErrorLog(log: InsertErrorLog): Promise<ErrorLog> {
    const [newLog] = await db.insert(errorLogs).values({
      ...log,
      orgId: log.orgId || "default-org-id",
      timestamp: new Date(),
    }).returning();
    return newLog;
  }

  async deleteErrorLog(id: string): Promise<void> {
    await db.delete(errorLogs).where(eq(errorLogs.id, id));
  }

  async clearErrorLogs(olderThan?: Date): Promise<void> {
    if (olderThan) {
      await db.delete(errorLogs).where(sql`${errorLogs.timestamp} < ${olderThan}`);
    } else {
      await db.delete(errorLogs);
    }
  }

  [key: string]: any;
}
