import { db, isLocalMode } from "./db-config";
import { devices, alertConfigurations, idempotencyLog, skills } from "@shared/schema-runtime";
import { eq, and, sql } from "drizzle-orm";

export type { WorkOrderFilters, IStorage } from "./storage/interfaces/storage.types";

import {
  dbDevicesStorage, dbWorkOrderStorage, dbEquipmentStorage, dbVesselStorage,
  dbAlertStorage, dbInventoryStorage, dbCrewStorage, dbCrewExtensionsStorage,
  dbSensorsStorage, dbTelemetryStorage, dbMlAnalyticsStorage, dbMaintenanceStorage,
  dbMaintenanceTemplatesStorage, dbAnalyticsStorage, dbSystemAdminStorage,
  dbDtcStorage, dbNotificationsStorage, dbChecklistsStorage, dbStcwStorage,
  dbUserStorage, dbOptimizerStorage, dbHubSyncStorage, dbStormGeoStorage,
  dbSchedulerStorage, workOrderService, vesselService, crewService,
  deckLogStorage, engineLogStorage, analyticsInsightsAdapter, schedulingAdapter,
} from "./repositories";

function createStorageFacade() {
  return {
    validateOrgId(orgId: string | undefined, operation: string): asserts orgId is string {
      if (!orgId || orgId.trim() === "") { throw new Error(`[Security] orgId is required for ${operation}. This is a critical multi-tenant isolation error.`); }
    },

    getDevices: (orgId?: string) => dbDevicesStorage.getDevices(orgId),
    getDevice: (id: string, orgId?: string) => dbDevicesStorage.getDevice(id, orgId),
    createDevice: (device: any) => dbDevicesStorage.createDevice(device),
    updateDevice: (id: string, updates: any, orgId: string) => dbDevicesStorage.updateDevice(id, updates, orgId),
    deleteDevice: (id: string, orgId: string) => dbDevicesStorage.deleteDevice(id, orgId),
    getHeartbeats: () => dbDevicesStorage.getHeartbeatsByOrg(),
    getHeartbeat: (deviceId: string) => dbDevicesStorage.getHeartbeat(deviceId),
    upsertHeartbeat: (heartbeat: any) => dbDevicesStorage.upsertHeartbeat(heartbeat),
    getPdmScores: (equipmentId: string | undefined, orgId: string) => dbDevicesStorage.getPdmScores(equipmentId, orgId),
    createPdmScore: (score: any) => dbDevicesStorage.createPdmScore(score),
    getLatestPdmScore: (equipmentId: string) => dbDevicesStorage.getLatestPdmScore(equipmentId),
    getDevicesWithStatus: (orgId?: string) => dbDevicesStorage.getDevicesWithStatus(orgId),

    getWorkOrders: (equipmentId?: string, orgId?: string, filters?: any) => workOrderService.getWorkOrdersWithDetails(equipmentId, orgId, filters),
    getWorkOrdersPaginated: (equipmentId: string | undefined, orgId: string | undefined, limit: number, offset: number, filters?: any) => workOrderService.getWorkOrdersPaginated(equipmentId, orgId, limit, offset, filters),
    getWorkOrderById: (id: string, orgId: string) => workOrderService.getWorkOrderById(id, orgId),
    generateWorkOrderNumber: (orgId: string) => workOrderService.generateWorkOrderNumber(orgId),
    createWorkOrder: (order: any) => workOrderService.createWorkOrder(order),
    updateWorkOrder: (id: string, updates: any) => workOrderService.updateWorkOrderWithDowntimeTracking(id, updates),
    closeWorkOrder: (id: string, closeData: any) => workOrderService.closeWorkOrder(id, closeData),
    deleteWorkOrder: (id: string) => workOrderService.deleteWorkOrderCascade(id),
    cloneWorkOrder: (id: string, orgId: string, options?: any) => workOrderService.cloneWorkOrder(id, orgId, options),
    completeWorkOrder: (workOrderId: string, completionData: any) => workOrderService.completeWorkOrder(workOrderId, completionData),
    getWorkOrderCompletionAnalytics: (filters?: any) => workOrderService.getWorkOrderCompletionAnalytics(filters),
    createWorkOrderCompletion: (completion: any) => dbWorkOrderStorage.createWorkOrderCompletion(completion),
    getWorkOrderCompletions: (filters?: any) => dbWorkOrderStorage.getWorkOrderCompletions(filters),
    getWorkOrderCompletion: (id: string) => dbWorkOrderStorage.getWorkOrderCompletion(id),
    getWorkOrderCompletionsByWorkOrder: (workOrderId: string) => dbWorkOrderStorage.getWorkOrderCompletionsByWorkOrder(workOrderId),

    getTelemetryTrends: (equipmentId?: string, hours?: number) => dbTelemetryStorage.getTelemetryTrends(equipmentId, hours || 24),
    createTelemetryReading: (reading: any) => dbTelemetryStorage.createTelemetryReading(reading),
    getTelemetryHistory: (arg1: string, arg2: string, arg3?: any, arg4?: any, arg5?: any) => dbTelemetryStorage.getTelemetryHistory(arg1, arg2, arg3, arg4, arg5),
    getTelemetryByEquipmentAndDateRange: (equipmentId: string, startDate: Date, endDate: Date, orgId?: string) => dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(equipmentId, startDate, endDate, orgId),
    getLatestTelemetryReadings: (vesselId?: string, equipmentId?: string, sensorType?: string, limit?: number, orgId?: string) => dbTelemetryStorage.getLatestTelemetryReadings(vesselId, equipmentId, sensorType, limit || 500, orgId),
    upsertTelemetry: (reading: any) => dbTelemetryStorage.createTelemetryReading(reading),
    getTelemetry: (eqId: string, orgId?: string) => dbTelemetryStorage.getLatestTelemetryReadings(undefined, eqId, undefined, 500, orgId),
    getVesselFleetOverview: (orgId?: string) => vesselService.getVesselFleetOverview(orgId),
    clearOrphanedTelemetryData: () => dbTelemetryStorage.clearOrphanedTelemetryData(),

    getSensorConfigurations: (orgId?: string, equipmentId?: string, sensorType?: string) => dbSensorsStorage.getSensorConfigurations(orgId, equipmentId, sensorType),
    getSensorConfiguration: (equipmentId: string, sensorType: string, orgId?: string) => dbSensorsStorage.getSensorConfiguration(equipmentId, sensorType, orgId),
    createSensorConfiguration: (config: any) => dbSensorsStorage.createSensorConfiguration(config),
    updateSensorConfiguration: (equipmentId: string, sensorType: string, config: any, orgId?: string) => dbSensorsStorage.updateSensorConfiguration(equipmentId, sensorType, config, orgId),
    deleteSensorConfiguration: (equipmentId: string, sensorType: string, orgId?: string) => dbSensorsStorage.deleteSensorConfiguration(equipmentId, sensorType, orgId),
    bulkCreateSensorConfigurations: (configs: any[], overwrite?: boolean) => dbSensorsStorage.bulkCreateSensorConfigurations(configs, overwrite),
    updateSensorConfigurationById: (id: string, config: any, orgId?: string) => dbSensorsStorage.updateSensorConfigurationById(id, config, orgId),
    deleteSensorConfigurationById: (id: string, orgId?: string) => dbSensorsStorage.deleteSensorConfigurationById(id, orgId),
    getSensorState: (equipmentId: string, sensorType: string, orgId?: string) => dbSensorsStorage.getSensorState(equipmentId, sensorType, orgId),
    upsertSensorState: (state: any) => dbSensorsStorage.upsertSensorState(state),
    getLatestTelemetryForSensor: (equipmentId: string, sensorType: string, orgId: string) => dbSensorsStorage.getLatestTelemetryForSensor(equipmentId, sensorType, orgId),
    getLatestTelemetryForSensors: (sensors: any[], orgId: string) => dbSensorsStorage.getLatestTelemetryForSensors(sensors, orgId),
    getSensorTemplates: (orgId: string, equipmentType?: string) => dbSensorsStorage.getSensorTemplates(orgId, equipmentType),
    getSensorTemplateById: (id: string, orgId: string) => dbSensorsStorage.getSensorTemplateById(id, orgId),
    createSensorTemplate: (template: any) => dbSensorsStorage.createSensorTemplate(template),
    updateSensorTemplate: (id: string, orgId: string, data: any) => dbSensorsStorage.updateSensorTemplate(id, orgId, data),
    deleteSensorTemplate: (id: string, orgId: string) => dbSensorsStorage.deleteSensorTemplate(id, orgId),
    getSensorMappings: (orgId?: string) => dbSensorsStorage.getSensorConfigurations(orgId),

    getAlertConfigurations: (equipmentId?: string) => dbAlertStorage.getAlertConfigurations(equipmentId),
    createAlertConfiguration: (config: any) => dbAlertStorage.createAlertConfiguration(config),
    updateAlertConfiguration: (id: string, config: any) => dbAlertStorage.updateAlertConfiguration(id, config),
    deleteAlertConfiguration: (id: string) => dbAlertStorage.deleteAlertConfiguration(id),
    getAlertNotifications: (acknowledged?: boolean, orgId?: string) => dbAlertStorage.getAlertNotifications(acknowledged, orgId),
    getAlertNotificationsPaginated: (acknowledged: any, orgId: any, limit: number, offset: number) => dbAlertStorage.getAlertNotificationsPaginated(acknowledged, orgId, limit, offset),
    createAlertNotification: (notification: any) => dbAlertStorage.createAlertNotification(notification),
    acknowledgeAlert: (id: string, acknowledgedBy: string) => dbAlertStorage.acknowledgeAlert(id, acknowledgedBy),
    hasRecentAlert: (equipmentId: string, sensorType: string, alertType: string, minutesBack?: number) => dbAlertStorage.hasRecentAlert(equipmentId, sensorType, alertType, minutesBack),
    addAlertComment: (commentData: any) => dbAlertStorage.addAlertComment(commentData),
    getAlertComments: (alertId: string) => dbAlertStorage.getAlertComments(alertId),
    createAlertSuppression: (suppressionData: any) => dbAlertStorage.createAlertSuppression(suppressionData),
    getActiveSuppressions: (orgId?: string) => dbAlertStorage.getActiveSuppressions(orgId),
    removeAlertSuppression: (id: string) => dbAlertStorage.removeAlertSuppression(id),
    isAlertSuppressed: (equipmentId: string, sensorType: string, alertType: string) => dbAlertStorage.isAlertSuppressed(equipmentId, sensorType, alertType),
    clearAllAlerts: () => dbAlertStorage.clearAllAlerts(),

    logComplianceAction: (data: any) => { console.warn("[storage.logComplianceAction] Not implemented - no compliance repo"); return Promise.resolve(data); },
    getComplianceAuditLog: (filters?: any) => { console.warn("[storage.getComplianceAuditLog] Not implemented - no compliance repo"); return Promise.resolve([]); },

    getSettings: () => dbSystemAdminStorage.getSettings(),
    getSystemSettings: () => dbSystemAdminStorage.getSettings(),
    updateSettings: (updates: any) => dbSystemAdminStorage.updateSettings(updates),

    getDashboardMetrics: (orgId: string) => analyticsInsightsAdapter.getDashboardMetrics(orgId),
    recordMetricsHistory: (orgId: string, metrics: any, equipmentStats: any) => dbAnalyticsStorage.recordMetricsHistory({ orgId, ...metrics, ...equipmentStats }),
    getMetricsHistory: (orgId: string, days?: number) => dbAnalyticsStorage.getMetricsHistory(orgId, days),

    createCrewRestSheet: (sheet: any) => dbStcwStorage.createCrewRestSheet(sheet),
    upsertCrewRestDay: (sheetId: string, dayData: any) => dbStcwStorage.upsertCrewRestDay(sheetId, dayData),
    getCrewRestMonth: (crewId: string, year: number, month: string) => dbStcwStorage.getCrewRestMonth(crewId, year, month),
    getCrewRestRange: (crewId: string, startDate: string, endDate: string) => dbStcwStorage.getCrewRestRange(crewId, startDate, endDate),
    getMultipleCrewRest: (crewIds: string[], year: number, month: string) => dbStcwStorage.getMultipleCrewRest(crewIds, year, month),
    getVesselCrewRest: (vesselId: string, year: number, month: string) => dbStcwStorage.getVesselCrewRest(vesselId, year, month),
    getCrewRestByDateRange: (vesselId?: string, startDate?: string, endDate?: string, complianceFilter?: boolean) => dbStcwStorage.getCrewRestByDateRange(vesselId, startDate, endDate, complianceFilter),
    markSchedulerRunHorGenerated: (runId: string) => dbSchedulerStorage.markSchedulerRunHorGenerated?.(runId) ?? Promise.resolve(),

    getWorkOrderChecklists: (workOrderId?: string, orgId?: string) => dbChecklistsStorage.getWorkOrderChecklists(workOrderId, orgId),
    createWorkOrderChecklist: (checklist: any) => dbChecklistsStorage.createWorkOrderChecklist(checklist),
    updateWorkOrderChecklist: (id: string, updates: any) => dbChecklistsStorage.updateWorkOrderChecklist(id, updates),
    deleteWorkOrderChecklist: (id: string) => dbChecklistsStorage.deleteWorkOrderChecklist(id),
    getWorkOrderWorklogs: (workOrderId?: string, orgId?: string) => dbChecklistsStorage.getWorkOrderWorklogs(workOrderId, orgId),
    createWorkOrderWorklog: (worklog: any) => dbChecklistsStorage.createWorkOrderWorklog(worklog),
    updateWorkOrderWorklog: (id: string, updates: any) => dbChecklistsStorage.updateWorkOrderWorklog(id, updates),
    deleteWorkOrderWorklog: (id: string) => dbChecklistsStorage.deleteWorkOrderWorklog(id),
    calculateWorklogCosts: (workOrderId: string) => dbChecklistsStorage.calculateWorklogCosts(workOrderId),
    getWorkOrderTasks: (workOrderId: string, orgId?: string) => dbChecklistsStorage.getWorkOrderTasks(workOrderId, orgId),
    createWorkOrderTask: (task: any) => dbChecklistsStorage.createWorkOrderTask(task),
    updateWorkOrderTask: (id: string, task: any) => dbChecklistsStorage.updateWorkOrderTask(id, task),
    deleteWorkOrderTask: (id: string) => dbChecklistsStorage.deleteWorkOrderTask(id),

    getParts: (orgId?: string) => dbInventoryStorage.getParts(orgId),
    getPartsInventory: (category?: string, orgId?: string, search?: string, sortBy?: string, sortOrder?: "asc" | "desc") => dbInventoryStorage.getPartsInventory(category, orgId, search, sortBy, sortOrder),
    getPartsInventoryPaginated: (orgId: string, options: any) => dbInventoryStorage.getPartsInventoryPaginated(orgId, options),
    getPartById: (id: string, orgId?: string) => dbInventoryStorage.getPartById(id, orgId),
    createPart: (part: any) => dbInventoryStorage.createPartsInventory(part),
    updatePart: (id: string, updates: any, orgId: string) => dbInventoryStorage.updatePartsInventory(id, updates),
    deletePart: (id: string, orgId: string) => dbInventoryStorage.deletePartsInventory(id, orgId),
    createPartInventory: (part: any) => dbInventoryStorage.createPartsInventory(part),
    getLowStockParts: (orgId?: string) => dbInventoryStorage.getLowStockParts(orgId),
    reservePart: (partId: string, quantity: number) => dbInventoryStorage.reservePart(partId, quantity),
    checkPartAvailabilityForWorkOrder: (partId: string, quantity: number, orgId?: string) => dbInventoryStorage.checkPartAvailabilityForWorkOrder(partId, quantity, orgId),
    reservePartsForWorkOrder: (workOrderId: string) => dbInventoryStorage.reservePartsForWorkOrder(workOrderId),
    releasePartsFromWorkOrder: (workOrderId: string, orgId: string) => dbInventoryStorage.releasePartsFromWorkOrder(workOrderId, orgId),
    getPartsCatalogue: (orgId?: string) => dbInventoryStorage.getParts(orgId),
    getPartCatalogueByNumber: (partNo: string, orgId?: string) => orgId ? dbInventoryStorage.getPartByPartNumber(partNo, orgId) : Promise.resolve(undefined),
    getPartByNumber: (partNo: string, orgId?: string) => orgId ? dbInventoryStorage.getPartByPartNumber(partNo, orgId) : Promise.resolve(undefined),
    getPartCatalogueById: (id: string, orgId?: string) => dbInventoryStorage.getPart(id, orgId),
    createPartCatalogue: (part: any) => dbInventoryStorage.createPart(part),
    updatePartCatalogue: (id: string, updates: any) => dbInventoryStorage.updatePart(id, updates),
    deletePartCatalogue: (id: string) => dbInventoryStorage.deletePart(id),
    syncPartCostToStock: (partId: string) => dbInventoryStorage.syncPartCostToStock(partId),
    syncStockCostFromPart: (partId: string) => dbInventoryStorage.syncStockCostFromPart(partId),
    getStock: (orgId?: string, search?: string, location?: string, sortBy?: string) => dbInventoryStorage.getStock(orgId, search, location, sortBy),
    getStockByPart: (partId: string, orgId?: string) => dbInventoryStorage.getStockByPart(partId, orgId),
    getStockByPartNumber: (partNo: string, orgId?: string) => dbInventoryStorage.getStockByPartNumber(partNo, orgId),
    createStock: (stockData: any) => dbInventoryStorage.createStock(stockData),
    updateStock: (id: string, updates: any) => dbInventoryStorage.updateStock(id, updates),
    deleteStock: (id: string) => dbInventoryStorage.deleteStock(id),
    updateStockQuantities: (stockId: string, onHand?: number, reserved?: number) => dbInventoryStorage.updateStockQuantities(stockId, onHand, reserved),
    getWorkOrderParts: (workOrderId?: string, orgId?: string) => workOrderId ? dbWorkOrderStorage.getWorkOrderParts(workOrderId, orgId) : Promise.resolve([]),
    addPartToWorkOrder: (workOrderPart: any) => dbInventoryStorage.addPartToWorkOrder(workOrderPart),
    updateWorkOrderPart: (id: string, updates: any) => dbInventoryStorage.updateWorkOrderPart(id, updates),
    removePartFromWorkOrder: (id: string, orgId?: string) => dbInventoryStorage.removePartFromWorkOrder(id, orgId),
    removePartAndRestoreInventory: (workOrderPartId: string, orgId: string, performedBy: string) => dbInventoryStorage.removePartAndRestoreInventory(workOrderPartId, orgId, performedBy),
    addBulkPartsToWorkOrder: (workOrderId: string, partsToAdd: any[], orgId: string) => dbInventoryStorage.addBulkPartsToWorkOrder(workOrderId, partsToAdd, orgId),
    addBulkPartsAndReserveInventory: (workOrderId: string, partsToAdd: any[], orgId: string) => dbInventoryStorage.addBulkPartsAndReserveInventory(workOrderId, partsToAdd, orgId),
    getPartsCostForWorkOrder: (workOrderId: string) => dbInventoryStorage.getPartsCostForWorkOrder(workOrderId),
    getWorkOrderHistory: (workOrderId: string, orgId: string) => dbInventoryStorage.getWorkOrderHistory(workOrderId, orgId),
    addWorkOrderHistoryEntry: (entry: any) => dbInventoryStorage.addWorkOrderHistoryEntry(entry),
    getPartStockWithSupplierLeadTime: (partId: string, orgId: string) => dbInventoryStorage.getPartStockWithSupplierLeadTime(partId, orgId),
    getInventoryMovementsByWorkOrder: (workOrderId: string, orgId: string) => dbInventoryStorage.getInventoryMovementsByWorkOrder(workOrderId, orgId),
    getWorkOrderPartsByEquipment: (orgId: string, equipmentId: string) => dbInventoryStorage.getWorkOrderPartsByEquipment(orgId, equipmentId),
    getWorkOrderPartsByPartId: (orgId: string, partId: string) => dbInventoryStorage.getWorkOrderPartsByPartId(orgId, partId),
    getPartsForEquipment: (equipmentId: string, orgId: string) => dbInventoryStorage.getPartsForEquipment(equipmentId, orgId),
    seedStockForParts: (orgId: string) => dbInventoryStorage.seedStockForParts(orgId),
    updatePartCost: (partId: string, updateData: any, orgId?: string) => dbAnalyticsStorage.updatePartCost(partId, updateData, orgId || "default-org-id"),
    updatePartStockQuantities: (partId: string, updateData: any, orgId?: string) => dbAnalyticsStorage.updatePartStockQuantities(partId, updateData, orgId || "default-org-id"),
    getEquipmentForPart: (partId: string, orgId: string) => dbEquipmentStorage.getEquipmentRegistry(orgId).then((eqs: any[]) => eqs.filter((e: any) => ('compatibleParts' in e && Array.isArray(e.compatibleParts)) ? e.compatibleParts.includes(partId) : false)),
    updatePartCompatibility: (partId: string, equipmentIds: string[]) => dbInventoryStorage.updatePartCatalogue(partId, { compatibleEquipment: equipmentIds }),
    clearAllWorkOrders: () => dbWorkOrderStorage.clearAllWorkOrders(),
    clearAllMaintenanceSchedules: () => dbMaintenanceStorage.clearAllMaintenanceSchedules(),
    checkIdempotency: async (key: string) => { const r = await db.select().from(idempotencyLog).where(eq(idempotencyLog.key, key)).limit(1); return r.length > 0; },
    recordIdempotency: async (key: string, endpoint: string) => { await db.insert(idempotencyLog).values({ key, endpoint, createdAt: new Date() }).onConflictDoNothing(); },

    getMaintenanceTemplates: (orgId?: string, equipmentType?: string, isActive?: boolean) => dbMaintenanceTemplatesStorage.getMaintenanceTemplates(orgId, equipmentType, isActive),
    getMaintenanceTemplate: (id: string, orgId?: string) => dbMaintenanceTemplatesStorage.getMaintenanceTemplate(id, orgId),
    createMaintenanceTemplate: (template: any) => dbMaintenanceTemplatesStorage.createMaintenanceTemplate(template),
    updateMaintenanceTemplate: (id: string, template: any, orgId?: string) => dbMaintenanceTemplatesStorage.updateMaintenanceTemplate(id, template, orgId),
    deleteMaintenanceTemplate: (id: string, orgId?: string) => dbMaintenanceTemplatesStorage.deleteMaintenanceTemplate(id, orgId),
    cloneMaintenanceTemplate: (id: string, newName: string, orgId?: string) => dbMaintenanceTemplatesStorage.cloneMaintenanceTemplate(id, newName, orgId),

    getMaintenanceSchedules: (equipmentId?: string, status?: string) => dbMaintenanceStorage.getMaintenanceSchedules(equipmentId, status),
    getMaintenanceSchedule: (id: string) => dbMaintenanceStorage.getMaintenanceSchedule?.(id),
    createMaintenanceSchedule: (schedule: any) => dbMaintenanceStorage.createMaintenanceSchedule(schedule),
    updateMaintenanceSchedule: (id: string, updates: any) => dbMaintenanceStorage.updateMaintenanceSchedule(id, updates),
    deleteMaintenanceSchedule: (id: string) => dbMaintenanceStorage.deleteMaintenanceSchedule(id),
    getMaintenanceRecords: (equipmentId?: string, fromDate?: Date, toDate?: Date) => dbMaintenanceStorage.getMaintenanceRecords(equipmentId, fromDate, toDate),
    createMaintenanceRecord: (record: any) => dbMaintenanceStorage.createMaintenanceRecord(record),
    processCompletedMaintenance: async (scheduleId: string, record: any) => { const schedule = await dbMaintenanceStorage.updateMaintenanceSchedule(scheduleId, { status: "completed" }); const newRecord = await dbMaintenanceStorage.createMaintenanceRecord(record); return { schedule, record: newRecord }; },
    getMaintenanceCosts: (equipmentId?: string) => dbMaintenanceStorage.getMaintenanceCosts(equipmentId),
    createMaintenanceCost: (cost: any) => dbMaintenanceStorage.createMaintenanceCost(cost),
    getMaintenanceCostsByWorkOrder: (workOrderId: string) => dbMaintenanceStorage.getMaintenanceCostsByWorkOrder(workOrderId),
    getScheduleEfficiency: async () => { const schedules = await dbMaintenanceStorage.getMaintenanceSchedules(); const completed = schedules.filter((s: any) => s.status === "completed").length; const overdue = schedules.filter((s: any) => s.status === "overdue" || (s.status === "scheduled" && s.scheduledDate < new Date())).length; const onTime = schedules.filter((s: any) => s.status === "completed" && s.completedDate && s.completedDate <= s.scheduledDate).length; return { totalScheduled: schedules.length, completed, overdue, onTime }; },
    autoScheduleMaintenance: (equipmentId: string, pdmScore: number) => schedulingAdapter.autoScheduleMaintenance(equipmentId, pdmScore),
    triggerAutoSchedulingForEquipment: async (equipmentId: string) => { const schedule = await schedulingAdapter.autoScheduleMaintenance(equipmentId, 75); return schedule ? [schedule] : []; },
    triggerAutoSchedulingForAllEquipment: async () => ({ scheduled: [], errors: [] as string[] }),

    getCrew: (orgId?: string, vesselId?: string) => dbCrewStorage.getCrew(orgId, vesselId),
    getCrewMember: (id: string, orgId?: string) => dbCrewStorage.getCrewMember(id, orgId),
    getCrewMembers: (orgId?: string) => dbCrewStorage.getCrew(orgId),
    getAllCrew: (orgId?: string) => dbCrewStorage.getCrew(orgId),
    createCrewMember: (crewData: any) => dbCrewStorage.createCrewMember(crewData),
    createCrew: (crewData: any) => dbCrewStorage.createCrewMember(crewData),
    updateCrewMember: (id: string, updates: any) => dbCrewStorage.updateCrewMember(id, updates),
    updateCrew: (id: string, updates: any) => dbCrewStorage.updateCrewMember(id, updates),
    deleteCrewMember: (id: string) => dbCrewStorage.deleteCrewMember(id),
    deleteCrew: (id: string) => dbCrewStorage.deleteCrewMember(id),
    getCrewWithSkills: (orgId?: string) => crewService.getCrewWithSkills(orgId),
    getSkills: async (orgId?: string) => { const conditions = orgId ? eq(skills.orgId, orgId) : undefined; return conditions ? db.select().from(skills).where(conditions) : db.select().from(skills); },
    createSkill: async (skillData: any) => { const [newSkill] = await db.insert(skills).values(skillData).returning(); return newSkill; },
    updateSkill: async (id: string, updates: any) => { const [updated] = await db.update(skills).set({ ...updates, updatedAt: new Date() }).where(eq(skills.id, id)).returning(); if (!updated) { throw new Error(`Skill ${id} not found`); } return updated; },
    deleteSkill: async (id: string) => { await db.delete(skills).where(eq(skills.id, id)); },
    updateCrewRate: (crewId: string, updateData: any) => dbCrewStorage.updateCrewRate(crewId, updateData),
    getExpenses: (orgId?: string) => dbAnalyticsStorage.getExpenses(orgId),
    createExpense: (expense: any) => dbAnalyticsStorage.createExpense(expense),
    updateExpenseStatus: (expenseId: string, status: any) => dbAnalyticsStorage.updateExpenseStatus(expenseId, status),
    getCostSummaryByEquipment: (equipmentId?: string, months?: number) => dbAnalyticsStorage.getCostSummaryByEquipment(equipmentId, months),
    getCostTrends: (months?: number) => dbAnalyticsStorage.getCostTrends(months),
    getEquipmentLifecycle: (equipmentId?: string) => dbAnalyticsStorage.getEquipmentLifecycle(equipmentId),
    upsertEquipmentLifecycle: (lifecycle: any) => dbAnalyticsStorage.upsertEquipmentLifecycle(lifecycle),
    updateEquipmentLifecycle: (id: string, updates: any) => dbAnalyticsStorage.updateEquipmentLifecycle(id, updates),
    getReplacementRecommendations: () => dbAnalyticsStorage.getReplacementRecommendations(),
    getPerformanceMetrics: (equipmentId?: string, dateFrom?: Date, dateTo?: Date) => dbAnalyticsStorage.getPerformanceMetrics(equipmentId, dateFrom, dateTo),
    createPerformanceMetric: (metric: any) => dbAnalyticsStorage.createPerformanceMetric(metric),
    getFleetPerformanceOverview: () => dbAnalyticsStorage.getFleetPerformanceOverview(),
    getPerformanceTrends: (equipmentId: string, months?: number) => dbAnalyticsStorage.getPerformanceTrends(equipmentId, months),

    getDeckLogDaily: (orgId: string, filters?: any) => deckLogStorage.getDeckLogDaily(orgId, filters),
    getDeckLogDailyById: (id: string, orgId: string) => deckLogStorage.getDeckLogDailyById(id, orgId),
    getDeckLogDailyByDate: (vesselId: string, logDate: string, orgId: string) => deckLogStorage.getDeckLogDailyByDate(vesselId, logDate, orgId),
    createDeckLogDaily: (entry: any) => deckLogStorage.createDeckLogDaily(entry),
    updateDeckLogDaily: (id: string, entry: any, orgId: string) => deckLogStorage.updateDeckLogDaily(id, entry, orgId),
    deleteDeckLogDaily: (id: string, orgId: string) => deckLogStorage.deleteDeckLogDaily(id, orgId),
    signDeckLogDaily: (id: string, signData: any, orgId: string) => deckLogStorage.signDeckLogDaily(id, signData, orgId),
    getDeckLogHourly: (dailyLogId: string, orgId: string) => deckLogStorage.getDeckLogHourly(dailyLogId, orgId),
    getDeckLogHourlyByHour: (dailyLogId: string, hour: number, orgId: string) => deckLogStorage.getDeckLogHourlyByHour(dailyLogId, hour, orgId),
    upsertDeckLogHourly: (entry: any) => deckLogStorage.upsertDeckLogHourly(entry),
    bulkUpsertDeckLogHourly: (entries: any[]) => deckLogStorage.bulkUpsertDeckLogHourly(entries),
    deleteDeckLogHourly: (id: string, orgId: string) => deckLogStorage.deleteDeckLogHourly(id, orgId),
    getDeckLogWatch: (dailyLogId: string, orgId: string) => deckLogStorage.getDeckLogWatch(dailyLogId, orgId),
    getDeckLogWatchByPeriod: (dailyLogId: string, watchPeriod: string, orgId: string) => deckLogStorage.getDeckLogWatchByPeriod(dailyLogId, watchPeriod, orgId),
    upsertDeckLogWatch: (entry: any) => deckLogStorage.upsertDeckLogWatch(entry),
    deleteDeckLogWatch: (id: string, orgId: string) => deckLogStorage.deleteDeckLogWatch(id, orgId),
    getDeckLogComplete: (dailyLogId: string, orgId: string) => deckLogStorage.getDeckLogComplete(dailyLogId, orgId),
    getDeckLogEvents: (dayId: string, orgId: string, filters?: any) => deckLogStorage.getDeckLogEvents(dayId, orgId, filters),
    getDeckLogEventById: (id: string, orgId: string) => deckLogStorage.getDeckLogEventById(id, orgId),
    getDeckLogEventByIdempotencyKey: (key: string, orgId: string) => deckLogStorage.getDeckLogEventByIdempotencyKey(key, orgId),
    createDeckLogEvent: (event: any) => deckLogStorage.createDeckLogEvent(event),
    updateDeckLogEvent: (id: string, event: any, orgId: string) => deckLogStorage.updateDeckLogEvent(id, event, orgId),
    deleteDeckLogEvent: (id: string, orgId: string) => deckLogStorage.deleteDeckLogEvent(id, orgId),
    lockDeckLogDaily: (id: string, lockData: any, orgId: string) => deckLogStorage.lockDeckLogDaily(id, lockData, orgId),
    unlockDeckLogDaily: (id: string, orgId: string) => deckLogStorage.unlockDeckLogDaily(id, orgId),

    getEngineLogDaily: (orgId: string, filters?: any) => engineLogStorage.getEngineLogDaily(orgId, filters),
    getEngineLogDailyById: (id: string, orgId: string) => engineLogStorage.getEngineLogDailyById(id, orgId),
    getEngineLogDailyByDate: (vesselId: string, logDate: string, orgId: string) => engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId),
    createEngineLogDaily: (entry: any) => engineLogStorage.createEngineLogDaily(entry),
    updateEngineLogDaily: (id: string, entry: any, orgId: string) => engineLogStorage.updateEngineLogDaily(id, entry, orgId),
    deleteEngineLogDaily: (id: string, orgId: string) => engineLogStorage.deleteEngineLogDaily(id, orgId),
    getEngineLogHourly: (dailyLogId: string, orgId: string) => engineLogStorage.getEngineLogHourly(dailyLogId, orgId),
    upsertEngineLogHourly: (entry: any) => engineLogStorage.upsertEngineLogHourly(entry),
    getEngineLogGenerator: (dailyLogId: string, orgId: string) => engineLogStorage.getEngineLogGenerator(dailyLogId, orgId),
    upsertEngineLogGenerator: (entry: any) => engineLogStorage.upsertEngineLogGenerator(entry),
    getEngineLogWatch: (dailyLogId: string, orgId: string) => engineLogStorage.getEngineLogWatch(dailyLogId, orgId),
    upsertEngineLogWatch: (entry: any) => engineLogStorage.upsertEngineLogWatch(entry),
    getEngineLogEvents: (dayId: string, orgId: string, filters?: any) => engineLogStorage.getEngineLogEvents(dayId, orgId, filters),
    getEngineLogEventById: (id: string, orgId: string) => engineLogStorage.getEngineLogEventById(id, orgId),
    getEngineLogEventByIdempotencyKey: (key: string, orgId: string) => engineLogStorage.getEngineLogEventByIdempotencyKey(key, orgId),
    createEngineLogEvent: (event: any) => engineLogStorage.createEngineLogEvent(event),
    updateEngineLogEvent: (id: string, event: any, orgId: string) => engineLogStorage.updateEngineLogEvent(id, event, orgId),
    deleteEngineLogEvent: (id: string, orgId: string) => engineLogStorage.deleteEngineLogEvent(id, orgId),
    getEngineLogComplete: (dailyLogId: string, orgId: string) => engineLogStorage.getEngineLogComplete(dailyLogId, orgId),
    getEngineLogHourlyByHour: (dailyLogId: string, hour: number, orgId: string) => engineLogStorage.getEngineLogHourlyByHour(dailyLogId, hour, orgId),
    bulkUpsertEngineLogHourly: (entries: any[]) => engineLogStorage.bulkUpsertEngineLogHourly(entries),
    deleteEngineLogHourly: (id: string, orgId: string) => engineLogStorage.deleteEngineLogHourly(id, orgId),
    getEngineLogGeneratorByHour: (dailyLogId: string, hour: number, orgId: string) => engineLogStorage.getEngineLogGeneratorByHour(dailyLogId, hour, orgId),
    bulkUpsertEngineLogGenerator: (entries: any[]) => engineLogStorage.bulkUpsertEngineLogGenerator(entries),
    deleteEngineLogGenerator: (id: string, orgId: string) => engineLogStorage.deleteEngineLogGenerator(id, orgId),
    getEngineLogWatchByPeriod: (dailyLogId: string, watchPeriod: string, orgId: string) => engineLogStorage.getEngineLogWatchByPeriod(dailyLogId, watchPeriod, orgId),
    deleteEngineLogWatch: (id: string, orgId: string) => engineLogStorage.deleteEngineLogWatch(id, orgId),
    signEngineLogDaily: (id: string, signData: any, orgId: string) => engineLogStorage.signEngineLogDaily(id, signData, orgId),
    lockEngineLogDaily: (id: string, lockData: any, orgId: string) => engineLogStorage.lockEngineLogDaily(id, lockData, orgId),
    unlockEngineLogDaily: (id: string, orgId: string) => engineLogStorage.unlockEngineLogDaily(id, orgId),

    getStormgeoSettings: (orgId: string, vesselId?: string) => dbStormGeoStorage.getStormgeoSettings(orgId, vesselId),
    createStormgeoSettings: (settings: any) => dbStormGeoStorage.createStormgeoSettings(settings),
    updateStormgeoSettings: (id: string, settings: any, orgId: string) => dbStormGeoStorage.updateStormgeoSettings(id, settings, orgId),
    deleteStormgeoSettings: (id: string, orgId: string) => dbStormGeoStorage.deleteStormgeoSettings(id, orgId),
    getStormgeoSnapshots: (orgId: string, filters?: any) => dbStormGeoStorage.getStormgeoSnapshots(orgId, filters),
    getStormgeoSnapshotById: (id: string, orgId: string) => dbStormGeoStorage.getStormgeoSnapshotById(id, orgId),
    getStormgeoSnapshotForTime: (vesselId: string, forecastTime: Date, orgId: string) => dbStormGeoStorage.getStormgeoSnapshotForTime(vesselId, forecastTime, orgId),
    createStormgeoSnapshot: (snapshot: any) => dbStormGeoStorage.createStormgeoSnapshot(snapshot),
    bulkCreateStormgeoSnapshots: (snapshots: any[]) => dbStormGeoStorage.bulkCreateStormgeoSnapshots(snapshots),
    deleteStormgeoSnapshot: (id: string, orgId: string) => dbStormGeoStorage.deleteStormgeoSnapshot(id, orgId),
    deleteStormgeoSnapshotsByRoute: (routeId: string, orgId: string) => dbStormGeoStorage.deleteStormgeoSnapshotsByRoute(routeId, orgId),
    getDeckLogHourlyAutoFill: (hourlyLogId: string) => dbStormGeoStorage.getDeckLogHourlyAutoFill(hourlyLogId),
    createDeckLogHourlyAutoFill: (autoFill: any) => dbStormGeoStorage.createDeckLogHourlyAutoFill(autoFill),
    updateDeckLogHourlyAutoFill: (id: string, autoFill: any) => dbStormGeoStorage.updateDeckLogHourlyAutoFill(id, autoFill),
    markAutoFillOverridden: (hourlyLogId: string, overriddenFields: string[], userId: string, userName: string) => dbStormGeoStorage.markAutoFillOverridden(hourlyLogId, overriddenFields, userId, userName),
    getStormgeoImportHistory: (orgId: string, filters?: any) => dbStormGeoStorage.getStormgeoImportHistory(orgId, filters),
    getStormgeoImportHistoryById: (id: string, orgId: string) => dbStormGeoStorage.getStormgeoImportHistoryById(id, orgId),
    createStormgeoImportHistory: (history: any) => dbStormGeoStorage.createStormgeoImportHistory(history),
    updateStormgeoImportHistory: (id: string, history: any, orgId: string) => dbStormGeoStorage.updateStormgeoImportHistory(id, history, orgId),

    getCrewCertifications: (crewId: string, orgId: string) => dbCrewExtensionsStorage.getCrewCertifications(crewId, orgId),
    createCrewCertification: (data: any) => dbCrewExtensionsStorage.createCrewCertification(data),
    updateCrewCertification: (id: string, data: any, orgId: string) => dbCrewExtensionsStorage.updateCrewCertification(id, data, orgId),
    deleteCrewCertification: (id: string, orgId: string) => dbCrewExtensionsStorage.deleteCrewCertification(id, orgId),
    getCrewDocuments: (crewId: string, orgId: string) => dbCrewExtensionsStorage.getCrewDocuments(crewId, orgId),
    createCrewDocument: (data: any) => dbCrewExtensionsStorage.createCrewDocument(data),
    updateCrewDocument: (id: string, data: any, orgId: string) => dbCrewExtensionsStorage.updateCrewDocument(id, data, orgId),
    deleteCrewDocument: (id: string, orgId: string) => dbCrewExtensionsStorage.deleteCrewDocument(id, orgId),
    getExpiringCertifications: (orgId: string, daysAhead: number) => dbCrewExtensionsStorage.getExpiringCertifications(orgId, daysAhead),
    getExpiringDocuments: (orgId: string, daysAhead: number) => dbCrewExtensionsStorage.getExpiringDocuments(orgId, daysAhead),
    updateDocumentAlertFlags: (orgId: string) => dbCrewExtensionsStorage.updateDocumentAlertFlags(orgId),
    getCrewNotificationSettings: (crewId: string, orgId: string) => dbCrewExtensionsStorage.getCrewNotificationSettings(crewId, orgId),
    upsertCrewNotificationSettings: (crewId: string, orgId: string, data: any) => dbCrewExtensionsStorage.upsertCrewNotificationSettings(crewId, orgId, data),
    getAllCrewNotificationSettings: (orgId: string) => dbCrewExtensionsStorage.getAllCrewNotificationSettings(orgId),
    getCertificationsExpiring: (orgId: string, daysAhead?: number, includeAcknowledged?: boolean) => dbCrewExtensionsStorage.getCertificationsExpiring(orgId, daysAhead ?? 90, includeAcknowledged ?? false),
    acknowledgeCertificationAlert: (certId: string, userId?: string, notes?: string) => dbCrewExtensionsStorage.acknowledgeCertificationAlert(certId, userId, notes),
    updateCertificationAlertFlags: (orgId: string) => dbCrewExtensionsStorage.updateCertificationAlertFlags(orgId),
    getDocumentsExpiring: (orgId: string, daysAhead?: number, includeAcknowledged?: boolean) => dbCrewExtensionsStorage.getDocumentsExpiring(orgId, daysAhead ?? 90, includeAcknowledged ?? false),
    acknowledgeDocumentAlert: (docId: string, userId?: string, notes?: string) => dbCrewExtensionsStorage.acknowledgeDocumentAlert(docId, userId, notes),

    getComplianceFindings: async (orgId: string, filters?: any) => { const result = await db.execute(sql`SELECT * FROM compliance_findings WHERE org_id = ${orgId} ${filters?.vesselId ? sql`AND vessel_id = ${filters.vesselId}` : sql``} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.severity ? sql`AND severity = ${filters.severity}` : sql``} ${filters?.status ? sql`AND status = ${filters.status}` : sql``} ${filters?.ruleCode ? sql`AND rule_code = ${filters.ruleCode}` : sql``} ${filters?.startDate ? sql`AND found_at >= ${filters.startDate}::timestamp` : sql``} ${filters?.endDate ? sql`AND found_at <= ${filters.endDate}::timestamp` : sql``} ORDER BY found_at DESC`); return result.rows; },
    getComplianceRules: async (orgId: string, filters?: any) => { const result = await db.execute(sql`SELECT * FROM compliance_rules WHERE org_id = ${orgId} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.category ? sql`AND category = ${filters.category}` : sql``} ${filters?.enabled !== undefined ? sql`AND enabled = ${filters.enabled}` : sql``} ORDER BY rule_name ASC`); return result.rows; },
    getComplianceFindingById: async (id: string, orgId: string) => { const result = await db.execute(sql`SELECT * FROM compliance_findings WHERE id = ${id} AND org_id = ${orgId}`); return result.rows[0]; },
    getComplianceRuleById: async (id: string, orgId: string) => { const result = await db.execute(sql`SELECT * FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`); return result.rows[0]; },
    createComplianceFinding: async (data: any) => { const result = await db.execute(sql`INSERT INTO compliance_findings (org_id, vessel_id, source_type, severity, status, rule_code, title, description, found_at) VALUES (${data.orgId}, ${data.vesselId}, ${data.sourceType}, ${data.severity}, ${data.status || 'open'}, ${data.ruleCode}, ${data.title}, ${data.description}, NOW()) RETURNING *`); return result.rows[0]; },
    createComplianceRule: async (data: any) => { const result = await db.execute(sql`INSERT INTO compliance_rules (org_id, source_type, category, rule_name, rule_code, description, severity, enabled) VALUES (${data.orgId}, ${data.sourceType}, ${data.category}, ${data.ruleName}, ${data.ruleCode}, ${data.description}, ${data.severity}, ${data.enabled ?? true}) RETURNING *`); return result.rows[0]; },
    updateComplianceRule: async (id: string, updates: any, orgId: string) => { const result = await db.execute(sql`UPDATE compliance_rules SET rule_name = COALESCE(${updates.ruleName}, rule_name), description = COALESCE(${updates.description}, description), severity = COALESCE(${updates.severity}, severity), enabled = COALESCE(${updates.enabled}, enabled) WHERE id = ${id} AND org_id = ${orgId} RETURNING *`); return result.rows[0]; },
    deleteComplianceFinding: async (id: string, orgId: string) => { await db.execute(sql`DELETE FROM compliance_findings WHERE id = ${id} AND org_id = ${orgId}`); },
    deleteComplianceRule: async (id: string, orgId: string) => { await db.execute(sql`DELETE FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`); },
    resolveComplianceFinding: async (id: string, orgId: string) => { const result = await db.execute(sql`UPDATE compliance_findings SET status = 'resolved', resolved_at = NOW() WHERE id = ${id} AND org_id = ${orgId} RETURNING *`); return result.rows[0]; },
    acknowledgeComplianceFinding: async (id: string, orgId: string) => { const result = await db.execute(sql`UPDATE compliance_findings SET status = 'acknowledged' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`); return result.rows[0]; },
    suppressComplianceFinding: async (id: string, orgId: string) => { const result = await db.execute(sql`UPDATE compliance_findings SET status = 'suppressed' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`); return result.rows[0]; },

    getThresholdOptimizations: (orgId: string, equipmentId?: string, sensorType?: string) => dbMlAnalyticsStorage.getThresholdOptimizations(orgId, equipmentId, sensorType),
    getThresholdOptimization: (id: number, orgId: string) => dbMlAnalyticsStorage.getThresholdOptimization(id, orgId),

    getDeviceRegistry: (deviceId: string, orgId: string) => dbHubSyncStorage.getDeviceRegistry(deviceId, orgId),
    upsertDeviceRegistry: (data: any) => dbHubSyncStorage.upsertDeviceRegistry(data),
    getReplayRequests: (deviceId: string, status?: string) => dbHubSyncStorage.getReplayRequests(deviceId, status),
    createReplayRequest: (data: any) => dbHubSyncStorage.createReplayRequest(data),
    updateReplayRequest: (id: string, updates: any) => dbHubSyncStorage.updateReplayRequest(id, updates),
    getSheetLock: (sheetType: string, sheetId: string) => dbHubSyncStorage.getSheetLock(sheetType, sheetId),
    acquireSheetLock: (data: any) => dbHubSyncStorage.acquireSheetLock(data),
    releaseSheetLock: (sheetType: string, sheetId: string) => dbHubSyncStorage.releaseSheetLock(sheetType, sheetId),
    getSheetVersion: (sheetType: string, sheetId: string) => dbHubSyncStorage.getSheetVersion(sheetType, sheetId),
    incrementSheetVersion: (data: any) => dbHubSyncStorage.incrementSheetVersion(data),

    getVessels: (orgId?: string) => vesselService.getVessels(orgId),
    getVessel: (id: string, orgId?: string) => vesselService.getVessel(id, orgId),
    getVesselByName: (name: string, orgId?: string) => vesselService.getVesselByName(name, orgId || ''),
    createVessel: (vessel: any) => vesselService.createVessel(vessel),
    updateVessel: (id: string, updates: any, orgId: string) => vesselService.updateVessel(id, updates, orgId),
    deleteVessel: (id: string, deleteEquipment?: boolean, orgId?: string) => vesselService.deleteVessel(id, orgId),

    getPortCalls: (vesselId?: string, orgId?: string) => dbVesselStorage.getPortCalls(vesselId || '', orgId || ''),
    createPortCall: (data: any) => dbVesselStorage.createPortCall(data),
    updatePortCall: (id: string, updates: any, orgId: string) => dbVesselStorage.updatePortCall(id, updates, orgId),
    deletePortCall: (id: string, orgId: string) => dbVesselStorage.deletePortCall(id, orgId),
    getDrydockWindows: (orgId?: string, vesselId?: string) => dbVesselStorage.getDrydockWindows(vesselId || '', orgId || ''),
    createDrydockWindow: (data: any) => dbVesselStorage.createDrydockWindow(data),
    updateDrydockWindow: (id: string, updates: any, orgId: string) => dbVesselStorage.updateDrydockWindow(id, updates, orgId),
    deleteDrydockWindow: (id: string, orgId: string) => dbVesselStorage.deleteDrydockWindow(id, orgId),

    getShiftTemplates: (orgId?: string) => dbCrewStorage.getShiftTemplates(orgId),
    createShiftTemplate: (data: any) => dbCrewStorage.createShiftTemplate(data),
    updateShiftTemplate: (id: string, updates: any, orgId: string) => dbCrewStorage.updateShiftTemplate(id, updates, orgId),
    deleteShiftTemplate: (id: string, orgId: string) => dbCrewStorage.deleteShiftTemplate(id, orgId),
    getCrewAssignments: (orgId: string, date?: string, vesselId?: string) => dbCrewStorage.getCrewAssignments(orgId, date, vesselId),
    createCrewAssignment: (data: any) => dbCrewStorage.createCrewAssignment(data),
    updateCrewAssignment: (id: string, updates: any, orgId: string) => dbCrewStorage.updateCrewAssignment(id, updates, orgId),
    deleteCrewAssignment: (id: string, orgId: string) => dbCrewStorage.deleteCrewAssignment(id, orgId),
    getCrewAssignmentsByDateRange: (from: Date, to: Date, orgId?: string) => dbCrewStorage.getCrewAssignmentsByDateRange(from, to, orgId),
    deleteCrewAssignmentsByRunId: (orgId: string, runId: string) => dbCrewStorage.deleteCrewAssignmentsByRunId(orgId, runId),
    getCrewLeave: (crewId: string, orgId: string) => dbCrewStorage.getCrewLeave(crewId, orgId),
    createCrewLeave: (data: any) => dbCrewStorage.createCrewLeave(data),
    updateCrewLeave: (id: string, updates: any, orgId: string) => dbCrewStorage.updateCrewLeave(id, updates, orgId),
    deleteCrewLeave: (id: string, orgId: string) => dbCrewStorage.deleteCrewLeave(id, orgId),
    getCrewSkills: (crewId: string) => dbCrewStorage.getCrewSkills(crewId),

    getSchedulerRuns: (orgId: string, limit?: number) => dbSchedulerStorage.getSchedulerRuns(orgId, undefined, limit),
    getSchedulerRun: (id: string) => dbSchedulerStorage.getSchedulerRun(id),
    getScheduleAssignmentsByRun: (runId: string) => dbSchedulerStorage.getScheduleAssignmentsByRun?.(runId) ?? Promise.resolve([]),
    createSchedulerRun: (run: any) => dbSchedulerStorage.createSchedulerRun(run),
    deleteSchedulerRuns: (orgId: string) => dbSchedulerStorage.deleteSchedulerRuns(orgId),
    deleteScheduleAssignmentsByOrg: (orgId: string) => dbSchedulerStorage.deleteScheduleAssignmentsByOrg(orgId),
    deleteScheduleUnfilledByOrg: (orgId: string) => dbSchedulerStorage.deleteScheduleUnfilledByOrg(orgId),
    deleteScheduleAssignmentsByDateRange: (orgId: string, from: Date, to: Date) => dbSchedulerStorage.deleteScheduleAssignmentsByDateRange?.(orgId, from, to) ?? Promise.resolve(),
    findRecentSchedulerRunByHash: (orgId: string, hash: string) => dbSchedulerStorage.findRecentSchedulerRunByHash?.(orgId, hash) ?? Promise.resolve(null),
    createBulkScheduleAssignments: (assignments: any[]) => dbSchedulerStorage.createBulkScheduleAssignments?.(assignments) ?? Promise.resolve([]),
    createBulkScheduleUnfilled: (unfilled: any[]) => dbSchedulerStorage.createBulkScheduleUnfilled?.(unfilled) ?? Promise.resolve([]),
    updateSchedulerRun: (id: string, updates: any) => dbSchedulerStorage.updateSchedulerRun?.(id, updates) ?? Promise.resolve(null),
    completeSchedulerRun: (id: string, result?: any) => dbSchedulerStorage.completeSchedulerRun?.(id, result) ?? Promise.resolve(null),
    failSchedulerRun: (id: string, error?: string) => dbSchedulerStorage.failSchedulerRun?.(id, error) ?? Promise.resolve(null),
    getLatestSchedulerRun: (orgId: string) => dbSchedulerStorage.getLatestSchedulerRun?.(orgId) ?? Promise.resolve(null),
    getSchedulingSettings: (orgId: string) => dbSchedulerStorage.getSchedulingSettings?.(orgId) ?? Promise.resolve(null),
    getSchedulingSettingsByVessel: (orgId: string, vesselId: string) => dbSchedulerStorage.getSchedulingSettingsByVessel?.(orgId, vesselId) ?? Promise.resolve(null),

    getInsightSnapshots: (orgId: string, filters?: any) => analyticsInsightsAdapter.getInsightSnapshots(orgId, filters),
    getInsightSnapshot: (id: string, orgId: string) => analyticsInsightsAdapter.getInsightSnapshot(id, orgId),
    createInsightSnapshot: (snapshot: any) => analyticsInsightsAdapter.createInsightSnapshot(snapshot),
    updateInsightSnapshot: (id: string, updates: any, orgId: string) => analyticsInsightsAdapter.updateInsightSnapshot(id, updates, orgId),
    deleteInsightSnapshot: (id: string, orgId: string) => analyticsInsightsAdapter.deleteInsightSnapshot(id, orgId),
    getInsightReports: (orgId: string, filters?: any) => analyticsInsightsAdapter.getInsightReports(orgId, filters),
    getInsightReport: (id: string, orgId: string) => analyticsInsightsAdapter.getInsightReport(id, orgId),
    createInsightReport: (report: any) => analyticsInsightsAdapter.createInsightReport(report),
    updateInsightReport: (id: string, updates: any, orgId: string) => analyticsInsightsAdapter.updateInsightReport(id, updates, orgId),
    deleteInsightReport: (id: string, orgId: string) => analyticsInsightsAdapter.deleteInsightReport(id, orgId),
    getLatestInsightSnapshot: (orgId: string, scope: string) => dbAnalyticsStorage.getLatestInsightSnapshot(orgId, scope),

    getAdminSessions: (orgId?: string) => dbSystemAdminStorage.getAdminSessions(orgId),
    createAdminSession: (session: any) => dbSystemAdminStorage.createAdminSession(session),
    updateAdminSession: (id: string, updates: any) => dbSystemAdminStorage.updateAdminSession(id, updates),
    deleteAdminSession: (id: string) => dbSystemAdminStorage.deleteAdminSession(id),
    getAdminSessionByToken: (tokenHash: string) => dbSystemAdminStorage.getAdminSessionByToken(tokenHash),
    updateAdminSessionActivity: (sessionId: string) => dbSystemAdminStorage.updateAdminSessionActivity(sessionId),
    invalidateAllAdminSessions: () => dbSystemAdminStorage.invalidateAllAdminSessions(),
    getAdminAuditEvents: (orgId?: string, filters?: any) => dbSystemAdminStorage.getAdminAuditEvents(orgId, filters),
    createAdminAuditEvent: (event: any) => dbSystemAdminStorage.createAdminAuditEvent(event),
    updateAdminAuditEvent: (id: string, updates: any) => dbSystemAdminStorage.updateAdminAuditEvent(id, updates),
    getAdminSystemSettings: (orgId?: string, category?: string) => dbSystemAdminStorage.getAdminSystemSettings(orgId, category),
    getAdminSystemSetting: (orgId: string, category: string, key: string) => dbSystemAdminStorage.getAdminSystemSetting(orgId, category, key),
    createAdminSystemSetting: (setting: any) => dbSystemAdminStorage.createAdminSystemSetting(setting),
    updateAdminSystemSetting: (id: string, setting: any) => dbSystemAdminStorage.updateAdminSystemSetting(id, setting),
    deleteAdminSystemSetting: (id: string) => dbSystemAdminStorage.deleteAdminSystemSetting(id),
    getIntegrationConfigs: (orgId?: string, type?: string) => dbSystemAdminStorage.getIntegrationConfigs(orgId, type),
    getIntegrationConfig: (id: string, orgId?: string) => dbSystemAdminStorage.getIntegrationConfig(id, orgId),
    createIntegrationConfig: (config: any) => dbSystemAdminStorage.createIntegrationConfig(config),
    updateIntegrationConfig: (id: string, config: any) => dbSystemAdminStorage.updateIntegrationConfig(id, config),
    deleteIntegrationConfig: (id: string) => dbSystemAdminStorage.deleteIntegrationConfig(id),
    updateIntegrationHealth: (id: string, healthStatus: string, errorMessage?: string) => dbSystemAdminStorage.updateIntegrationHealth(id, healthStatus, errorMessage),
    getMaintenanceWindows: (orgId?: string, status?: string) => dbSystemAdminStorage.getMaintenanceWindows(orgId, status),
    getMaintenanceWindow: (id: string, orgId?: string) => dbSystemAdminStorage.getMaintenanceWindow(id, orgId),
    createMaintenanceWindow: (window: any) => dbSystemAdminStorage.createMaintenanceWindow(window),
    updateMaintenanceWindow: (id: string, window: any) => dbSystemAdminStorage.updateMaintenanceWindow(id, window),
    deleteMaintenanceWindow: (id: string) => dbSystemAdminStorage.deleteMaintenanceWindow(id),
    getActiveMaintenanceWindows: (orgId?: string) => dbSystemAdminStorage.getActiveMaintenanceWindows(orgId),
    getSystemHealthChecks: (orgId?: string, category?: string) => dbSystemAdminStorage.getSystemHealthChecks(orgId, category),
    getSystemHealthCheck: (id: string, orgId?: string) => dbSystemAdminStorage.getSystemHealthCheck(id, orgId),
    createSystemHealthCheck: (check: any) => dbSystemAdminStorage.createSystemHealthCheck(check),
    updateSystemHealthCheck: (id: string, check: any, orgId: string) => dbSystemAdminStorage.updateSystemHealthCheck(id, check, orgId),
    deleteSystemHealthCheck: (id: string, orgId: string) => dbSystemAdminStorage.deleteSystemHealthCheck(id, orgId),
    updateHealthCheckStatus: (id: string, status: string, orgId: string, message?: string, responseTime?: number) => dbSystemAdminStorage.updateHealthCheckStatus(id, status, orgId, message, responseTime),
    getFailingHealthChecks: (orgId?: string) => dbSystemAdminStorage.getFailingHealthChecks(orgId),
    getMetricTrends: (orgId: string, metricName: string, hours: number) => dbSystemAdminStorage.getMetricTrends(orgId, metricName, hours),
    getSystemHealth: (orgId?: string) => dbSystemAdminStorage.getSystemHealth(orgId),

    getMlModels: (orgId?: string, modelType?: string) => dbMlAnalyticsStorage.getMlModels(orgId, modelType),
    getMlModel: (id: string) => dbMlAnalyticsStorage.getMlModel(id),
    createMlModel: (model: any) => dbMlAnalyticsStorage.createMlModel(model),
    updateMlModel: (id: string, updates: any) => dbMlAnalyticsStorage.updateMlModel(id, updates),
    deleteMlModel: (id: string) => dbMlAnalyticsStorage.deleteMlModel(id),
    getMlModelAccuracyHistory: (modelId: string) => dbMlAnalyticsStorage.getMlModelAccuracyHistory(modelId),
    createMlModelAccuracyHistory: (history: any) => dbMlAnalyticsStorage.createMlModelAccuracyHistory(history),
    getEngineerOverrides: (orgId: string, filters?: any) => dbMlAnalyticsStorage.getEngineerOverrides(orgId, filters),
    createEngineerOverride: (override: any, orgId: string) => dbMlAnalyticsStorage.createEngineerOverride(override, orgId),
    updateEngineerOverride: (id: string, updates: any, orgId: string) => dbMlAnalyticsStorage.updateEngineerOverride(id, updates, orgId),
    deleteEngineerOverride: (id: string, orgId: string) => dbMlAnalyticsStorage.deleteEngineerOverride(id, orgId),
    expireEngineerOverride: (id: string, expiredBy: string, orgId: string) => dbMlAnalyticsStorage.expireEngineerOverride(id, expiredBy, orgId),
    getRulModel: (id: string) => dbMlAnalyticsStorage.getRulModel?.(id),
    getRulModels: (orgId?: string) => dbMlAnalyticsStorage.getRulModels?.(orgId) ?? Promise.resolve([]),
    createRulModel: (model: any) => dbMlAnalyticsStorage.createRulModel?.(model),

    getEquipmentRegistry: (orgId?: string) => dbEquipmentStorage.getEquipmentRegistry(orgId),
    getEquipment: (orgId: string, equipmentId: string) => dbEquipmentStorage.getEquipment(orgId, equipmentId),
    getEquipmentHealth: (orgId: string, vesselId?: string, equipmentId?: string) => dbEquipmentStorage.getEquipmentHealth(orgId, { vesselId, equipmentId }),
    registerEquipment: (data: any) => dbEquipmentStorage.registerEquipment(data),
    createEquipment: (data: any) => dbEquipmentStorage.registerEquipment(data),
    updateEquipment: (id: string, updates: any, orgId?: string) => dbEquipmentStorage.updateEquipmentRegistry(id, updates, orgId || ''),
    updateEquipmentRegistry: (id: string, updates: any, orgId: string) => dbEquipmentStorage.updateEquipmentRegistry(id, updates, orgId),
    deleteEquipmentFromRegistry: (id: string, orgId: string) => dbEquipmentStorage.deleteEquipment(id, orgId),
    deleteEquipment: (id: string, orgId?: string) => dbEquipmentStorage.deleteEquipment(id, orgId),
    getVesselEquipment: (vesselId: string, orgId?: string) => dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || ''),
    getEquipmentByVessel: (vesselId: string, orgId?: string) => dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || ''),
    assignEquipmentToVessel: (vesselId: string, equipmentId: string, orgId?: string) => dbEquipmentStorage.associateEquipmentToVessel(equipmentId, vesselId, orgId || ''),
    unassignEquipmentFromVessel: (vesselId: string, equipmentId: string, orgId?: string) => dbEquipmentStorage.disassociateEquipmentFromVessel(equipmentId, orgId || ''),

    getUserById: (id: string) => dbUserStorage.getUser(id),
    getDeviceById: (id: string, orgId?: string) => dbDevicesStorage.getDevice(id, orgId),

    getOrganizations: () => dbUserStorage.getOrganizations(),
    getOrganization: (id: string) => dbUserStorage.getOrganization(id),
    getOrganizationBySlug: (slug: string) => dbUserStorage.getOrganizationBySlug(slug),
    createOrganization: (org: any) => dbUserStorage.createOrganization(org),
    updateOrganization: (id: string, updates: any) => dbUserStorage.updateOrganization(id, updates),
    deleteOrganization: (id: string) => dbUserStorage.deleteOrganization(id),
    getUsers: (orgId?: string) => dbUserStorage.getUsers(orgId),
    getUsersByOrg: (orgId: string) => dbUserStorage.getUsers(orgId),
    getUser: (id: string) => dbUserStorage.getUser(id),
    getUserByEmail: (email: string, orgId?: string) => dbUserStorage.getUserByEmail(email, orgId),
    createUser: (user: any) => dbUserStorage.createUser(user),
    updateUser: (id: string, updates: any) => dbUserStorage.updateUser(id, updates),
    deleteUser: (id: string) => dbUserStorage.deleteUser(id),

    getOptimizations: (orgId: string) => dbOptimizerStorage.getOptimizations(orgId),
    createOptimization: (data: any) => dbOptimizerStorage.createOptimization(data),

    getActiveDtcs: (equipmentId: string, orgId?: string) => dbDtcStorage.getActiveDtcs(equipmentId, orgId),
    getActiveDtcsBatch: (equipmentIds: string[], orgId?: string) => dbDtcStorage.getActiveDtcsBatch(equipmentIds, orgId),
    getDtcDefinitions: (spn?: number, fmi?: number, manufacturer?: string) => dbDtcStorage.getDtcDefinitions(spn, fmi, manufacturer),
    getDtcHistory: (equipmentId: string, orgId?: string, filters?: any) => dbDtcStorage.getDtcHistory(equipmentId, orgId, filters),
    upsertDtcFault: (fault: any) => dbDtcStorage.upsertDtcFault(fault),
    clearDtcFault: (equipmentId: string, spn: number, fmi: number, orgId?: string) => dbDtcStorage.clearDtcFault(equipmentId, spn, fmi, orgId),
    clearAllDtcFaults: (equipmentId: string, orgId?: string) => dbDtcStorage.clearAllDtcFaults(equipmentId, orgId),

    getNotificationSettings: (orgId?: string, filters?: any) => dbNotificationsStorage.getNotificationSettings(orgId, filters?.userId),
    getNotificationSettingById: async (id: string, orgId?: string) => { const all = await dbNotificationsStorage.getNotificationSettings(orgId); return (all as any[]).find((s: any) => s.id === id); },
    createNotificationSetting: (data: any) => dbNotificationsStorage.createNotificationSettings(data),
    updateNotificationSetting: (id: string, updates: any) => dbNotificationsStorage.updateNotificationSettings(id, updates),
    deleteNotificationSetting: (id: string) => dbNotificationsStorage.deleteNotificationSettings(id),
    getNotificationQueue: (orgId?: string, filters?: any) => dbNotificationsStorage.getEmailQueue(filters?.status),
    getNotificationQueueById: (id: string) => dbNotificationsStorage.getEmailQueueItem(id),
    createNotificationQueueItem: (item: any) => dbNotificationsStorage.createNotificationQueueItem?.(item) ?? Promise.resolve(item),
    deleteNotificationQueueItem: (id: string) => dbNotificationsStorage.deleteNotificationQueueItem?.(id) ?? Promise.resolve(),
    updateNotificationQueueItem: (id: string, updates: any) => dbNotificationsStorage.updateNotificationQueueItem?.(id, updates) ?? Promise.resolve(null),

    getErrorLogs: (filters?: any) => dbSystemAdminStorage.getErrorLogs(filters),
    createErrorLog: (log: any) => dbSystemAdminStorage.createErrorLog(log),
    deleteErrorLog: (id: string) => dbSystemAdminStorage.deleteErrorLog(id),
    clearErrorLogs: (olderThan?: Date) => dbSystemAdminStorage.clearErrorLogs(olderThan),

    getTransportSettings: async () => undefined,
    createTransportSettings: async (settings: any) => ({ id: `ts-${Date.now()}`, ...settings, createdAt: new Date() }),
    updateTransportSettings: async (id: string, settings: any) => ({ id, ...settings, updatedAt: new Date() }),

    getKbDocs: (orgId?: string) => analyticsInsightsAdapter.getKbDocs?.(orgId) ?? Promise.resolve([]),

    getContextEvents: (orgId: string, filters?: any) => analyticsInsightsAdapter.getContextEvents?.(orgId, filters) ?? Promise.resolve([]),
    createContextEvent: (event: any) => analyticsInsightsAdapter.createContextEvent?.(event) ?? Promise.resolve(event),
    deleteContextEvent: (id: string, orgId: string) => analyticsInsightsAdapter.deleteContextEvent?.(id, orgId) ?? Promise.resolve(),
    getReplaySessions: (orgId: string) => analyticsInsightsAdapter.getReplaySessions?.(orgId) ?? Promise.resolve([]),
    createReplaySession: (session: any) => analyticsInsightsAdapter.createReplaySession?.(session) ?? Promise.resolve(session),

    getAcousticHistory: (equipmentId: string, orgId?: string) => dbSensorsStorage.getAcousticHistory?.(equipmentId, orgId) ?? Promise.resolve([]),
  } as any;
}

const storage = createStorageFacade();
export { storage };

export { DatabaseStorage } from "./storage/db-storage";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  const maxRetries = 3;
  const connectionTimeout = 30000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  Attempting database connection (attempt ${attempt}/${maxRetries})...`);
      await withTimeout(db.select().from(devices).limit(1), connectionTimeout, "Database connection check");
      console.log("  Database connection verified");
      
      if (!isLocalMode) {
        console.log("PostgreSQL mode: Running TimescaleDB and view setup...");
        const { ensureTimescaleDBSetup } = await import("./timescaledb-bootstrap");
        await withTimeout(ensureTimescaleDBSetup(), 60000, "TimescaleDB setup");
        
        const { createDatabaseViews, verifyDatabaseViews } = await import("./schema-views");
        await withTimeout(createDatabaseViews(), 60000, "Create database views");
        const viewVerification = await withTimeout(verifyDatabaseViews(), 30000, "Verify database views");
        if (!viewVerification.success) {
          console.error("Database view verification failed:", viewVerification.errors);
          throw new Error("Essential database views are not functioning properly");
        }
        
        await withTimeout(dbInventoryStorage.seedStockForParts("default-org-id"), 30000, "Seed stock data");
        
        const { createDatabaseIndexes, analyzeDatabasePerformance } = await import("./db-indexes");
        await withTimeout(createDatabaseIndexes(), 60000, "Create database indexes");
        
        if (process.env.NODE_ENV === "development") {
          await withTimeout(analyzeDatabasePerformance(), 30000, "Analyze database performance");
        }
      } else {
        console.log("SQLite mode: Skipping PostgreSQL-specific setup (TimescaleDB, views, indexes)");
        console.log("Database ready for offline-first operation");
      }
      return;
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      console.warn(`  Database initialization attempt ${attempt} failed:`, error.message);
      
      if (!isLastAttempt) {
        const delay = attempt * 5000;
        console.log(`  Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error("Database initialization failed after all retries:", error);
        if (process.env.EMBEDDED_MODE === "true" || process.env.LOCAL_MODE === "true") {
          console.error("Embedded/local mode: Continuing despite initialization error");
          return;
        }
        throw error;
      }
    }
  }
}

export async function initializeSampleData(): Promise<void> {
  try {
    const existingDevices = await dbDevicesStorage.getDevices();
    if (existingDevices.length > 0) { return; }
    
    const sampleDevices = [
      { id: "DEV-001", vessel: "MV Atlantic", buses: JSON.stringify(["CAN1", "CAN2"]), sensors: JSON.stringify([{ id: "ENG1", type: "engine", metrics: ["rpm", "temp", "pressure"] }, { id: "GEN1", type: "generator", metrics: ["voltage", "current", "frequency"] }]), config: JSON.stringify({ sampling_rate: 1000, buffer_size: 10000 }), hmacKey: null },
      { id: "DEV-002", vessel: "MV Pacific", buses: JSON.stringify(["CAN1"]), sensors: JSON.stringify([{ id: "ENG2", type: "engine", metrics: ["rpm", "temp", "pressure"] }]), config: JSON.stringify({ sampling_rate: 500, buffer_size: 5000 }), hmacKey: null },
      { id: "DEV-003", vessel: "MV Arctic", buses: JSON.stringify(["CAN1", "CAN2", "CAN3"]), sensors: JSON.stringify([{ id: "ENG3", type: "engine", metrics: ["rpm", "temp", "pressure"] }, { id: "GEN2", type: "generator", metrics: ["voltage", "current", "frequency"] }, { id: "PUMP1", type: "pump", metrics: ["flow", "pressure", "vibration"] }]), config: JSON.stringify({ sampling_rate: 2000, buffer_size: 20000 }), hmacKey: null }
    ];
    for (const device of sampleDevices) { await db.insert(devices).values(device); }
    
    const sampleAlertConfigurations = [
      { id: "ALERT-001", orgId: "default-org-id", vesselId: "MV Atlantic", equipmentId: "ENG1", sensorType: "temperature", warningThreshold: 80, criticalThreshold: 95, enabled: true, notifyEmail: true, notifyInApp: true },
      { id: "ALERT-002", orgId: "default-org-id", vesselId: "MV Atlantic", equipmentId: "GEN1", sensorType: "voltage", warningThreshold: 390, criticalThreshold: 380, enabled: true, notifyEmail: false, notifyInApp: true },
      { id: "ALERT-003", orgId: "default-org-id", vesselId: "MV Arctic", equipmentId: "PUMP1", sensorType: "vibration", warningThreshold: 2, criticalThreshold: 3, enabled: true, notifyEmail: false, notifyInApp: true }
    ];
    for (const config of sampleAlertConfigurations) { await db.insert(alertConfigurations).values(config); }
  } catch (error) {
    console.error("Failed to initialize sample data:", error);
    throw error;
  }
}
