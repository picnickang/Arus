/**
 * Core mode-aware table exports for schema-runtime.
 */

import {
  cloudOnly,
  IS_POSTGRES,
  isLocalMode,
  pgSchema,
  pickSchema,
  sqliteSync,
  sqliteVessel,
} from "./schema-runtime-table-helpers";

// ============================================================================
// MODE-AWARE TABLE EXPORTS (All 173 tables)
// Each table uses ternary expression to select correct schema at runtime
// ============================================================================

// Sync Tables (from schema-sqlite-sync)
export const organizations = pickSchema(
  isLocalMode,
  sqliteSync.organizationsSqlite,
  pgSchema.organizations
);
export const users = pickSchema(isLocalMode, sqliteSync.usersSqlite, pgSchema.users);
export const syncJournal = pickSchema(
  isLocalMode,
  sqliteSync.syncJournalSqlite,
  pgSchema.syncJournal
);
export const syncOutbox = pickSchema(isLocalMode, sqliteSync.syncOutboxSqlite, pgSchema.syncOutbox);

// Equipment & Devices
export const vessels = pickSchema(isLocalMode, sqliteVessel.vesselsSqlite, pgSchema.vessels);
export const equipment = pickSchema(isLocalMode, sqliteVessel.equipmentSqlite, pgSchema.equipment);
export const devices = pickSchema(isLocalMode, sqliteVessel.devicesSqlite, pgSchema.devices);
export const equipmentTelemetry = pickSchema(
  isLocalMode,
  sqliteVessel.equipmentTelemetrySqlite,
  pgSchema.equipmentTelemetry
);
export const equipmentLifecycle = pickSchema(
  isLocalMode,
  sqliteVessel.equipmentLifecycleSqlite,
  pgSchema.equipmentLifecycle
);
export const performanceMetrics = pickSchema(
  isLocalMode,
  sqliteVessel.performanceMetricsSqlite,
  pgSchema.performanceMetrics
);
export const rawTelemetry = pickSchema(
  isLocalMode,
  sqliteVessel.rawTelemetrySqlite,
  pgSchema.rawTelemetry
);
export const deviceRegistry = cloudOnly(pgSchema.deviceRegistry);
export const equipmentDecommissionEvents = cloudOnly(pgSchema.equipmentDecommissionEvents); // Cloud-only table
export const vesselDiagrams = cloudOnly(pgSchema.vesselDiagrams);
export const vesselDiagramVersions = cloudOnly(pgSchema.vesselDiagramVersions);
export const vesselSectionMaps = cloudOnly(pgSchema.vesselSectionMaps);
export const vesselSections = cloudOnly(pgSchema.vesselSections);
export const vesselSectionPolygons = cloudOnly(pgSchema.vesselSectionPolygons);
export const vesselSectionEquipmentAssignments = cloudOnly(
  pgSchema.vesselSectionEquipmentAssignments
);
export const vesselThumbnailOverrides = cloudOnly(pgSchema.vesselThumbnailOverrides);
export const vesselDiagramValidationResults = cloudOnly(pgSchema.vesselDiagramValidationResults);

// Work Orders & Maintenance
export const workOrders = pickSchema(
  isLocalMode,
  sqliteVessel.workOrdersSqlite,
  pgSchema.workOrders
);
export const workOrderCompletions = pickSchema(
  isLocalMode,
  sqliteVessel.workOrderCompletionsSqlite,
  pgSchema.workOrderCompletions
);
export const workOrderParts = pickSchema(
  isLocalMode,
  sqliteVessel.workOrderPartsSqlite,
  pgSchema.workOrderParts
);
export const workOrderChecklists = pickSchema(
  isLocalMode,
  sqliteVessel.workOrderChecklistsSqlite,
  pgSchema.workOrderChecklists
);
export const workOrderWorklogs = pickSchema(
  isLocalMode,
  sqliteVessel.workOrderWorklogsSqlite,
  pgSchema.workOrderWorklogs
);
export const workOrderTasks = pickSchema(
  isLocalMode,
  sqliteVessel.workOrderTasksSqlite,
  pgSchema.workOrderTasks
);
export const workOrderHistory = pickSchema(
  isLocalMode,
  sqliteVessel.workOrderHistorySqlite,
  pgSchema.workOrderHistory
);
export const maintenanceSchedules = pickSchema(
  isLocalMode,
  sqliteVessel.maintenanceSchedulesSqlite,
  pgSchema.maintenanceSchedules
);
export const maintenanceRecords = pickSchema(
  isLocalMode,
  sqliteVessel.maintenanceRecordsSqlite,
  pgSchema.maintenanceRecords
);
export const maintenanceCosts = pickSchema(
  isLocalMode,
  sqliteVessel.maintenanceCostsSqlite,
  pgSchema.maintenanceCosts
);
export const maintenanceTemplates = pickSchema(
  isLocalMode,
  sqliteVessel.maintenanceTemplatesSqlite,
  pgSchema.maintenanceTemplates
);
export const maintenanceChecklistItems = pickSchema(
  isLocalMode,
  sqliteVessel.maintenanceChecklistItemsSqlite,
  pgSchema.maintenanceChecklistItems
);
export const maintenanceChecklistCompletions = pickSchema(
  isLocalMode,
  sqliteVessel.maintenanceChecklistCompletionsSqlite,
  pgSchema.maintenanceChecklistCompletions
);
export const maintenanceWindows = pickSchema(
  isLocalMode,
  sqliteVessel.maintenanceWindowsSqlite,
  pgSchema.maintenanceWindows
);
export const downtimeEvents = pickSchema(
  isLocalMode,
  sqliteVessel.downtimeEventsSqlite,
  pgSchema.downtimeEvents
);

// Inventory & Parts
export const parts = pickSchema(isLocalMode, sqliteVessel.partsSqlite, pgSchema.parts);
export const partsInventory = pickSchema(
  isLocalMode,
  sqliteVessel.partsInventorySqlite,
  pgSchema.partsInventory
);
export const partsInventorySuppliers = cloudOnly(pgSchema.partsInventorySuppliers); // Cloud-only junction table (multi-supplier support)
export const stock = pickSchema(isLocalMode, sqliteVessel.stockSqlite, pgSchema.stock);
export const inventoryMovements = pickSchema(
  isLocalMode,
  sqliteVessel.inventoryMovementsSqlite,
  pgSchema.inventoryMovements
);
export const suppliers = pickSchema(isLocalMode, sqliteVessel.suppliersSqlite, pgSchema.suppliers);
export const serviceOrders = cloudOnly(pgSchema.serviceOrders);
export const purchaseOrders = pickSchema(
  isLocalMode,
  sqliteVessel.purchaseOrdersSqlite,
  pgSchema.purchaseOrders
);
export const purchaseOrderItems = pickSchema(
  isLocalMode,
  sqliteVessel.purchaseOrderItemsSqlite,
  pgSchema.purchaseOrderItems
);
// Cloud-only: no SQLite (vessel) variant — PO event history is shore-side.
export const purchaseOrderEvents = cloudOnly(pgSchema.purchaseOrderEvents);
export const purchaseRequests = cloudOnly(pgSchema.purchaseRequests);
export const purchaseRequestItems = cloudOnly(pgSchema.purchaseRequestItems);
export const serviceRequests = cloudOnly(pgSchema.serviceRequests);
export const partSubstitutions = pickSchema(
  isLocalMode,
  sqliteVessel.partSubstitutionsSqlite,
  pgSchema.partSubstitutions
);
export const partFailureHistory = pickSchema(
  isLocalMode,
  sqliteVessel.partFailureHistorySqlite,
  pgSchema.partFailureHistory
);
export const reservations = pickSchema(
  isLocalMode,
  sqliteVessel.reservationsSqlite,
  pgSchema.reservations
);

// Crew Management
export const crew = pickSchema(isLocalMode, sqliteVessel.crewSqlite, pgSchema.crew);
export const skills = pickSchema(isLocalMode, sqliteVessel.skillsSqlite, pgSchema.skills);
export const crewSkill = pickSchema(isLocalMode, sqliteVessel.crewSkillSqlite, pgSchema.crewSkill);
export const crewAssignment = pickSchema(
  isLocalMode,
  sqliteVessel.crewAssignmentSqlite,
  pgSchema.crewAssignment
);
export const crewCertification = pickSchema(
  isLocalMode,
  sqliteVessel.crewCertificationSqlite,
  pgSchema.crewCertification
);
export const crewDocuments = pickSchema(
  isLocalMode,
  sqliteVessel.crewDocumentsSqlite,
  pgSchema.crewDocuments
);
export const crewLeave = pickSchema(isLocalMode, sqliteVessel.crewLeaveSqlite, pgSchema.crewLeave);
export const shiftTemplate = pickSchema(
  isLocalMode,
  sqliteVessel.shiftTemplateSqlite,
  pgSchema.shiftTemplate
);
export const crewRestSheet = pickSchema(
  isLocalMode,
  sqliteVessel.crewRestSheetSqlite,
  pgSchema.crewRestSheet
);
export const crewRestDay = pickSchema(
  isLocalMode,
  sqliteVessel.crewRestDaySqlite,
  pgSchema.crewRestDay
);
export const crewNotificationSettings = pgSchema.crewNotificationSettings;
export const crewAlerts = pgSchema.crewAlerts;
export const crewRoles = pgSchema.crewRoles;
export const crewTasks = cloudOnly(pgSchema.crewTasks);
export const pilotFeedback = cloudOnly(pgSchema.pilotFeedback);
export const crewTaskEvents = cloudOnly(pgSchema.crewTaskEvents);
export const roles = cloudOnly(pgSchema.roles);
export const userRoleAssignments = cloudOnly(pgSchema.userRoleAssignments);

// Sensors & Monitoring
export const sensorConfigurations = pickSchema(
  isLocalMode,
  sqliteVessel.sensorConfigurationsSqlite,
  pgSchema.sensorConfigurations
);
export const sensorStates = pickSchema(
  isLocalMode,
  sqliteVessel.sensorStatesSqlite,
  pgSchema.sensorStates
);
export const sensorTemplates = cloudOnly(pgSchema.sensorTemplates);
export const sensorBundles = cloudOnly(pgSchema.sensorBundles);
export const sensorTypes = pickSchema(
  isLocalMode,
  sqliteVessel.sensorTypesSqlite,
  pgSchema.sensorTypes
);
export const sensorThresholds = pickSchema(
  isLocalMode,
  sqliteVessel.sensorThresholdsSqlite,
  pgSchema.sensorThresholds
);
export const sensorMapping = pickSchema(
  isLocalMode,
  sqliteVessel.sensorMappingSqlite,
  pgSchema.sensorMapping
);
export const discoveredSignals = pickSchema(
  isLocalMode,
  sqliteVessel.discoveredSignalsSqlite,
  pgSchema.discoveredSignals
);

// Alerts & Notifications
export const alertConfigurations = pickSchema(
  isLocalMode,
  sqliteVessel.alertConfigurationsSqlite,
  pgSchema.alertConfigurations
);
export const alertNotifications = pickSchema(
  isLocalMode,
  sqliteVessel.alertNotificationsSqlite,
  pgSchema.alertNotifications
);
export const alertSuppressions = pickSchema(
  isLocalMode,
  sqliteVessel.alertSuppressionsSqlite,
  pgSchema.alertSuppressions
);
export const alertComments = pickSchema(
  isLocalMode,
  sqliteVessel.alertCommentsSqlite,
  pgSchema.alertComments
);
export const actionableInsights = pickSchema(
  isLocalMode,
  sqliteVessel.actionableInsightsSqlite,
  pgSchema.actionableInsights
);
export const operatingConditionAlerts = pickSchema(
  isLocalMode,
  sqliteVessel.operatingConditionAlertsSqlite,
  pgSchema.operatingConditionAlerts
);
export const pdmAlerts = pickSchema(isLocalMode, sqliteVessel.pdmAlertsSqlite, pgSchema.pdmAlerts);
export const pdmScoreLogs = cloudOnly(pgSchema.pdmScoreLogs);
export const pdmBaseline = cloudOnly(pgSchema.pdmBaseline);
export const safetyBulletins = cloudOnly(pgSchema.safetyBulletins);
export const safetyAlarmTypes = cloudOnly(pgSchema.safetyAlarmTypes);
export const vesselSafetyAlarms = cloudOnly(pgSchema.vesselSafetyAlarms);
export const vesselSafetyAlarmAcknowledgements = cloudOnly(
  pgSchema.vesselSafetyAlarmAcknowledgements
);

export const diagnosticRuns = cloudOnly(pgSchema.diagnosticRuns);

// ML & Predictive Maintenance
export const mlModels = pickSchema(isLocalMode, sqliteVessel.mlModelsSqlite, pgSchema.mlModels);
export const mlModelAccuracyHistory = cloudOnly(pgSchema.mlModelAccuracyHistory);
export const failurePredictions = pickSchema(
  isLocalMode,
  sqliteVessel.failurePredictionsSqlite,
  pgSchema.failurePredictions
);
export const anomalyDetections = pickSchema(
  isLocalMode,
  sqliteVessel.anomalyDetectionsSqlite,
  pgSchema.anomalyDetections
);
export const componentDegradation = pickSchema(
  isLocalMode,
  sqliteVessel.componentDegradationSqlite,
  pgSchema.componentDegradation
);
export const failureHistory = pickSchema(
  isLocalMode,
  sqliteVessel.failureHistorySqlite,
  pgSchema.failureHistory
);
export const predictionFeedback = pickSchema(
  isLocalMode,
  sqliteVessel.predictionFeedbackSqlite,
  pgSchema.predictionFeedback
);
export const modelPerformanceValidations = pickSchema(
  isLocalMode,
  sqliteVessel.modelPerformanceValidationsSqlite,
  pgSchema.modelPerformanceValidations
);
export const retrainingTriggers = pickSchema(
  isLocalMode,
  sqliteVessel.retrainingTriggersSqlite,
  pgSchema.retrainingTriggers
);
export const thresholdOptimizations = pickSchema(
  isLocalMode,
  sqliteVessel.thresholdOptimizationsSqlite,
  pgSchema.thresholdOptimizations
);
export const modelRegistry = pickSchema(
  isLocalMode,
  sqliteVessel.modelRegistrySqlite,
  pgSchema.modelRegistry
);
export const rulModels = cloudOnly(pgSchema.rulModels);
export const rulFitHistory = cloudOnly(pgSchema.rulFitHistory);
export const weibullEstimates = cloudOnly(pgSchema.weibullEstimates);
