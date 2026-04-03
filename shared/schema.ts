import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  unique,
  uniqueIndex,
  serial,
  index,
  numeric,
  vector,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
export const insertModelPerformanceValidationSchema = createInsertSchema(modelPerformanceValidations);
export const insertPredictionFeedbackSchema = createInsertSchema(predictionFeedback);
export const insertMlModelLegacySchema = createInsertSchema(mlModelsLegacy);
export const insertShiftTemplateSchema = createInsertSchema(shiftTemplate);
// insertMaintenanceChecklistCompletionSchema, insertMaintenanceChecklistItemSchema are exported from modular schema

// ============================================================================
// STANDALONE ZOD VALIDATION SCHEMAS (API Request Validation)
// ============================================================================

// Admin password schemas
export const adminPasswordVerifySchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const adminPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const adminSessionResponseSchema = z.object({
  sessionToken: z.string(),
  expiresAt: z.string(),
  expiresIn: z.number(),
});

export type AdminPasswordVerify = z.infer<typeof adminPasswordVerifySchema>;
export type AdminPasswordChange = z.infer<typeof adminPasswordChangeSchema>;
export type AdminSessionResponse = z.infer<typeof adminSessionResponseSchema>;

// Request validation helpers
export const requestIdSchema = z.string().min(1, "Request ID is required");
export const idempotencyKeySchema = z.string().min(1, "Idempotency key is required");
export const vesselIdSchema = z.string().min(1, "Vessel ID is required");
export const crewIdSchema = z.string().min(1, "Crew ID is required");

// Common Equipment & Marine Entity Filters
export const equipmentIdQuerySchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
});

export const optionalEquipmentIdQuerySchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID must be non-empty").optional(),
});

export const vesselQuerySchema = z.object({
  vessel_id: z.string().min(1, "Vessel ID must be non-empty").optional(),
  org_id: z.string().min(1, "Organization ID must be non-empty").optional(),
});

export const crewQuerySchema = z.object({
  crew_id: z.string().min(1, "Crew ID must be non-empty").optional(),
  vessel_id: z.string().min(1, "Vessel ID must be non-empty").optional(),
});

// Time Range & Period Queries
export const timeRangeQuerySchema = z.object({
  dateFrom: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "dateFrom must be a valid date",
    }),
  dateTo: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "dateTo must be a valid date",
    }),
  hours: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 24))
    .pipe(z.number().int().min(1).max(8760, "Hours must be between 1 and 8760 (1 year)")),
  days: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 30))
    .pipe(z.number().int().min(1).max(365, "Days must be between 1 and 365")),
  months: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 12))
    .pipe(z.number().int().min(1).max(60, "Months must be between 1 and 60")),
});

// Marine Hours of Rest Specific Queries
export const horQuerySchema = z.object({
  crew_id: z.string().min(1, "Crew ID is required"),
  year: z
    .string()
    .transform((val) => Number.parseInt(val))
    .pipe(z.number().int().min(2020).max(2030, "Year must be between 2020 and 2030")),
  month: z.enum([
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ]),
});

// Advanced Range Query
export const rangeQuerySchema = z.object({
  vesselId: z.string().min(1, "Vessel ID is required").optional(),
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "startDate must be a valid ISO date string",
    }),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "endDate must be a valid ISO date string",
    }),
  complianceFilter: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
});

// Status & Type Filtering
export const statusQuerySchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled", "scheduled"]).optional(),
  type: z
    .enum([
      "preventive",
      "corrective",
      "predictive",
      "all",
      "fleet",
      "health",
      "maintenance",
      "workorders",
      "telemetry",
    ])
    .optional(),
  costType: z.enum(["labor", "parts", "equipment", "downtime"]).optional(),
  priority: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : undefined))
    .pipe(z.number().int().min(1).max(3, "Priority must be 1, 2, or 3").optional()),
});

// Telemetry & Analytics Queries
export const telemetryQuerySchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required").optional(),
  sensorType: z.string().min(1, "Sensor type is required").optional(),
  hours: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 24))
    .pipe(z.number().int().min(1).max(8760, "Hours must be between 1 and 8760")),
  threshold: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseFloat(val) : 2))
    .pipe(z.number().min(0.1).max(10, "Threshold must be between 0.1 and 10")),
});

// Pagination & Limits
export const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 100))
    .pipe(z.number().int().min(1).max(1000, "Limit must be between 1 and 1000")),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val) : 0))
    .pipe(z.number().int().min(0, "Offset must be non-negative")),
});

// Combined Query Schemas for Complex Endpoints
export const equipmentAnalyticsQuerySchema = equipmentIdQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(statusQuerySchema);
export const fleetManagementQuerySchema = vesselQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(paginationQuerySchema);
export const maintenanceQuerySchema = equipmentIdQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(statusQuerySchema);
export const performanceQuerySchema = equipmentIdQuerySchema
  .merge(timeRangeQuerySchema)
  .merge(telemetryQuerySchema.partial());

// Cost savings query schemas
export const costSavingsListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  category: z.string().optional(),
  equipmentId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const costSavingsSummaryQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const costSavingsTrendQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).optional().default("monthly"),
  months: z.coerce.number().int().min(1).max(24).optional().default(12),
});

export const costSavingsCalculateOptionsSchema = z.object({
  laborRatePerHour: z.number().positive().optional(),
  downtimeCostPerHour: z.number().positive().optional(),
  currency: z.string().optional(),
});

// Downtime cost validation schema
export const downtimeCostValidationSchema = z.object({
  hourlyRate: z.number().positive("Hourly rate must be positive"),
  estimatedDuration: z.number().positive("Duration must be positive"),
  actualDuration: z.number().positive().optional(),
});

// UTC date/time validation schemas
export const utcDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
export const utcTimeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be in HH:MM or HH:MM:SS format");
export const utcTimestampSchema = z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
  message: "Timestamp must be a valid ISO 8601 date string",
});

// J1939 mapping schemas
export const j1939SpnRuleSchema = z.object({
  spn: z.number().int().positive(),
  scale: z.number().optional().default(1),
  offset: z.number().optional().default(0),
  unit: z.string().optional(),
  label: z.string().optional(),
});

export const j1939PgnRuleSchema = z.object({
  pgn: z.number().int().positive(),
  priority: z.number().int().min(0).max(7).optional(),
  spns: z.array(j1939SpnRuleSchema),
});

export const j1939MappingSchema = z.object({
  deviceId: z.string().min(1),
  rules: z.array(j1939PgnRuleSchema),
});

// ML Training and Acoustic Data Schemas
export const mlTrainConfigSchema = z.object({
  modelType: z.enum(["lstm", "gru", "tft", "rf", "gnn", "hybrid"]),
  epochs: z.number().int().positive().max(1000).optional().default(100),
  batchSize: z.number().int().positive().max(512).optional().default(32),
  learningRate: z.number().positive().max(1).optional().default(0.001),
  validationSplit: z.number().min(0).max(0.5).optional().default(0.2),
  earlyStoppingPatience: z.number().int().positive().optional().default(10),
  features: z.array(z.string()).optional(),
  targetColumn: z.string().optional(),
  windowSize: z.number().int().positive().optional(),
  horizonDays: z.number().int().positive().optional(),
});

export const mlModelStatusUpdateSchema = z.object({
  status: z.enum(["training", "ready", "failed", "deprecated"]),
  errorMessage: z.string().optional(),
  metrics: z.record(z.number()).optional(),
});

export const mlAcousticDataSchema = z.object({
  sampleRate: z.number().positive(),
  duration: z.number().positive(),
  channels: z.number().int().positive().optional().default(1),
  data: z.array(z.number()),
  metadata: z.record(z.any()).optional(),
});

// PdM Pack API Request Validation Schemas
export const pdmOrgIdHeaderSchema = z.object({
  "x-org-id": z.string().min(1, "Organization ID is required"),
});

export const pdmBaselineUpdateSchema = z.object({
  vesselName: z.string().min(1, "Vessel name is required"),
  assetId: z.string().min(1, "Asset ID is required"),
  assetClass: z.enum(["bearing", "pump"], {
    errorMap: () => ({ message: "Asset class must be 'bearing' or 'pump'" }),
  }),
  features: z
    .record(z.string(), z.number().finite())
    .refine((features) => Object.keys(features).length > 0, {
      message: "At least one feature required",
    }),
});

export const pdmBearingAnalysisSchema = z.object({
  vesselName: z.string().min(1, "Vessel name is required"),
  assetId: z.string().min(1, "Asset ID is required"),
  fs: z.number().positive("Sampling frequency must be positive"),
  rpm: z.number().positive("RPM must be positive").optional(),
  series: z.array(z.number().finite()).min(10, "At least 10 data points required"),
  spectrum: z
    .object({
      freq: z.array(z.number()),
      mag: z.array(z.number()),
    })
    .optional(),
  autoBaseline: z.boolean().optional().default(false),
});

export const pdmPumpAnalysisSchema = z
  .object({
    vesselName: z.string().min(1, "Vessel name is required"),
    assetId: z.string().min(1, "Asset ID is required"),
    flow: z.array(z.number().finite()).optional(),
    pressure: z.array(z.number().finite()).optional(),
    current: z.array(z.number().finite()).optional(),
    fs: z.number().positive("Sampling frequency must be positive").optional(),
    vibSeries: z.array(z.number().finite()).optional(),
    autoBaseline: z.boolean().optional().default(false),
  })
  .refine((data) => data.flow || data.pressure || data.current || data.vibSeries, {
    message: "At least one data source required: flow, pressure, current, or vibSeries",
  });

export const pdmAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional().default(100),
});

// Update schemas for PATCH operations
export const updateWorkOrderSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  estimatedCompletion: z.string().optional(),
  actualCompletion: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  reason: z.string().optional(),
  description: z.string().optional(),
  vesselId: z.string().optional(),
  equipmentId: z.string().optional(),
  maintenanceType: z.string().optional(),
  assignedCrewId: z.string().nullable().optional(),
  plannedStartDate: z.union([z.string(), z.date()]).nullable().optional(),
  plannedEndDate: z.union([z.string(), z.date()]).nullable().optional(),
  actualStartDate: z.union([z.string(), z.date()]).nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  estimatedDowntimeHours: z.number().nullable().optional(),
  affectsVesselDowntime: z.boolean().optional(),
});

export const updatePartSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  partNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateStockSchema = z.object({
  quantityOnHand: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(0).optional(),
  location: z.string().optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updatePartSubstitutionSchema = z.object({
  isPreferred: z.boolean().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateMlModelSchema = z.object({
  status: z.enum(["draft", "training", "ready", "deployed", "deprecated"]).optional(),
  accuracy: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// Hours of Rest (HoR) schemas
export const horDaySchema = z.object({
  date: utcDateSchema,
  h0: z.number().int().min(0).max(1),
  h1: z.number().int().min(0).max(1),
  h2: z.number().int().min(0).max(1),
  h3: z.number().int().min(0).max(1),
  h4: z.number().int().min(0).max(1),
  h5: z.number().int().min(0).max(1),
  h6: z.number().int().min(0).max(1),
  h7: z.number().int().min(0).max(1),
  h8: z.number().int().min(0).max(1),
  h9: z.number().int().min(0).max(1),
  h10: z.number().int().min(0).max(1),
  h11: z.number().int().min(0).max(1),
  h12: z.number().int().min(0).max(1),
  h13: z.number().int().min(0).max(1),
  h14: z.number().int().min(0).max(1),
  h15: z.number().int().min(0).max(1),
  h16: z.number().int().min(0).max(1),
  h17: z.number().int().min(0).max(1),
  h18: z.number().int().min(0).max(1),
  h19: z.number().int().min(0).max(1),
  h20: z.number().int().min(0).max(1),
  h21: z.number().int().min(0).max(1),
  h22: z.number().int().min(0).max(1),
  h23: z.number().int().min(0).max(1),
});

export const horSheetMetaSchema = z.object({
  vessel_id: z.string().min(1, "Vessel ID is required"),
  crew_id: z.string().min(1, "Crew ID is required"),
  crew_name: z.string().min(1, "Crew name is required"),
  rank: z.string().min(1, "Rank is required"),
  month: z.enum([
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ]),
  year: z.number().int().min(2020).max(2030),
});

export const horImportSchema = z.object({
  sheet: horSheetMetaSchema,
  rows: z
    .array(horDaySchema)
    .min(1, "At least one rest day required")
    .max(31, "Maximum 31 days per month"),
});

// Telemetry ingest schemas
export const ingestSignalSchema = z.object({
  src: z.string().min(1, "Signal source is required"),
  sig: z.string().min(1, "Signal name is required"),
  value: z.number().optional(),
  unit: z.string().optional(),
});

export const ingestPayloadSchema = z.object({
  vessel: z.string().min(1, "Vessel identifier is required"),
  ts: z.number().int().positive("Timestamp must be positive epoch seconds"),
  signals: z.array(ingestSignalSchema).min(1, "At least one signal required"),
});

// Sensor configuration schemas (for bulk operations)
export const bulkSensorConfigItemSchema = z.object({
  sensorType: z.string().min(1, "Sensor type is required"),
  enabled: z.boolean().optional().default(true),
  gain: z.number().optional(),
  offset: z.number().optional(),
  minValid: z.number().optional(),
  maxValid: z.number().optional(),
  warnLo: z.number().optional(),
  warnHi: z.number().optional(),
  critLo: z.number().optional(),
  critHi: z.number().optional(),
});

export const bulkSensorConfigSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  bundleId: z.string().optional(),
  configs: z.array(bulkSensorConfigItemSchema).min(1, "At least one sensor configuration is required"),
  overwriteExisting: z.boolean().default(false),
});

// Sensor template select schemas (placeholder)
export const selectSensorTemplateSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  templateId: z.string(),
  name: z.string(),
  kind: z.string(),
  unit: z.string(),
  equipmentTypes: z.array(z.string()).nullable(),
  fields: z.record(z.any()),
  notes: z.string().nullable(),
  isSystemDefault: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const selectSensorBundleSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  bundleId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  equipmentType: z.string(),
  templateIds: z.array(z.string()),
  isSystemDefault: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Type exports for HoR and Ingest schemas
export type HorDay = z.infer<typeof horDaySchema>;
export type HorSheetMeta = z.infer<typeof horSheetMetaSchema>;
export type HorImport = z.infer<typeof horImportSchema>;
export type IngestSignal = z.infer<typeof ingestSignalSchema>;
export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
export type BulkSensorConfigItem = z.infer<typeof bulkSensorConfigItemSchema>;
export type BulkSensorConfigPayload = z.infer<typeof bulkSensorConfigSchema>;
