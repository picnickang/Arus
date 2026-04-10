import { db, isLocalMode } from "./db-config";
import { devices, alertConfigurations, skills } from "@shared/schema-runtime";
import { eq, sql } from "drizzle-orm";

export type { WorkOrderFilters, IStorage } from "./storage/interfaces/storage.types";

import {
  dbDevicesStorage, dbWorkOrderStorage, dbEquipmentStorage, dbVesselStorage,
  dbAlertStorage, dbInventoryStorage, dbCrewStorage, dbCrewExtensionsStorage,
  dbSensorsStorage, dbTelemetryStorage, dbMlAnalyticsStorage, dbMaintenanceStorage,
  dbAnalyticsStorage, dbSystemAdminStorage,
  dbDtcStorage, dbNotificationsStorage, dbChecklistsStorage, dbStcwStorage,
  dbUserStorage, dbStormGeoStorage,
  dbSchedulerStorage, workOrderService, vesselService,
  deckLogStorage, engineLogStorage, analyticsInsightsAdapter, schedulingAdapter,
} from "./repositories";

function createStorageFacade() {
  return {
    validateOrgId(orgId: string | undefined, operation: string): asserts orgId is string {
      if (!orgId || orgId.trim() === "") { throw new Error(`[Security] orgId is required for ${operation}. This is a critical multi-tenant isolation error.`); }
    },

    getDevices: (orgId?: string) => dbDevicesStorage.getDevices(orgId),
    getDevice: (id: string, orgId?: string) => dbDevicesStorage.getDevice(id, orgId),
    getPdmScores: (equipmentId: string | undefined, orgId: string) => dbDevicesStorage.getPdmScores(equipmentId, orgId),

    getWorkOrders: (equipmentId?: string, orgId?: string, filters?: any) => workOrderService.getWorkOrdersWithDetails(equipmentId, orgId, filters),
    getWorkOrderById: (id: string, orgId: string) => workOrderService.getWorkOrderById(id, orgId),
    generateWorkOrderNumber: (orgId: string) => workOrderService.generateWorkOrderNumber(orgId),
    createWorkOrder: (order: any) => workOrderService.createWorkOrder(order),
    updateWorkOrder: (id: string, updates: any) => workOrderService.updateWorkOrderWithDowntimeTracking(id, updates),
    getWorkOrderCompletions: (filters?: any) => dbWorkOrderStorage.getWorkOrderCompletions(filters),

    createTelemetryReading: (reading: any) => dbTelemetryStorage.createTelemetryReading(reading),
    getTelemetryHistory: (arg1: string, arg2: string, arg3?: any, arg4?: any, arg5?: any) => dbTelemetryStorage.getTelemetryHistory(arg1, arg2, arg3, arg4, arg5),
    getTelemetryByEquipmentAndDateRange: (equipmentId: string, startDate: Date, endDate: Date, orgId?: string) => dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(equipmentId, startDate, endDate, orgId),
    getLatestTelemetryReadings: (vesselId?: string, equipmentId?: string, sensorType?: string, limit?: number, _orgId?: string) => dbTelemetryStorage.getLatestTelemetryReadings(equipmentId, limit || 500, vesselId, sensorType),
    upsertTelemetry: (reading: any) => dbTelemetryStorage.createTelemetryReading(reading),
    getTelemetry: (eqId: string, _orgId?: string) => dbTelemetryStorage.getLatestTelemetryReadings(eqId, 500),

    getSensorConfigurations: (orgId?: string, equipmentId?: string, sensorType?: string) => dbSensorsStorage.getSensorConfigurations(orgId, equipmentId, sensorType),
    getSensorConfiguration: (equipmentId: string, sensorType: string, orgId?: string) => dbSensorsStorage.getSensorConfiguration(equipmentId, sensorType, orgId),
    createSensorConfiguration: (config: any) => dbSensorsStorage.createSensorConfiguration(config),
    updateSensorConfiguration: (equipmentId: string, sensorType: string, config: any, orgId?: string) => dbSensorsStorage.updateSensorConfiguration(equipmentId, sensorType, config, orgId),

    getAlertConfigurations: (equipmentId?: string) => dbAlertStorage.getAlertConfigurations(equipmentId),
    createAlertConfiguration: (config: any) => dbAlertStorage.createAlertConfiguration(config),
    updateAlertConfiguration: (id: string, config: any, orgId?: string) => dbAlertStorage.updateAlertConfiguration(id, config, orgId),
    getAlertNotifications: (acknowledged?: boolean, orgId?: string) => dbAlertStorage.getAlertNotifications(acknowledged, orgId),
    createAlertNotification: (notification: any) => dbAlertStorage.createAlertNotification(notification),
    hasRecentAlert: (equipmentId: string, sensorType: string, alertType: string, minutesBack?: number) => dbAlertStorage.hasRecentAlert(equipmentId, sensorType, alertType, minutesBack),
    isAlertSuppressed: (equipmentId: string, sensorType: string, alertType: string) => dbAlertStorage.isAlertSuppressed(equipmentId, sensorType, alertType),

    getSettings: () => dbSystemAdminStorage.getSettings(),
    getSystemSettings: () => dbSystemAdminStorage.getSettings(),

    createCrewRestSheet: (sheet: any) => dbStcwStorage.createCrewRestSheet(sheet),
    upsertCrewRestDay: (sheetId: string, dayData: any) => dbStcwStorage.upsertCrewRestDay(sheetId, dayData),
    getCrewRestRange: (crewId: string, startDate: string, endDate: string) => dbStcwStorage.getCrewRestRange(crewId, startDate, endDate),
    getCrewRestByDateRange: (vesselId?: string, startDate?: string, endDate?: string, complianceFilter?: boolean) => dbStcwStorage.getCrewRestByDateRange(vesselId, startDate, endDate, complianceFilter),
    markSchedulerRunHorGenerated: (runId: string) => dbSchedulerStorage.markSchedulerRunHorGenerated(runId),

    getWorkOrderWorklogs: (workOrderId?: string, orgId?: string) => dbChecklistsStorage.getWorkOrderWorklogs(workOrderId, orgId),

    getParts: (orgId?: string) => dbInventoryStorage.getParts(orgId),
    getPartsInventory: (category?: string, orgId?: string, search?: string, sortBy?: string, sortOrder?: "asc" | "desc") => dbInventoryStorage.getPartsInventory(category, orgId, search, sortBy, sortOrder),
    getPartById: (id: string, orgId?: string) => dbInventoryStorage.getPartById(id, orgId),
    createPartInventory: (part: any) => dbInventoryStorage.createPartsInventory(part),
    getPartByNumber: (partNo: string, orgId?: string) => orgId ? dbInventoryStorage.getPartByPartNumber(partNo, orgId) : Promise.resolve(undefined),
    getStockByPart: (partId: string, orgId?: string) => dbInventoryStorage.getStockByPart(partId, orgId),
    getWorkOrderParts: (workOrderId?: string, orgId?: string) => workOrderId ? dbWorkOrderStorage.getWorkOrderParts(workOrderId, orgId) : Promise.resolve([]),
    getWorkOrderPartsByEquipment: (orgId: string, equipmentId: string) => dbInventoryStorage.getWorkOrderPartsByEquipment(orgId, equipmentId),
    getWorkOrderPartsByPartId: (orgId: string, partId: string) => dbInventoryStorage.getWorkOrderPartsByPartId(orgId, partId),

    getMaintenanceSchedules: (equipmentId?: string, orgId?: string, filters?: any) => dbMaintenanceStorage.getMaintenanceSchedules(equipmentId, orgId, filters),
    getMaintenanceSchedule: (id: string) => dbMaintenanceStorage.getMaintenanceSchedule(id),
    createMaintenanceSchedule: (schedule: any) => dbMaintenanceStorage.createMaintenanceSchedule(schedule),
    updateMaintenanceSchedule: (id: string, updates: any) => dbMaintenanceStorage.updateMaintenanceSchedule(id, updates),
    getMaintenanceRecords: (equipmentId?: string, orgId?: string, filters?: any) => dbMaintenanceStorage.getMaintenanceRecords(equipmentId, orgId, filters),
    autoScheduleMaintenance: (equipmentId: string, pdmScore: number) => schedulingAdapter.autoScheduleMaintenance(equipmentId, pdmScore),

    getCrew: (orgId?: string, vesselId?: string) => dbCrewStorage.getCrew(orgId, vesselId),
    getCrewMember: (id: string, orgId?: string) => dbCrewStorage.getCrewMember(id, orgId),
    getCrewMembers: (orgId?: string) => dbCrewStorage.getCrew(orgId),
    getAllCrew: (orgId?: string) => dbCrewStorage.getCrew(orgId),

    getDeckLogDaily: (orgId: string, filters?: any) => deckLogStorage.getDeckLogDaily(orgId, filters),
    getDeckLogDailyByDate: (vesselId: string, logDate: string, orgId: string) => deckLogStorage.getDeckLogDailyByDate(vesselId, logDate, orgId),
    createDeckLogDaily: (entry: any) => deckLogStorage.createDeckLogDaily(entry),
    upsertDeckLogHourly: (entry: any) => deckLogStorage.upsertDeckLogHourly(entry),
    createDeckLogEvent: (event: any) => deckLogStorage.createDeckLogEvent(event),

    getEngineLogDaily: (orgId: string, filters?: any) => engineLogStorage.getEngineLogDaily(orgId, filters),
    getEngineLogDailyByDate: (vesselId: string, logDate: string, orgId: string) => engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId),
    createEngineLogDaily: (entry: any) => engineLogStorage.createEngineLogDaily(entry),
    updateEngineLogDaily: (id: string, entry: any, orgId: string) => engineLogStorage.updateEngineLogDaily(id, entry, orgId),
    getEngineLogHourly: (dailyLogId: string, orgId: string) => engineLogStorage.getEngineLogHourly(dailyLogId, orgId),
    upsertEngineLogHourly: (entry: any) => engineLogStorage.upsertEngineLogHourly(entry),
    getEngineLogGenerator: (dailyLogId: string, orgId: string) => engineLogStorage.getEngineLogGenerator(dailyLogId, orgId),
    upsertEngineLogGenerator: (entry: any) => engineLogStorage.upsertEngineLogGenerator(entry),
    createEngineLogEvent: (event: any) => engineLogStorage.createEngineLogEvent(event),

    getStormgeoSettings: (orgId: string, vesselId?: string) => dbStormGeoStorage.getStormgeoSettings(orgId, vesselId),
    createStormgeoSettings: (settings: any) => dbStormGeoStorage.createStormgeoSettings(settings),
    updateStormgeoSettings: (id: string, settings: any, orgId: string) => dbStormGeoStorage.updateStormgeoSettings(id, settings, orgId),
    getStormgeoSnapshots: (orgId: string, filters?: any) => dbStormGeoStorage.getStormgeoSnapshots(orgId, filters),
    getStormgeoSnapshotForTime: (vesselId: string, forecastTime: Date, orgId: string) => dbStormGeoStorage.getStormgeoSnapshotForTime(vesselId, forecastTime, orgId),
    createStormgeoSnapshot: (snapshot: any) => dbStormGeoStorage.createStormgeoSnapshot(snapshot),
    bulkCreateStormgeoSnapshots: (snapshots: any[]) => dbStormGeoStorage.bulkCreateStormgeoSnapshots(snapshots),
    createDeckLogHourlyAutoFill: (autoFill: any) => dbStormGeoStorage.createDeckLogHourlyAutoFill(autoFill),
    getStormgeoImportHistory: (orgId: string, filters?: any) => dbStormGeoStorage.getStormgeoImportHistory(orgId, filters),
    createStormgeoImportHistory: (history: any) => dbStormGeoStorage.createStormgeoImportHistory(history),
    updateStormgeoImportHistory: (id: string, history: any, orgId: string) => dbStormGeoStorage.updateStormgeoImportHistory(id, history, orgId),

    getCrewCertifications: (crewId: string, orgId: string) => dbCrewExtensionsStorage.getCrewCertifications(crewId, orgId),

    getComplianceFindings: async (orgId: string, filters?: any) => { const result = await db.execute(sql`SELECT * FROM compliance_findings WHERE org_id = ${orgId} ${filters?.vesselId ? sql`AND vessel_id = ${filters.vesselId}` : sql``} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.severity ? sql`AND severity = ${filters.severity}` : sql``} ${filters?.status ? sql`AND status = ${filters.status}` : sql``} ${filters?.ruleCode ? sql`AND rule_code = ${filters.ruleCode}` : sql``} ${filters?.startDate ? sql`AND found_at >= ${filters.startDate}::timestamp` : sql``} ${filters?.endDate ? sql`AND found_at <= ${filters.endDate}::timestamp` : sql``} ORDER BY found_at DESC`); return result.rows; },
    getComplianceRules: async (orgId: string, filters?: any) => { const result = await db.execute(sql`SELECT * FROM compliance_rules WHERE org_id = ${orgId} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.category ? sql`AND category = ${filters.category}` : sql``} ${filters?.enabled !== undefined ? sql`AND enabled = ${filters.enabled}` : sql``} ORDER BY rule_name ASC`); return result.rows; },
    createComplianceFinding: async (data: any) => { const result = await db.execute(sql`INSERT INTO compliance_findings (org_id, vessel_id, source_type, severity, status, rule_code, title, description, found_at) VALUES (${data.orgId}, ${data.vesselId}, ${data.sourceType}, ${data.severity}, ${data.status || 'open'}, ${data.ruleCode}, ${data.title}, ${data.description}, NOW()) RETURNING *`); return result.rows[0]; },
    createComplianceRule: async (data: any) => { const result = await db.execute(sql`INSERT INTO compliance_rules (org_id, source_type, category, rule_name, rule_code, description, severity, enabled) VALUES (${data.orgId}, ${data.sourceType}, ${data.category}, ${data.ruleName}, ${data.ruleCode}, ${data.description}, ${data.severity}, ${data.enabled ?? true}) RETURNING *`); return result.rows[0]; },
    resolveComplianceFinding: async (id: string, orgId: string) => { const result = await db.execute(sql`UPDATE compliance_findings SET status = 'resolved', resolved_at = NOW() WHERE id = ${id} AND org_id = ${orgId} RETURNING *`); return result.rows[0]; },
    acknowledgeComplianceFinding: async (id: string, orgId: string) => { const result = await db.execute(sql`UPDATE compliance_findings SET status = 'acknowledged' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`); return result.rows[0]; },
    suppressComplianceFinding: async (id: string, orgId: string) => { const result = await db.execute(sql`UPDATE compliance_findings SET status = 'suppressed' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`); return result.rows[0]; },

    getVessels: (orgId?: string) => vesselService.getVessels(orgId),
    getVessel: (id: string, orgId?: string) => vesselService.getVessel(id, orgId),
    createVessel: (vessel: any) => vesselService.createVessel(vessel),
    updateVessel: (id: string, updates: any, orgId: string) => vesselService.updateVessel(id, updates, orgId),

    getPortCalls: (vesselId?: string, orgId?: string) => vesselId && orgId ? dbVesselStorage.getPortCalls(vesselId, orgId) : dbVesselStorage.getAllPortCalls(orgId),
    getDrydockWindows: (orgId?: string, vesselId?: string) => vesselId && orgId ? dbVesselStorage.getDrydockWindows(vesselId, orgId) : dbVesselStorage.getAllDrydockWindows(orgId),

    getShiftTemplates: (orgId?: string) => dbCrewStorage.getShiftTemplates(orgId),
    getCrewAssignments: (orgId: string, date?: string, vesselId?: string) => dbCrewStorage.getCrewAssignments(orgId, date, vesselId),
    createCrewAssignment: (data: any) => dbCrewStorage.createCrewAssignment(data),
    getCrewAssignmentsByDateRange: (from: Date, to: Date, orgId?: string) => dbCrewStorage.getCrewAssignmentsByDateRange(from, to, orgId),
    deleteCrewAssignmentsByRunId: (orgId: string, runId: string) => dbCrewStorage.deleteCrewAssignmentsByRunId(orgId, runId),
    getCrewLeave: (crewId: string, orgId: string) => dbCrewStorage.getCrewLeave(crewId, orgId),
    getCrewSkills: (crewId: string) => dbCrewStorage.getCrewSkills(crewId),

    getSchedulerRuns: (orgId: string, limit?: number) => dbSchedulerStorage.getSchedulerRuns(orgId, undefined, limit),
    getSchedulerRun: (id: string) => dbSchedulerStorage.getSchedulerRun(id),
    getScheduleAssignmentsByRun: (runId: string) => dbSchedulerStorage.getScheduleAssignmentsByRun(runId),
    createSchedulerRun: (run: any) => dbSchedulerStorage.createSchedulerRun(run),
    deleteSchedulerRuns: (orgId: string) => dbSchedulerStorage.deleteSchedulerRuns(orgId),
    deleteScheduleAssignmentsByOrg: (orgId: string) => dbSchedulerStorage.deleteScheduleAssignmentsByOrg(orgId),
    deleteScheduleUnfilledByOrg: (orgId: string) => dbSchedulerStorage.deleteScheduleUnfilledByOrg(orgId),
    deleteScheduleAssignmentsByDateRange: (orgId: string, from: Date, to: Date) => dbSchedulerStorage.deleteScheduleAssignmentsByDateRange(orgId, from, to),
    findRecentSchedulerRunByHash: (orgId: string, hash: string) => dbSchedulerStorage.findRecentSchedulerRunByHash(orgId, hash),
    createBulkScheduleAssignments: (assignments: any[]) => dbSchedulerStorage.createBulkScheduleAssignments(assignments),
    createBulkScheduleUnfilled: (unfilled: any[]) => dbSchedulerStorage.createBulkScheduleUnfilled(unfilled),
    updateSchedulerRun: (id: string, updates: any) => dbSchedulerStorage.updateSchedulerRun(id, updates),
    getSchedulingSettings: (orgId: string) => dbSchedulerStorage.getSchedulingSettings(orgId),
    getSchedulingSettingsByVessel: (orgId: string, vesselId: string) => dbSchedulerStorage.getSchedulingSettingsByVessel(orgId, vesselId),

    createInsightSnapshot: (snapshot: any) => analyticsInsightsAdapter.createInsightSnapshot(snapshot),
    getLatestInsightSnapshot: (orgId: string, scope: string) => dbAnalyticsStorage.getLatestInsightSnapshot(orgId, scope),

    getAdminSessionByToken: (tokenHash: string) => dbSystemAdminStorage.getAdminSessionByToken(tokenHash),
    updateAdminSessionActivity: (sessionId: string) => dbSystemAdminStorage.updateAdminSessionActivity(sessionId),
    createAdminAuditEvent: (event: any) => dbSystemAdminStorage.createAdminAuditEvent(event),
    updateAdminAuditEvent: (id: string, updates: any) => dbSystemAdminStorage.updateAdminAuditEvent(id, updates),

    getMlModels: (orgId?: string, modelType?: string) => dbMlAnalyticsStorage.getMlModels(orgId, modelType),
    getMlModel: (id: string) => dbMlAnalyticsStorage.getMlModel(id),
    createMlModel: (model: any) => dbMlAnalyticsStorage.createMlModel(model),
    updateMlModel: (id: string, updates: any) => dbMlAnalyticsStorage.updateMlModel(id, updates),
    deleteMlModel: (id: string) => dbMlAnalyticsStorage.deleteMlModel(id),
    getMlModelAccuracyHistory: (modelId: string) => dbMlAnalyticsStorage.getMlModelAccuracyHistory(modelId),
    getEngineerOverrides: (orgId: string, filters?: any) => dbMlAnalyticsStorage.getEngineerOverrides(orgId, filters),
    createEngineerOverride: (override: any, orgId: string) => dbMlAnalyticsStorage.createEngineerOverride(override, orgId),

    getEquipmentRegistry: (orgId?: string) => dbEquipmentStorage.getEquipmentRegistry(orgId),
    getEquipment: (orgId: string, equipmentId: string) => dbEquipmentStorage.getEquipment(orgId, equipmentId),
    getEquipmentHealth: (orgId: string, vesselId?: string, equipmentId?: string) => dbEquipmentStorage.getEquipmentHealth(orgId, { vesselId, equipmentId }),
    createEquipment: (data: any) => dbEquipmentStorage.registerEquipment(data),
    updateEquipment: (id: string, updates: any, orgId?: string) => dbEquipmentStorage.updateEquipmentRegistry(id, updates, orgId || ''),
    getVesselEquipment: (vesselId: string, orgId?: string) => dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || ''),
    getEquipmentByVessel: (vesselId: string, orgId?: string) => dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId || ''),
    assignEquipmentToVessel: (vesselId: string, equipmentId: string, orgId?: string) => dbEquipmentStorage.associateEquipmentToVessel(equipmentId, vesselId, orgId || ''),
    unassignEquipmentFromVessel: (vesselId: string, equipmentId: string, orgId?: string) => dbEquipmentStorage.disassociateEquipmentFromVessel(equipmentId, orgId || ''),

    getDeviceById: (id: string, orgId?: string) => dbDevicesStorage.getDevice(id, orgId),

    getOrganization: (id: string) => dbUserStorage.getOrganization(id),
    createOrganization: (org: any) => dbUserStorage.createOrganization(org),
    updateOrganization: (id: string, updates: any) => dbUserStorage.updateOrganization(id, updates),
    getUsers: (orgId?: string) => dbUserStorage.getUsers(orgId),
    getUsersByOrg: (orgId: string) => dbUserStorage.getUsers(orgId),
    getUser: (id: string) => dbUserStorage.getUser(id),
    getUserByEmail: (email: string, orgId?: string) => dbUserStorage.getUserByEmail(email, orgId),
    createUser: (user: any) => dbUserStorage.createUser(user),

    getActiveDtcs: (equipmentId: string, orgId?: string) => dbDtcStorage.getActiveDtcs(equipmentId, orgId),

    getNotificationSettings: (orgId?: string, filters?: any) => dbNotificationsStorage.getNotificationSettings(orgId, filters?.userId),
    getNotificationQueue: (orgId?: string, filters?: any) => dbNotificationsStorage.getEmailQueue(filters?.status, undefined, orgId),
    createNotificationQueueItem: (item: any) => dbNotificationsStorage.createEmailQueueItem(item),
    updateNotificationQueueItem: (id: string, updates: any) => dbNotificationsStorage.updateEmailQueueItem(id, updates),

    getKbDocs: (orgId?: string) => analyticsInsightsAdapter.getKbDocs(orgId),

  };
}

const storage = createStorageFacade();
export { storage };

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
