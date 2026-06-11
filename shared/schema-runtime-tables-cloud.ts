/**
 * PostgreSQL-only guarded table exports for schema-runtime.
 */

import { cloudOnly, IS_POSTGRES, pgSchema, sqliteVessel } from "./schema-runtime-table-helpers";

// ============================================================================
// POSTGRESQL-ONLY TABLES (guarded exports - undefined in SQLite mode)
// These tables only exist in cloud deployments and will crash if accessed in SQLite mode
// ============================================================================
export const softwarePatches = cloudOnly(pgSchema.softwarePatches);
export const configAuditLog = cloudOnly(pgSchema.configAuditLog);
const _sqliteUpdateSettings = (sqliteVessel as Record<string, unknown>)["updateSettingsSqlite"] as
  | typeof pgSchema.updateSettings
  | undefined;
export const updateSettings = (
  IS_POSTGRES ? pgSchema.updateSettings : _sqliteUpdateSettings
) as typeof pgSchema.updateSettings;
export const patchDownloads = cloudOnly(pgSchema.patchDownloads);
export const adminSessions = cloudOnly(pgSchema.adminSessions);
export const modelDeployments = cloudOnly(pgSchema.modelDeployments);
export const entityOffsets = cloudOnly(pgSchema.entityOffsets);
export const contextEvents = cloudOnly(pgSchema.contextEvents);
export const auditRuns = cloudOnly(pgSchema.auditRuns);
export const auditWebhookSubscriptions = cloudOnly(pgSchema.auditWebhookSubscriptions);
export const kbDocs = cloudOnly(pgSchema.kbDocs); // Note: knowledgeBaseItems is the SQLite equivalent
export const kbDocVersions = cloudOnly(pgSchema.kbDocVersions);
export const kbChunks = cloudOnly(pgSchema.kbChunks);
export const kbEmbeddingCache = cloudOnly(pgSchema.kbEmbeddingCache);

// RAG Conversation System (PostgreSQL-only)
export const ragConversations = cloudOnly(pgSchema.ragConversations);
export const ragMessages = cloudOnly(pgSchema.ragMessages);
export const ragFeedback = cloudOnly(pgSchema.ragFeedback);
export const ragSemanticCache = cloudOnly(pgSchema.ragSemanticCache);
export const weatherCache = cloudOnly(pgSchema.weatherCache);
export const schedulerRuns = (
  IS_POSTGRES ? pgSchema.schedulerRuns : sqliteVessel.schedulerRunsSqlite
) as typeof pgSchema.schedulerRuns;
export const scheduleAssignments = (
  IS_POSTGRES ? pgSchema.scheduleAssignments : sqliteVessel.scheduleAssignmentsSqlite
) as typeof pgSchema.scheduleAssignments;
export const scheduleUnfilled = (
  IS_POSTGRES ? pgSchema.scheduleUnfilled : sqliteVessel.scheduleUnfilledSqlite
) as typeof pgSchema.scheduleUnfilled;
export const modelVersions = cloudOnly(pgSchema.modelVersions);
export const calibrationCurves = cloudOnly(pgSchema.calibrationCurves);
export const realTimePredictions = cloudOnly(pgSchema.realTimePredictions);
export const equipmentFeatures = cloudOnly(pgSchema.equipmentFeatures);
export const featureImportances = cloudOnly(pgSchema.featureImportances);
export const predictionExplanations = cloudOnly(pgSchema.predictionExplanations);
export const sensorFusionSnapshots = cloudOnly(pgSchema.sensorFusionSnapshots);
export const acousticEvents = cloudOnly(pgSchema.acousticEvents);

// Digital Deck Logbook
export const deckLogDaily = cloudOnly(pgSchema.deckLogDaily);
export const deckLogHourly = cloudOnly(pgSchema.deckLogHourly);
export const deckLogWatch = cloudOnly(pgSchema.deckLogWatch);
export const deckLogEvents = cloudOnly(pgSchema.deckLogEvents);

// Digital Engine Room Logbook
export const engineLogDaily = cloudOnly(pgSchema.engineLogDaily);
export const engineLogHourly = cloudOnly(pgSchema.engineLogHourly);
export const engineLogGenerator = cloudOnly(pgSchema.engineLogGenerator);
export const engineLogWatch = cloudOnly(pgSchema.engineLogWatch);
export const engineLogEvents = cloudOnly(pgSchema.engineLogEvents);

// Compliance Rules Engine
export const complianceFindings = cloudOnly(pgSchema.complianceFindings);
export const complianceRules = cloudOnly(pgSchema.complianceRules);

// Notification System
export const notificationSettings = cloudOnly(pgSchema.notificationSettings);
export const notificationQueue = cloudOnly(pgSchema.notificationQueue);
export const emailQueue = cloudOnly(pgSchema.emailQueue);
export const telemetryDeadLetter = cloudOnly(pgSchema.telemetryDeadLetter);
export const predictionOutcomes = cloudOnly(pgSchema.predictionOutcomes);

// StormGeo Integration
export const stormgeoSettings = cloudOnly(pgSchema.stormgeoSettings);
export const stormgeoSnapshots = cloudOnly(pgSchema.stormgeoSnapshots);
export const deckLogHourlyAutoFill = cloudOnly(pgSchema.deckLogHourlyAutoFill);
export const stormgeoImportHistory = cloudOnly(pgSchema.stormgeoImportHistory);

// External Data Cache (AI Copilot - cloud-only)
export const externalDataCache = cloudOnly(pgSchema.externalDataCache);
