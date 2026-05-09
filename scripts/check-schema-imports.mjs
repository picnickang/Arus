#!/usr/bin/env node
/**
 * Schema Import Boundary Enforcement
 *
 * Ensures server-side code imports from shared/schema-runtime (the dual-mode switcher)
 * rather than directly from shared/schema/* or shared/sqlite-schema/*.
 *
 * Direct imports bypass the runtime mode switch and will use the wrong schema
 * in vessel (SQLite) or cloud (PG) mode.
 *
 * Allowed exceptions:
 *   - Files inside shared/ itself (schema definition files)
 *   - Explicit type-only imports (import type { ... })
 *   - Files in the allowlist below (e.g., migration scripts, test utilities)
 *
 * Run:  node scripts/check-schema-imports.mjs
 * Exit: 0 = pass, 1 = violation found
 */

import { readFileSync, readdirSync } from "fs";
import { dirname, resolve, relative, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const ALLOWED_FILES = new Set([
  "server/db-config.ts",
  "server/sqlite-init.ts",
  "server/storage/db-storage.ts",
  "server/domains/agent/infrastructure/external-data-cache.ts",
  "server/domains/agent/infrastructure/file-registry.ts",
  "server/domains/alerts/settings-routes.ts",
  "server/domains/crew/lifecycle/lifecycle-repository.ts",
  "server/domains/equipment/lifecycle/lifecycle-repository.ts",
  "server/domains/equipment/lifecycle/lifecycle-validation.ts",
  "server/domains/permissions/repository.ts",
  "server/domains/permissions/routes.ts",
  "server/domains/permissions/service.ts",
  "server/modules/fleet-registry/domain/types.ts",
  "server/pdm/adapters/pdm-postgres.repository.ts",
  "server/scripts/test/seedPdMCases.ts",
  "server/services/scheduler-notifications/index.ts",
  "server/services/scheduling-settings/service.ts",
  "server/telemetry/adapters/batch-ack.ts",
  "server/telemetry/adapters/equipment-heartbeat.ts",
  "server/telemetry/adapters/postgres-dlq.ts",
  "server/telemetry/adapters/raw-archive.ts",
  "server/telemetry/adapters/schema-registry.ts",
  "server/compliance/routes/ml-governance-routes.ts",
  "server/compliance/work-order-history-hash.service.ts",
  "server/db/condition-monitoring/db-condition-monitoring.ts",
  "server/db/condition-monitoring/types.ts",
  "server/db/crew-extensions/db-crew-extensions.ts",
  "server/db/crew-extensions/types.ts",
  "server/db/notifications/db-notifications.ts",
  "server/db/operating-conditions/db-operating-conditions.ts",
  "server/db/operating-conditions/types.ts",
  "server/db/optimizer/db-optimizer.ts",
  "server/db/optimizer/types.ts",
  "server/db/scheduler/db-scheduler.ts",
  "server/db/sensors/db-sensors.ts",
  "server/db/sensors/types.ts",
  "server/db/stormgeo/types.ts",
  "server/domains/agent/application/scheduler-service.ts",
  "server/domains/agent/application/suggestion-engine.ts",
  "server/domains/agent/domain/ports.ts",
  "server/domains/agent/infrastructure/activity-repository-adapter.ts",
  "server/domains/agent/infrastructure/briefing-repository-adapter.ts",
  "server/domains/agent/infrastructure/finding-repository-adapter.ts",
  "server/domains/agent/infrastructure/findings-adapter.ts",
  "server/domains/agent/infrastructure/prediction-feedback-adapter.ts",
  "server/domains/agent/infrastructure/repository.ts",
  "server/domains/agent/infrastructure/task-repository-adapter.ts",
  "server/domains/agent/tools/alert-tools.ts",
  "server/domains/agent/tools/crew-tools.ts",
  "server/domains/agent/tools/equipment-tools.ts",
  "server/domains/agent/tools/maintenance-tools.ts",
  "server/domains/agent/tools/prediction-tools.ts",
  "server/domains/agent/tools/report-tools.ts",
  "server/domains/agent/tools/weather-tools.ts",
  "server/domains/agent/tools/work-order-tools.ts",
  "server/domains/alerts/settings/cooldown.ts",
  "server/domains/alerts/settings/crew-settings.ts",
  "server/domains/alerts/settings/email-logs.ts",
  "server/domains/alerts/settings/org-settings.ts",
  "server/domains/alerts/settings-service.ts",
  "server/domains/alerts/settings/thresholds.ts",
  "server/domains/certificates/infrastructure/certificate-repository-adapter.ts",
  "server/domains/certificates/interfaces/routes.ts",
  "server/domains/crew-extensions/infrastructure/crew-assignment-projection.ts",
  "server/domains/crew-extensions/infrastructure/crew-data-adapter.ts",
  "server/domains/crew-extensions/infrastructure/schedule-planner-read-model.ts",
  "server/domains/crew-extensions/infrastructure/vessel-data-adapter.ts",
  "server/domains/crew-extensions/interfaces/assignments-routes.ts",
  "server/domains/crew-extensions/interfaces/certifications-routes.ts",
  "server/domains/crew-extensions/interfaces/leave-routes.ts",
  "server/domains/crew-extensions/interfaces/shifts-routes.ts",
  "server/domains/equipment/lifecycle/lifecycle-service.ts",
  "server/domains/inventory/application/supplier-performance-service.ts",
  "server/domains/inventory/infrastructure/work-order-demand-repository-adapter.ts",
  "server/domains/pdm-platform/digital-twin/replay/adapter.ts",
  "server/domains/pdm-platform/digital-twin/replay/routes.ts",
  "server/domains/pdm-platform/digital-twin/residual-analysis/adapter.ts",
  "server/domains/pdm-platform/digital-twin/residual-analysis/residual-analysis.service.ts",
  "server/domains/pdm-platform/digital-twin/scenario-sim/adapter.ts",
  "server/domains/pdm-platform/digital-twin/scenario-sim/scenario-sim.service.ts",
  "server/domains/pdm-platform/digital-twin/twin-definition/adapter.ts",
  "server/domains/pdm-platform/digital-twin/twin-definition/ports.ts",
  "server/domains/pdm-platform/digital-twin/twin-definition/routes.ts",
  "server/domains/pdm-platform/digital-twin/twin-state/adapter.ts",
  "server/domains/pdm-platform/decision-support/infrastructure/drizzle-pdm-context.adapter.ts",
  "server/domains/pdm-platform/feature-store/adapter.ts",
  "server/domains/pdm-platform/feature-store/telemetry-adapter.ts",
  "server/domains/pdm-platform/fleet-analytics/adapter.ts",
  "server/domains/pdm-platform/inference/prediction-engine.service.ts",
  "server/domains/pdm-platform/model-registry/adapter.ts",
  "server/domains/pdm-platform/monitoring/adapter.ts",
  "server/domains/pdm-platform/prediction-governance/adapter.ts",
  "server/domains/pdm-platform/training-pipeline/adapter.ts",
  "server/domains/pdm-platform/training-pipeline/ports.ts",
  "server/domains/pdm-platform/training-pipeline/training-pipeline.service.ts",
  "server/domains/pdm-platform/twin-updates/adapter.ts",
  "server/domains/purchasing/infrastructure/purchase-event-repository-adapter.ts",
  "server/domains/schematic-layout/infrastructure/schematic-layout-repository.ts",
  "server/domains/stcw-rest/routes/import.ts",
  "server/import-adapters/amos/import-service.ts",
  "server/import-adapters/shipmate/import-service.ts",
  "server/lib/outbox/outbox-processor.ts",
  "server/purchasing/email-worker.ts",
  "server/purchasing/fulfillment-service.ts",
  "server/purchasing/po-routes.ts",
  "server/purchasing/pr-draft-service.ts",
  "server/purchasing/pr-routes.ts",
  "server/purchasing/pr-send-service.ts",
  "server/purchasing/repository.ts",
  "server/purchasing/supplier-link-service.ts",
  "server/purchasing/types.ts",
  "server/replit_integrations/chat/storage.ts",
  "server/report-context/knowledge-citations.ts",
  "server/routes/analytics/costs-and-feedback.ts",
  "server/routes/analytics/model-governance.ts",
  "server/routes/analytics/predictions.ts",
  "server/service-orders/repository.ts",
  "server/service-orders/routes.ts",
  "server/service-orders/types.ts",
  "server/services/condition-log/aggregators.ts",
  "server/services/condition-log/entry-creator.ts",
  "server/services/condition-log/queries.ts",
  "server/services/config-manager.ts",
  "server/services/data-reconciliation/service.ts",
  "server/services/data-reconciliation/validators.ts",
  "server/services/document-ingestion/repository.ts",
  "server/services/email-notification/service.ts",
  "server/services/engine-log-autofill/types.ts",
  "server/services/fuel-emissions/entry-creators.ts",
  "server/services/fuel-emissions/orchestrator.ts",
  "server/services/fuel-emissions/telemetry-aggregation.ts",
  "server/services/rag/analytics/index.ts",
  "server/services/rag/cleanup-job.ts",
  "server/services/rag/comparison/index.ts",
  "server/services/track-log-service.ts",
  "server/services/update-scheduler.ts",
  "server/storage/domains/analytics-insights-adapter.ts",
  "server/storage/interfaces/domains/admin.types.ts",
  "server/storage/interfaces/domains/alerts.types.ts",
  "server/storage/interfaces/domains/analytics.types.ts",
  "server/storage/interfaces/domains/compliance.types.ts",
  "server/storage/interfaces/domains/condition-monitoring.types.ts",
  "server/storage/interfaces/domains/core.types.ts",
  "server/storage/interfaces/domains/crew.types.ts",
  "server/storage/interfaces/domains/device.types.ts",
  "server/storage/interfaces/domains/equipment.types.ts",
  "server/storage/interfaces/domains/external.types.ts",
  "server/storage/interfaces/domains/inventory.types.ts",
  "server/storage/interfaces/domains/logbook.types.ts",
  "server/storage/interfaces/domains/maintenance.types.ts",
  "server/storage/interfaces/domains/ml.types.ts",
  "server/storage/interfaces/domains/scheduling.types.ts",
  "server/storage/interfaces/domains/sensor.types.ts",
  "server/storage/interfaces/domains/telemetry.types.ts",
  "server/storage/interfaces/domains/vessel.types.ts",
  "server/storage/interfaces/domains/work-order.types.ts",
  "server/suppliers/repository.ts",
  "server/suppliers/routes.ts",
]);

const DIRECT_SCHEMA_RE =
  /from\s+['"]@shared\/schema(?:\/[^"']*)?['"]|from\s+['"]@shared\/sqlite-schema(?:\/[^"']*)?['"]|from\s+['"]\.\.\/.*shared\/schema(?:\/[^"']*)?['"]|from\s+['"]\.\.\/.*shared\/sqlite-schema(?:\/[^"']*)?['"]/;
const SCHEMA_RUNTIME_RE = /from\s+['"]@shared\/schema-runtime['"]/;

function walkDir(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

const serverDir = resolve(root, "server");
const tsFiles = walkDir(serverDir);

// Match full multi-line `import type { ... } from "..."` statements so that
// the closing brace line (which doesn't contain "import type" literally)
// isn't flagged as a violation.
const TYPE_IMPORT_BLOCK_RE = /import\s+type\s*\{[^}]*\}\s+from\s+["'][^"']+["']\s*;?/gs;

const violations = [];
for (const filePath of tsFiles) {
  const relPath = relative(root, filePath);

  if (ALLOWED_FILES.has(relPath)) continue;

  let content = readFileSync(filePath, "utf8");
  // Strip multi-line `import type { ... } from "..."` blocks before
  // line-by-line scanning so their internals are not flagged.
  content = content.replace(TYPE_IMPORT_BLOCK_RE, (m) =>
    "\n".repeat((m.match(/\n/g) || []).length)
  );
  const fileLines = content.split("\n");
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    if (line.trimStart().startsWith("//")) continue;
    if (line.includes("import type")) continue;
    if (SCHEMA_RUNTIME_RE.test(line)) continue;
    if (DIRECT_SCHEMA_RE.test(line)) {
      violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
    }
  }
}

console.log("=== Schema Import Boundary ===");
if (violations.length > 0) {
  console.log(`${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.log(`  ✗ ${v}`);
  }
  console.log(
    "\nFix: Import from @shared/schema-runtime instead of @shared/schema/* or @shared/sqlite-schema/*"
  );
  console.log("Direct schema imports bypass the dual-DB mode switch.");
  process.exit(1);
} else {
  console.log("No direct schema imports found in server code. All clear.");
  process.exit(0);
}
