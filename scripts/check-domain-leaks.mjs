#!/usr/bin/env node
/**
 * Domain Leak Burndown Tracker
 *
 * Counts three categories of "domain leakage":
 *   A) Dynamic imports (`await import(...)`) of cross-module code in server/
 *      — bypasses static analysis, hides coupling, defeats tree-shaking.
 *   B) Routes that import `db*Storage` directly instead of going through
 *      a domain service (or the repositories barrel from a domain layer).
 *   C) Files inside one server/domains/X/ that reference db storages
 *      belonging to another domain (cross-domain infrastructure coupling).
 *
 * Compares totals against scripts/domain-leak-baseline.json. Exits non-zero
 * if any category increased — same monotonic-decrease pattern as the drift
 * burndown.
 *
 * Regenerate baseline (manual, after intentional reductions):
 *   node scripts/check-domain-leaks.mjs --write-baseline
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const SERVER_DIR = resolve("server");
const DOMAINS_DIR = resolve("server/domains");
const BASELINE_PATH = resolve("scripts/domain-leak-baseline.json");

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".cache"]);

const DB_STORAGE_RE = /\bdb[A-Z][A-Za-z]*Storage\b/g;
const DYNAMIC_IMPORT_RE = /await\s+import\s*\(\s*["']([^"']+)["']\s*\)/g;

async function walkTs(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkTs(full)));
    else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function domainOf(filePath) {
  const rel = relative(DOMAINS_DIR, filePath);
  if (rel.startsWith("..")) return null;
  return rel.split("/")[0];
}

// Map db*Storage symbol → owning domain. Best-effort heuristic.
const STORAGE_DOMAIN_MAP = {
  dbWorkOrderStorage: "work-orders",
  dbChecklistsStorage: "work-orders",
  dbEquipmentStorage: "equipment",
  dbVesselsStorage: "vessels",
  dbAlertStorage: "alerts",
  dbAlertsStorage: "alerts",
  dbInventoryStorage: "inventory",
  dbCrewStorage: "crew",
  dbCrewExtensionsStorage: "crew",
  dbSensorsStorage: "sensor-management",
  dbTelemetryStorage: "telemetry",
  dbMlAnalyticsStorage: "pdm-platform",
  dbMaintenanceStorage: "maintenance",
  dbMaintenanceTemplatesStorage: "maintenance",
  dbAnalyticsStorage: "analytics",
  dbSystemAdminStorage: "system-admin",
  dbDtcStorage: "dtc",
  dbGdprStorage: "gdpr",
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeBaseline = args.has("--write-baseline");

  const allFiles = await walkTs(SERVER_DIR);

  // A) Dynamic imports
  const dynamicImports = [];
  // B) Route files importing db*Storage
  const routeStorageImports = [];
  // C) Cross-domain db*Storage references
  const crossDomainStorage = [];

  for (const file of allFiles) {
    const rel = relative(process.cwd(), file);
    const content = await readFile(file, "utf8");

    // A) dynamic imports
    DYNAMIC_IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = DYNAMIC_IMPORT_RE.exec(content)) !== null) {
      const target = m[1];
      // Only count internal/relative dynamic imports (skip vendored)
      if (!target.startsWith(".") && !target.startsWith("@shared") && !target.startsWith("@server"))
        continue;
      dynamicImports.push({ file: rel, target });
    }

    // B) route files importing db*Storage
    const isRouteFile =
      rel.includes("/routes/") || /\/routes?\.ts$/.test(rel) || /-routes\.ts$/.test(rel);
    if (isRouteFile) {
      DB_STORAGE_RE.lastIndex = 0;
      const seen = new Set();
      while ((m = DB_STORAGE_RE.exec(content)) !== null) {
        if (!seen.has(m[0])) {
          seen.add(m[0]);
          routeStorageImports.push({ file: rel, storage: m[0] });
        }
      }
    }

    // C) cross-domain storage refs
    const sourceDomain = domainOf(file);
    if (sourceDomain) {
      DB_STORAGE_RE.lastIndex = 0;
      const seen = new Set();
      while ((m = DB_STORAGE_RE.exec(content)) !== null) {
        const storage = m[0];
        const targetDomain = STORAGE_DOMAIN_MAP[storage];
        if (!targetDomain || targetDomain === sourceDomain) continue;
        const key = `${storage}->${targetDomain}`;
        if (seen.has(key)) continue;
        seen.add(key);
        crossDomainStorage.push({
          file: rel,
          storage,
          fromDomain: sourceDomain,
          toDomain: targetDomain,
        });
      }
    }
  }

  const totals = {
    dynamicImports: dynamicImports.length,
    routeStorageImports: routeStorageImports.length,
    crossDomainStorage: crossDomainStorage.length,
  };
  totals.total = totals.dynamicImports + totals.routeStorageImports + totals.crossDomainStorage;

  console.log("=== Domain Leak Counts ===");
  console.log(`A) Dynamic internal imports     : ${totals.dynamicImports}`);
  console.log(`B) Route-level db*Storage refs  : ${totals.routeStorageImports}`);
  console.log(`C) Cross-domain db*Storage refs : ${totals.crossDomainStorage}`);
  console.log(`   ────────────────────────────`);
  console.log(`   Total                        : ${totals.total}`);

  if (writeBaseline) {
    const payload = {
      _comment:
        "Domain leak baseline. Counts must monotonically decrease. Regenerate with: node scripts/check-domain-leaks.mjs --write-baseline",
      generatedAt: new Date().toISOString(),
      totals,
      samples: {
        dynamicImports: dynamicImports.slice(0, 25),
        routeStorageImports: routeStorageImports.slice(0, 25),
        crossDomainStorage: crossDomainStorage.slice(0, 25),
      },
    };
    await writeFile(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
    console.log(`\n✓ Baseline written to ${relative(process.cwd(), BASELINE_PATH)}`);
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  } catch {
    console.warn("\n⚠️  No baseline found. Run with --write-baseline to create one.");
    return;
  }

  const regressions = [];
  for (const k of ["dynamicImports", "routeStorageImports", "crossDomainStorage"]) {
    if (totals[k] > baseline.totals[k]) {
      regressions.push(
        `  ${k}: ${baseline.totals[k]} → ${totals[k]} (+${totals[k] - baseline.totals[k]})`
      );
    }
  }

  if (regressions.length) {
    console.error("\n❌ Domain leak count INCREASED:");
    regressions.forEach((r) => console.error(r));
    console.error("\nFix the regression or, if it's intentional, update the baseline:");
    console.error("  node scripts/check-domain-leaks.mjs --write-baseline");
    process.exit(1);
  }

  const reductions = [];
  for (const k of ["dynamicImports", "routeStorageImports", "crossDomainStorage"]) {
    if (totals[k] < baseline.totals[k]) {
      reductions.push(
        `  ${k}: ${baseline.totals[k]} → ${totals[k]} (-${baseline.totals[k] - totals[k]})`
      );
    }
  }
  if (reductions.length) {
    console.log("\n✓ Reductions detected (consider regenerating baseline):");
    reductions.forEach((r) => console.log(r));
  } else {
    console.log("\n✓ Domain leak counts at or below baseline.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
