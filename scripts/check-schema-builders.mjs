#!/usr/bin/env node
/**
 * Schema Builder Usage Enforcement
 *
 * shared/schema/base.ts provides shared column builders —
 * uuidPrimaryKey(), tenantColumn(organizations), timestamps() — but most
 * tables predate them and hand-roll the same columns, which is exactly
 * where schema drift came from (org_id without FK, timestamps without
 * consistent defaults).
 *
 * This guard requires NEW tables to use the builders. Existing tables
 * are grandfathered below; shrinking that list is welcome, growing it
 * is not.
 *
 * Run:  node scripts/check-schema-builders.mjs            (gate)
 *       node scripts/check-schema-builders.mjs --report   (list all violators)
 * Exit: 0 = pass, 1 = new violation found
 */

import { readFileSync, readdirSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const schemaDir = resolve(root, "shared/schema");

const REPORT_MODE = process.argv.includes("--report");

// Tables that predate the builder rule. Do not add new entries — use
// uuidPrimaryKey()/tenantColumn()/timestamps() from ./base instead.
const GRANDFATHERED = new Set([
  "adminAuditEvents", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "adminSessions", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "adminSystemSettings", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "integrationConfigs", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "maintenanceWindows", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "systemPerformanceMetrics", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "systemHealthChecks", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "configAuditLog", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "auditRuns", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "auditWebhookSubscriptions", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "errorLogs", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "contextEvents", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "userSessions", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "loginEvents", // admin.ts — could use uuidPrimaryKey()
  "syncProtocolVersion", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "storageConfig", // admin.ts — could use timestamps()
  "beastModeConfig", // admin.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "agentConversations", // agent.ts — could use uuidPrimaryKey(), timestamps()
  "agentMessages", // agent.ts — could use uuidPrimaryKey()
  "agentToolCalls", // agent.ts — could use uuidPrimaryKey()
  "agentDrafts", // agent.ts — could use uuidPrimaryKey(), timestamps()
  "agentApprovals", // agent.ts — could use uuidPrimaryKey()
  "agentConfig", // agent.ts — could use uuidPrimaryKey(), timestamps()
  "agentSuggestions", // agent.ts — could use uuidPrimaryKey()
  "agentSchedules", // agent.ts — could use uuidPrimaryKey(), timestamps()
  "agentScheduleRuns", // agent.ts — could use uuidPrimaryKey()
  "agentFiles", // agent.ts — could use uuidPrimaryKey()
  "agentBriefings", // agent.ts — could use uuidPrimaryKey()
  "agentTasks", // agent.ts — could use uuidPrimaryKey(), timestamps()
  "agentFindings", // agent.ts — could use uuidPrimaryKey(), timestamps()
  "alertConfigurations", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "alertNotifications", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "alertSuppressions", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "alertComments", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "actionableInsights", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "alertSettings", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "alertSettingsVessel", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "alertThresholds", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "alertEmailLog", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crewAlertSettings", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "alertCooldown", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "emailQueue", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "notificationSettings", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "notificationQueue", // alerts.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "vesselCertificates", // certificates.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "certificateEvents", // certificates.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "complianceDocs", // compliance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "complianceFindings", // compliance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "complianceRules", // compliance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "dataSubjectRequests", // compliance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "crossBorderTransfers", // compliance.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "organizations", // core.ts — could use uuidPrimaryKey(), timestamps()
  "users", // core.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "emailSettings", // core.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "metricsHistory", // core.ts — could use tenantColumn(organizations)
  "laborRates", // costs.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "expenses", // costs.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "costModel", // costs.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "costSavings", // costs.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crewTasks", // crew-tasks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "crewTaskEvents", // crew-tasks.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crew", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "crewEmploymentHistory", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crewNotificationSettings", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "crewAlerts", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "crewRoles", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "skills", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "crewSkill", // crew.ts — could use tenantColumn(organizations)
  "crewLeave", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "shiftTemplate", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crewAssignment", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crewCertification", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crewDocuments", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "crewRestSheet", // crew.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "crewRestDay", // crew.ts — could use tenantColumn(organizations)
  "assetTwinTemplates", // digital-twin.ts — could use uuidPrimaryKey(), timestamps()
  "assetTwins", // digital-twin.ts — could use uuidPrimaryKey(), timestamps()
  "assetTwinState", // digital-twin.ts — could use uuidPrimaryKey()
  "twinResiduals", // digital-twin.ts — could use uuidPrimaryKey()
  "twinScenarios", // digital-twin.ts — could use uuidPrimaryKey()
  "twinEvents", // digital-twin.ts — could use uuidPrimaryKey()
  "vessel3dModels", // digital-twin.ts — could use uuidPrimaryKey(), timestamps()
  "twinSimulations", // digital-twin.ts — could use uuidPrimaryKey()
  "visualizationAssets", // digital-twin.ts — could use uuidPrimaryKey()
  "arMaintenanceProcedures", // digital-twin.ts — could use uuidPrimaryKey()
  "dtcDefinitions", // dtc.ts — could use timestamps()
  "dtcFaults", // dtc.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "equipmentDependencies", // equipment-dependencies.ts — could use uuidPrimaryKey(), timestamps()
  "equipmentDependencyLayouts", // equipment-dependencies.ts — could use uuidPrimaryKey()
  "devices", // equipment.ts — could use tenantColumn(organizations), timestamps()
  "edgeHeartbeats", // equipment.ts — could use tenantColumn(organizations)
  "pdmScoreLogs", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "equipmentLifecycle", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "performanceMetrics", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "equipmentDecommissionEvents", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "downtimeEvents", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "partFailureHistory", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "industryBenchmarks", // equipment.ts — could use uuidPrimaryKey()
  "operatingParameters", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "operatingConditionAlerts", // equipment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "externalDataCache", // external-data-cache.ts — could use uuidPrimaryKey(), timestamps()
  "importManifest", // import-manifest.ts — could use uuidPrimaryKey()
  "insightSnapshots", // insights.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "insightReports", // insights.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "suppliers", // inventory.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "parts", // inventory.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "partsInventory", // inventory.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "partsInventorySuppliers", // inventory.ts — could use uuidPrimaryKey()
  "stock", // inventory.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "partSubstitutions", // inventory.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "inventoryMovements", // inventory.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "inventoryParts", // inventory.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "mqttDevices", // iot-edge.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "deviceRegistry", // iot-edge.ts — could use tenantColumn(organizations)
  "transportSettings", // iot-edge.ts — could use uuidPrimaryKey()
  "edgeDiagnosticLogs", // iot-edge.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "transportFailovers", // iot-edge.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "serialPortStates", // iot-edge.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "calibrationCache", // iot-edge.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "calibrationCurves", // iot-edge.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "knowledgeBaseItems", // knowledge-base.ts — could use uuidPrimaryKey()
  "ragSearchQueries", // knowledge-base.ts — could use uuidPrimaryKey()
  "contentSources", // knowledge-base.ts — could use uuidPrimaryKey()
  "deckLogDaily", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "deckLogHourly", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "deckLogWatch", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "deckLogEvents", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "engineLogDaily", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "engineLogHourly", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "engineLogGenerator", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "engineLogWatch", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "engineLogEvents", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "deckLogHourlyAutoFill", // logbooks.ts — could use uuidPrimaryKey(), timestamps()
  "fuelEmissionsLog", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "vesselTrackLog", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "conditionLogSummary", // logbooks.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "maintenanceSchedules", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "maintenanceRecords", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "maintenanceCosts", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "maintenanceTemplates", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "maintenanceChecklistItems", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "maintenanceChecklistCompletions", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "oilAnalysis", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "wearParticleAnalysis", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "conditionMonitoring", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "oilChangeRecords", // maintenance.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "vibrationFeatures", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "rulModels", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "rulFitHistory", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "vibrationAnalysis", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "weibullEstimates", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "pdmBaseline", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "pdmAlerts", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "digitalTwins", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "modelRegistry", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "mlModelAccuracyHistory", // ml-analytics-advanced.ts — could use uuidPrimaryKey()
  "predictionDataQuality", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "inferenceRuns", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "predictionExplanations", // ml-analytics-advanced.ts — could use uuidPrimaryKey()
  "modelDriftMetrics", // ml-analytics-advanced.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "mlModelsLegacy", // ml-analytics-core.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "mlModels", // ml-analytics-core.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "modelVersions", // ml-analytics-core.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "modelMetrics", // ml-analytics-core.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "anomalyDetections", // ml-analytics-core.ts — could use tenantColumn(organizations)
  "failurePredictions", // ml-analytics-core.ts — could use tenantColumn(organizations)
  "thresholdOptimizations", // ml-analytics-core.ts — could use tenantColumn(organizations)
  "componentDegradation", // ml-analytics-core.ts — could use tenantColumn(organizations)
  "failureHistory", // ml-analytics-core.ts — could use tenantColumn(organizations)
  "trainingDatasets", // ml-training-pipeline.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "modelArtifacts", // ml-training-pipeline.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "trainingRuns", // ml-training-pipeline.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "softwarePatches", // ops-deployment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "updateSettings", // ops-deployment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "fleetUpdateStatus", // ops-deployment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "patchDownloads", // ops-deployment.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "optimizerConfigurations", // optimizer.ts — could use uuidPrimaryKey(), timestamps()
  "resourceConstraints", // optimizer.ts — could use uuidPrimaryKey(), timestamps()
  "optimizationResults", // optimizer.ts — could use uuidPrimaryKey(), timestamps()
  "scheduleOptimizations", // optimizer.ts — could use uuidPrimaryKey(), timestamps()
  "schedulerRuns", // optimizer.ts — could use uuidPrimaryKey(), timestamps()
  "scheduleAssignments", // optimizer.ts — could use uuidPrimaryKey()
  "scheduleUnfilled", // optimizer.ts — could use uuidPrimaryKey()
  "equipmentFeatures", // pdm-feature-store.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "fleetBaselines", // pdm-feature-store.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "roles", // permissions.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "permissionGrants", // permissions.ts — could use uuidPrimaryKey()
  "userRoleAssignments", // permissions.ts — could use uuidPrimaryKey()
  "reservations", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "purchaseOrders", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "purchaseOrderItems", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "purchaseOrderEvents", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "purchaseRequests", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "purchaseRequestItems", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "purchaseRequestEvents", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "itemSuppliers", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "serviceRequests", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "serviceOrders", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "serviceOrderEvents", // purchasing.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "kbDocs", // rag.ts — could use uuidPrimaryKey()
  "kbChunks", // rag.ts — could use uuidPrimaryKey()
  "kbDocVersions", // rag.ts — could use uuidPrimaryKey()
  "kbEmbeddingCache", // rag.ts — could use uuidPrimaryKey()
  "ragConversations", // rag.ts — could use uuidPrimaryKey()
  "ragMessages", // rag.ts — could use uuidPrimaryKey()
  "ragFeedback", // rag.ts — could use uuidPrimaryKey()
  "ragSemanticCache", // rag.ts — could use uuidPrimaryKey()
  "roleDashboardConfigs", // role-dashboards.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "userVesselAssignments", // role-dashboards.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "userDashboardPreferences", // role-dashboards.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "safetyAlarmTypes", // safety-alarms.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "vesselSafetyAlarms", // safety-alarms.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "vesselSafetyAlarmAcknowledgements", // safety-alarms.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "safetyBulletins", // safety-bulletins.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "sensorMapping", // sensors.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "discoveredSignals", // sensors.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "sensorConfigurations", // sensors.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "sensorStates", // sensors.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "sensorThresholds", // sensors.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "stormgeoSettings", // stormgeo.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "stormgeoSnapshots", // stormgeo.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "stormgeoImportHistory", // stormgeo.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "syncJournal", // sync.ts — could use uuidPrimaryKey(), timestamps()
  "syncOutbox", // sync.ts — could use uuidPrimaryKey(), timestamps()
  "eventOutbox", // sync.ts — could use uuidPrimaryKey()
  "replayIncoming", // sync.ts — could use uuidPrimaryKey()
  "equipmentTelemetry", // telemetry.ts — could use tenantColumn(organizations)
  "telemetryDeadLetter", // telemetry.ts — could use uuidPrimaryKey()
  "rawTelemetry", // telemetry.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "telemetryRollups", // telemetry.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "j1939Configurations", // telemetry.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "dailyMetricRollups", // telemetry.ts — could use tenantColumn(organizations)
  "engineerOverrides", // telemetry.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "rawTelemetryArchive", // telemetry.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "equipmentHeartbeat", // telemetry.ts — could use tenantColumn(organizations)
  "telemetryBatchAck", // telemetry.ts — could use tenantColumn(organizations)
  "telemetrySchemaRegistry", // telemetry.ts — could use uuidPrimaryKey()
  "weatherCache", // vessels.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "portCall", // vessels.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "drydockWindow", // vessels.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "workOrderWorklogs", // work-orders.ts — could use timestamps()
  "workOrderTasks", // work-orders.ts — could use uuidPrimaryKey(), tenantColumn(organizations), timestamps()
  "workOrderHistory", // work-orders.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "workOrderParts", // work-orders.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "workOrderEquipment", // work-orders.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
  "workOrderCompletions", // work-orders.ts — could use uuidPrimaryKey(), tenantColumn(organizations)
]);

// Inline patterns the builders replace.
const INLINE_UUID_PK =
  /id:\s*varchar\("id"\)\s*\.primaryKey\(\)\s*\.default\(sql`gen_random_uuid\(\)`\)/s;
const INLINE_TENANT =
  /orgId:\s*varchar\("org_id"\)\s*\.notNull\(\)\s*\.references\(\(\)\s*=>\s*organizations\.id\)/s;
const INLINE_TIMESTAMPS =
  /createdAt:\s*timestamp\("created_at",\s*\{\s*mode:\s*"date"\s*\}\)\.defaultNow\(\)(?![\s\S]{0,160}notNull)[\s\S]{0,400}updatedAt:\s*timestamp\("updated_at",\s*\{\s*mode:\s*"date"\s*\}\)\.defaultNow\(\),/;

/** Extract `export const <name> = pgTable(` bodies with balanced parens. */
function extractTables(src) {
  const tables = [];
  const re = /export const (\w+) = pgTable\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    tables.push({ name: m[1], body: src.slice(re.lastIndex, i - 1) });
  }
  return tables;
}

const violations = [];
for (const fileName of readdirSync(schemaDir).sort()) {
  if (!fileName.endsWith(".ts") || fileName.endsWith(".d.ts")) continue;
  const src = readFileSync(join(schemaDir, fileName), "utf8");
  for (const { name, body } of extractTables(src)) {
    const problems = [];
    if (INLINE_UUID_PK.test(body)) problems.push("uuidPrimaryKey()");
    if (INLINE_TENANT.test(body)) problems.push("tenantColumn(organizations)");
    if (INLINE_TIMESTAMPS.test(body)) problems.push("timestamps()");
    if (problems.length > 0) {
      violations.push({ file: fileName, table: name, problems });
    }
  }
}

if (REPORT_MODE) {
  console.log("=== Schema Builder Report (all violators incl. grandfathered) ===");
  for (const v of violations) {
    console.log(`  "${v.table}", // ${v.file} — could use ${v.problems.join(", ")}`);
  }
  console.log(`\n${violations.length} table(s) hand-roll builder columns.`);
  process.exit(0);
}

const newViolations = violations.filter((v) => !GRANDFATHERED.has(v.table));

console.log("=== Schema Builder Usage ===");
if (newViolations.length > 0) {
  console.log(`${newViolations.length} new table(s) hand-roll columns the builders provide:\n`);
  for (const v of newViolations) {
    console.log(`  ✗ ${v.file} ${v.table} — use ${v.problems.join(", ")} from "./base"`);
  }
  console.log("\nFix: build new tables with the shared builders, e.g.");
  console.log('  pgTable("x", { ...uuidPrimaryKey(), ...tenantColumn(organizations), ..., ...timestamps() })');
  process.exit(1);
} else {
  console.log(
    `No new hand-rolled builder columns (${violations.length} grandfathered table(s) remain). All clear.`
  );
  process.exit(0);
}
