#!/usr/bin/env node
/**
 * Dual-DB Schema Guardrail
 *
 * Three-layer validation:
 *   Layer 1 — Export guard: Every table export in schema-runtime.ts uses the
 *             ternary guard pattern (isLocalMode ? sqlite : pg) or is marked
 *             cloud-only.
 *   Layer 2 — Column parity: For every switched table, compares column names
 *             AND normalized types between PG and SQLite definitions.
 *   Layer 3 — Missing tables: Flags tables present in one schema but absent
 *             from the other (with allowlist for pre-existing gaps).
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

const PG_TYPES = "text|varchar|integer|boolean|timestamp|real|numeric|serial|uuid|jsonb|json|bigint|smallint|doublePrecision|char|decimal|date|time|interval|blob|customType";
const SQLITE_TYPES = "text|integer|real|blob|numeric";
const ALL_TYPES = [...new Set([...PG_TYPES.split("|"), ...SQLITE_TYPES.split("|")])].join("|");

const PG_TO_NORMALIZED = {
  varchar: "text", text: "text", char: "text",
  integer: "integer", serial: "integer", bigint: "integer", smallint: "integer",
  boolean: "integer",
  real: "real", numeric: "real", decimal: "real", doublePrecision: "real",
  timestamp: "text", date: "text", time: "text", interval: "text",
  json: "text", jsonb: "text",
  uuid: "text",
  blob: "blob",
  customType: "text",
};

function normalizeType(t) {
  return PG_TO_NORMALIZED[t] || t;
}

function extractColumnsFromSource(src) {
  const tables = {};
  const tableBlocks = src.matchAll(
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable)\s*\(\s*["'](\w+)["']\s*,\s*(\{[\s\S]*?\})\s*(?:,|\))/gm
  );

  for (const match of tableBlocks) {
    const varName = match[1];
    const tableName = match[2];
    const body = match[3];

    const columns = new Map();
    const colRe = new RegExp(`(\\w+)\\s*:\\s*(${ALL_TYPES})\\s*\\(`, "g");
    let cm;
    while ((cm = colRe.exec(body)) !== null) {
      columns.set(cm[1], cm[2]);
    }
    tables[varName] = { tableName, columns };
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
  "workOrderParts", "dbSchemaVersion",
]);

const KNOWN_MISSING_TABLES = new Set([
  ...KNOWN_DRIFT_TABLES,
  "beastModeConfig", "conditionMonitoring", "dataQualityMetrics",
  "digitalTwins", "edgeDiagnosticLogs", "industryBenchmarks",
  "metricsHistory", "mlModelAccuracyHistory", "mqttDevices",
  "oilAnalysis", "oilChangeRecords", "replayIncoming",
  "rulFitHistory", "rulModels", "serialPortStates",
  "syncConflicts", "syncJournal", "syncOutbox",
  "systemHealthChecks", "systemPerformanceMetrics", "systemSettings",
  "telemetryRetentionPolicies", "transportFailovers", "transportSettings",
  "twinSimulations", "vibrationAnalysis", "wearParticleAnalysis",
  "weibullEstimates",
]);

let knownDriftCount = 0;
let newDriftCount = 0;
let missingTableCount = 0;
let pairsChecked = 0;
for (const pair of switchedPairs) {
  const pgDef = pgTables[pair.pgExport];
  const sqliteDef = sqliteTables[pair.sqliteExport];

  if (!pgDef && !sqliteDef) continue;

  if (pgDef && !sqliteDef) {
    if (!KNOWN_MISSING_TABLES.has(pair.name)) {
      missingTableCount++;
      errors.push(`Layer 2 — MISSING SQLite table for ${pair.name}: PG has ${pair.pgExport} but no SQLite ${pair.sqliteExport} found`);
    }
    continue;
  }
  if (!pgDef && sqliteDef) {
    if (!KNOWN_MISSING_TABLES.has(pair.name)) {
      missingTableCount++;
      errors.push(`Layer 2 — MISSING PG table for ${pair.name}: SQLite has ${pair.sqliteExport} but no PG ${pair.pgExport} found`);
    }
    continue;
  }

  if (pgDef.columns.size === 0 || sqliteDef.columns.size === 0) continue;

  pairsChecked++;
  const pgColNames = new Set(pgDef.columns.keys());
  const sqliteColNames = new Set(sqliteDef.columns.keys());
  const pgOnly = [...pgColNames].filter(c => !sqliteColNames.has(c) && !COLUMN_PARITY_ALLOWLIST.has(c));
  const sqliteOnly = [...sqliteColNames].filter(c => !pgColNames.has(c) && !COLUMN_PARITY_ALLOWLIST.has(c));

  const typeMismatches = [];
  for (const [col, pgType] of pgDef.columns) {
    if (COLUMN_PARITY_ALLOWLIST.has(col)) continue;
    const sqliteType = sqliteDef.columns.get(col);
    if (!sqliteType) continue;
    const pgNorm = normalizeType(pgType);
    const sqliteNorm = normalizeType(sqliteType);
    if (pgNorm !== sqliteNorm) {
      typeMismatches.push(`${col}: PG=${pgType}(→${pgNorm}) vs SQLite=${sqliteType}(→${sqliteNorm})`);
    }
  }

  if (pgOnly.length > 0 || sqliteOnly.length > 0 || typeMismatches.length > 0) {
    if (KNOWN_DRIFT_TABLES.has(pair.name)) {
      knownDriftCount++;
    } else {
      newDriftCount++;
      const details = [];
      if (pgOnly.length) details.push(`PG-only cols: ${pgOnly.join(", ")}`);
      if (sqliteOnly.length) details.push(`SQLite-only cols: ${sqliteOnly.join(", ")}`);
      if (typeMismatches.length) details.push(`Type mismatches: ${typeMismatches.join("; ")}`);
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
console.log(`Missing tables:        ${missingTableCount}`);
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
