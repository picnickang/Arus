import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

// Re-export all modular schema tables
export * from "./schema/index";

// Re-export sync conflicts schema
export * from "./sync-conflicts-schema";

// Import tables from modular schema for foreign key references
import {
  organizations,
  users,
  vessels,
  equipment,
  devices,
  parts,
  workOrders,
  crew,
  mlModels,
  failurePredictions,
  anomalyDetections,
  suppliers,
  maintenanceTemplates,
  maintenanceChecklistItems,
  maintenanceChecklistCompletions,
  syncJournal,
  syncOutbox,
} from "./schema/index";

// Additional imports for tables whose insertSchemas are not in modular schema
import {
  dbSchemaVersion,
  telemetryRetentionPolicies,
  sensorTypes,
  sensorMapping,
  discoveredSignals,
  requestIdempotency,
  telemetryRollups,
  rulModels,
  rulFitHistory,
  portCall,
  drydockWindow,
  schedulerRuns,
  scheduleAssignments,
  scheduleUnfilled,
  replayIncoming,
  sheetLock,
  sheetVersion,
  sensorConfigurations,
  sensorStates,
  sensorTemplates,
  sensorBundles,
  vibrationAnalysis,
  weibullEstimates,
  pdmBaseline,
  pdmAlerts,
  telemetryAggregates,
  thresholdOptimizations,
  rawTelemetry,
  equipmentTelemetry,
  maintenanceSchedules,
  maintenanceRecords,
  workOrderChecklists,
  workOrderWorklogs,
  workOrderParts,
  optimizerConfigurations,
  resourceConstraints,
  optimizationResults,
  scheduleOptimizations,
  vibrationFeatures,
  idempotencyLog,
  maintenanceCosts,
  kbChunks,
  kbDocs,
  kbEmbeddingCache,
  componentDegradation,
  failureHistory,
  modelPerformanceValidations,
  predictionFeedback,
  mlModelsLegacy,
  shiftTemplate,
} from "./schema/index";

// ============================================================================
// INSERT SCHEMAS FOR MODULAR TABLES (not exported from modular schema)
// These are needed by schema-runtime.ts and other consumers
// ============================================================================

export const insertDbSchemaVersionSchema = createInsertSchema(dbSchemaVersion);
export const insertTelemetryRetentionPolicySchema = createInsertSchema(telemetryRetentionPolicies);
export const insertSensorTypeSchema = createInsertSchema(sensorTypes);
export const insertSensorMappingSchema = createInsertSchema(sensorMapping);
export const insertDiscoveredSignalSchema = createInsertSchema(discoveredSignals);
export const insertRequestIdempotencySchema = createInsertSchema(requestIdempotency);
export const insertTelemetryRollupSchema = createInsertSchema(telemetryRollups);
export const insertRulModelSchema = createInsertSchema(rulModels);
export const insertRulFitHistorySchema = createInsertSchema(rulFitHistory);
export const insertPortCallSchema = createInsertSchema(portCall);
export const insertDrydockWindowSchema = createInsertSchema(drydockWindow);
export const insertSchedulerRunSchema = createInsertSchema(schedulerRuns);
export const insertScheduleAssignmentSchema = createInsertSchema(scheduleAssignments);
export const insertScheduleUnfilledSchema = createInsertSchema(scheduleUnfilled);
export const insertReplayIncomingSchema = createInsertSchema(replayIncoming);
export const insertSheetLockSchema = createInsertSchema(sheetLock);
export const insertSheetVersionSchema = createInsertSchema(sheetVersion);
export const insertSensorConfigSchema = createInsertSchema(sensorConfigurations);
export const insertSensorStateSchema = createInsertSchema(sensorStates);
export const insertSensorTemplateSchema = createInsertSchema(sensorTemplates);
export const insertSensorBundleSchema = createInsertSchema(sensorBundles);
export const insertVibrationAnalysisSchema = createInsertSchema(vibrationAnalysis);
export const insertWeibullEstimateSchema = createInsertSchema(weibullEstimates);
export const insertPdmBaselineSchema = createInsertSchema(pdmBaseline);
export const insertPdmAlertSchema = createInsertSchema(pdmAlerts);
export const insertTelemetryAggregateSchema = createInsertSchema(telemetryAggregates);
export const insertThresholdOptimizationSchema = createInsertSchema(thresholdOptimizations);
export const insertRawTelemetrySchema = createInsertSchema(rawTelemetry);
export const insertTelemetrySchema = createInsertSchema(equipmentTelemetry);
// insertMaintenanceScheduleSchema, insertMaintenanceRecordSchema, insertWorkOrderChecklistSchema are exported from modular schema
export const insertWorkOrderWorklogSchema = createInsertSchema(workOrderWorklogs);
export const insertWorkOrderPartsSchema = createInsertSchema(workOrderParts);
export const insertOptimizerConfigurationSchema = createInsertSchema(optimizerConfigurations);
export const insertResourceConstraintSchema = createInsertSchema(resourceConstraints);
export const insertOptimizationResultSchema = createInsertSchema(optimizationResults);
export const insertScheduleOptimizationSchema = createInsertSchema(scheduleOptimizations);
export const insertVibrationFeatureSchema = createInsertSchema(vibrationFeatures);
export const insertIdempotencyLogSchema = createInsertSchema(idempotencyLog);
export const insertMaintenanceCostSchema = createInsertSchema(maintenanceCosts);
export const insertKbChunkSchema = createInsertSchema(kbChunks);
export const insertKbDocSchema = createInsertSchema(kbDocs);
export const insertKbEmbeddingCacheSchema = createInsertSchema(kbEmbeddingCache);
export const insertComponentDegradationSchema = createInsertSchema(componentDegradation);
export const insertFailureHistorySchema = createInsertSchema(failureHistory);
export const insertModelPerformanceValidationSchema = createInsertSchema(
  modelPerformanceValidations
);
export const insertPredictionFeedbackSchema = createInsertSchema(predictionFeedback);
export const insertMlModelLegacySchema = createInsertSchema(mlModelsLegacy);
export const insertShiftTemplateSchema = createInsertSchema(shiftTemplate);
// insertMaintenanceChecklistCompletionSchema, insertMaintenanceChecklistItemSchema are exported from modular schema

// Insert types for the schemas declared above (the corresponding Select types
// are exported from the modular schema files via `* from "./schema/index"`).
export type InsertSchedulerRun = z.infer<typeof insertSchedulerRunSchema>;
export type InsertScheduleAssignment = z.infer<typeof insertScheduleAssignmentSchema>;
export type InsertScheduleUnfilled = z.infer<typeof insertScheduleUnfilledSchema>;
export type InsertReplayIncoming = z.infer<typeof insertReplayIncomingSchema>;
export type InsertSheetVersion = z.infer<typeof insertSheetVersionSchema>;

// Validation schemas are in shared/validation/ — imported directly or via schema-runtime.ts
// Selective re-exports to avoid binding conflicts with ./schema/* (sensors, costs, ml, entities)
export * from "./validation/admin";
export * from "./validation/query-filters";
export * from "./validation/datetime";
export * from "./validation/marine";
export * from "./validation/j1939";
export * from "./validation/pdm";
export * from "./validation/telemetry";
export * from "./validation/entities";
