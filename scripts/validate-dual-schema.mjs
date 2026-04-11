#!/usr/bin/env node
/**
 * Dual-DB Schema Guardrail
 *
 * Two-layer validation:
 *   Layer 1 — Export guard: Every table export in schema-runtime.ts uses the
 *             ternary guard pattern (isLocalMode ? sqlite : pg) or is marked
 *             cloud-only.
 *   Layer 2 — Column parity: For every switched table, compares columns in
 *             the PG definition vs SQLite definition and flags mismatches.
 *
 * Run:  node scripts/validate-dual-schema.mjs
 * Exit: 0 = pass, 1 = drift found
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const errors = [];

// ============================================================================
// Layer 1 — Export guard check
// ============================================================================

const runtimePath = resolve(root, "shared/schema-runtime.ts");
const runtimeSrc = readFileSync(runtimePath, "utf8");

const guardedNames = new Set();
const switchedPairs = [];
const lines = runtimeSrc.split("\n");

for (const line of lines) {
  const exportMatch = line.match(/^export const (\w+)\s*=/);
  if (!exportMatch) continue;
  const name = exportMatch[1];

  const isSwitched =
    line.includes("isLocalMode ?") ||
    line.includes("isEmbedded ?") ||
    line.includes("IS_POSTGRES ?") ||
    line.includes("IS_SQLITE ?");

  const isDirectPgExport = line.includes("pgSchema.") && !isSwitched;

  const isConfigConst =
    name === "DEPLOYMENT_MODE" ||
    name === "IS_SQLITE" ||
    name === "IS_POSTGRES" ||
    name === "isLocalMode" ||
    name === "isEmbedded";

  if (isSwitched || isDirectPgExport || isConfigConst) {
    guardedNames.add(name);
  }

  if (isSwitched) {
    const pgMatch = line.match(/pgSchema\.(\w+)/);
    const sqliteMatch = line.match(/(?:sqliteVessel|sqliteSync)\.(\w+)/);
    if (pgMatch && sqliteMatch) {
      switchedPairs.push({ name, pgExport: pgMatch[1], sqliteExport: sqliteMatch[1] });
    }
  }
}

const exportLineRe = /^export const (\w+)\s*=/gm;
const allExports = [];
let m;
while ((m = exportLineRe.exec(runtimeSrc)) !== null) {
  allExports.push(m[1]);
}

const unguarded = allExports.filter(
  (name) =>
    !guardedNames.has(name) &&
    !name.startsWith("insert") &&
    !name.startsWith("select")
);

if (unguarded.length > 0) {
  errors.push(`Layer 1 — ${unguarded.length} unguarded export(s): ${unguarded.join(", ")}`);
}

// ============================================================================
// Layer 2 — Column parity check for switched tables
// ============================================================================

function extractColumnsFromSource(src) {
  const tables = {};
  const tableBlocks = src.matchAll(
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable)\s*\(\s*["'](\w+)["']\s*,\s*(\{[\s\S]*?\})\s*(?:,|\))/gm
  );

  for (const match of tableBlocks) {
    const varName = match[1];
    const tableName = match[2];
    const body = match[3];

    const cols = new Set();
    const colMatches = body.matchAll(/(\w+)\s*:\s*(?:text|varchar|integer|boolean|timestamp|real|numeric|serial|uuid|jsonb|json|bigint|smallint|doublePrecision|char|decimal|date|time|interval|blob|customType)\s*\(/g);
    for (const cm of colMatches) {
      cols.add(cm[1]);
    }
    tables[varName] = { tableName, columns: cols };
  }
  return tables;
}

function scanSchemaDir(dir) {
  const result = {};
  if (!existsSync(dir)) return result;
  const entries = readdirSync(dir).filter(f => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  for (const file of entries) {
    const filePath = join(dir, file);
    const src = readFileSync(filePath, "utf8");
    const tables = extractColumnsFromSource(src);
    Object.assign(result, tables);
  }
  return result;
}

const pgDir = resolve(root, "shared/schema");
const sqliteDir = resolve(root, "shared/sqlite-schema");

const pgTables = scanSchemaDir(pgDir);
const sqliteTables = scanSchemaDir(sqliteDir);

const COLUMN_PARITY_ALLOWLIST = new Set([
  "createdAt", "updatedAt", "deletedAt",
]);

const KNOWN_DRIFT_TABLES = new Set([
  "vessels", "equipment", "equipmentLifecycle", "performanceMetrics",
  "rawTelemetry", "workOrders", "workOrderCompletions", "workOrderChecklists",
  "workOrderWorklogs", "workOrderTasks", "workOrderHistory",
  "maintenanceRecords", "maintenanceCosts", "maintenanceChecklistItems",
  "maintenanceChecklistCompletions", "maintenanceWindows", "downtimeEvents",
  "parts", "inventoryParts", "inventoryMovements", "suppliers",
  "purchaseOrders", "purchaseOrderItems", "partSubstitutions", "partFailureHistory",
  "reservations", "crew", "skills", "crewSkill", "crewAssignment",
  "crewCertification", "crewDocuments", "crewLeave", "shiftTemplate",
  "crewRestSheet", "crewRestDay", "sensorConfigurations", "sensorStates",
  "sensorTemplates", "sensorBundles", "sensorTypes", "sensorThresholds",
  "sensorMapping", "discoveredSignals", "alertConfigurations",
  "alertNotifications", "alertSuppressions", "alertComments",
  "actionableInsights", "operatingConditionAlerts", "pdmAlerts",
  "pdmScoreLogs", "pdmBaseline", "mlModels", "failurePredictions",
  "anomalyDetections", "componentDegradation", "failureHistory",
  "predictionFeedback", "modelPerformanceValidations", "retrainingTriggers",
  "thresholdOptimizations", "modelRegistry", "costSavings", "costModel",
  "complianceRecords", "complianceAudits", "complianceCertificates",
  "complianceTraining", "complianceNonConformities", "dailyMetricRollups",
  "scheduleRuns", "scheduleAssignments", "scheduleUnfilled",
  "devices", "equipmentTelemetry", "deviceRegistry", "organizations", "users",
  "partsInventory", "stock", "maintenanceSchedules", "maintenanceTemplates",
  "adminAuditEvents", "adminSystemSettings", "arMaintenanceProcedures",
  "calibrationCache", "complianceAuditLog", "complianceBundles", "complianceDocs",
  "contentSources", "crossBorderTransfers", "dataSubjectRequests", "drydockWindow",
  "dtcDefinitions", "dtcFaults", "edgeHeartbeats", "engineerOverrides",
  "errorLogs", "expenses", "idempotencyLog", "immutableAuditTrail",
  "insightReports", "insightSnapshots", "integrationConfigs",
  "j1939Configurations", "knowledgeBaseItems", "laborRates",
  "llmBudgetConfigs", "llmCostTracking", "loginEvents", "operatingParameters",
  "opsDbStaged", "optimizationResults", "optimizerConfigurations", "portCall",
  "predictionDataQuality", "ragSearchQueries", "requestIdempotency",
  "resourceConstraints", "scheduleOptimizations", "schedulerRuns",
  "sheetLock", "sheetVersion", "storageConfig", "syncProtocolVersion",
  "telemetryAggregates", "telemetryRollups", "userSessions",
  "vibrationFeatures", "visualizationAssets",
]);

let knownDriftCount = 0;
let newDriftCount = 0;
let pairsChecked = 0;
for (const pair of switchedPairs) {
  const pgDef = pgTables[pair.pgExport];
  const sqliteDef = sqliteTables[pair.sqliteExport];

  if (!pgDef || !sqliteDef) continue;
  if (pgDef.columns.size === 0 || sqliteDef.columns.size === 0) continue;

  pairsChecked++;
  const pgOnly = [...pgDef.columns].filter(c => !sqliteDef.columns.has(c) && !COLUMN_PARITY_ALLOWLIST.has(c));
  const sqliteOnly = [...sqliteDef.columns].filter(c => !pgDef.columns.has(c) && !COLUMN_PARITY_ALLOWLIST.has(c));

  if (pgOnly.length > 0 || sqliteOnly.length > 0) {
    if (KNOWN_DRIFT_TABLES.has(pair.name)) {
      knownDriftCount++;
    } else {
      newDriftCount++;
      const details = [];
      if (pgOnly.length) details.push(`PG-only: ${pgOnly.join(", ")}`);
      if (sqliteOnly.length) details.push(`SQLite-only: ${sqliteOnly.join(", ")}`);
      errors.push(`Layer 2 — NEW drift in ${pair.name} (${pgDef.tableName}): ${details.join("; ")}`);
    }
  }
}

// ============================================================================
// Report
// ============================================================================

console.log("=== Dual-DB Schema Guardrail ===");
console.log(`Guarded exports:       ${guardedNames.size}`);
console.log(`Switched table pairs:  ${switchedPairs.length}`);
console.log(`Pairs with columns:    ${pairsChecked}`);
console.log(`Known drift (allowed): ${knownDriftCount}`);
console.log(`New drift (blocking):  ${newDriftCount}`);
console.log(`PG tables found:       ${Object.keys(pgTables).length}`);
console.log(`SQLite tables found:   ${Object.keys(sqliteTables).length}`);
console.log(`Total runtime exports: ${allExports.length}`);

if (errors.length > 0) {
  console.log(`\n${errors.length} issue(s) found:`);
  for (const e of errors) {
    console.log(`  ⚠ ${e}`);
  }
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
  process.exit(0);
}
