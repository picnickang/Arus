#!/usr/bin/env node
/**
 * RLS / tenant-registry coverage guard.
 *
 * server/tenancy/tenant-tables.ts is the single source of truth for
 * which tables are tenant-scoped: it drives the RLS migrations AND the
 * GDPR TenantDeleteService. Drift in either direction is a real,
 * already-observed failure mode:
 *
 *   - org_id table missing from the registry → no RLS policy, skipped
 *     by GDPR delete (silent tenant-isolation gap).
 *   - registry entry without a backing table (renamed, dropped, or
 *     never created) → TenantDeleteService's `DELETE FROM <t>` throws
 *     "relation does not exist" and aborts the whole tenant delete.
 *     The first registry draft had 13 such phantoms and migration 0044
 *     added 3 more by dropping listed tables.
 *   - registry entry in no RLS migration → table is tenant-scoped on
 *     paper but cross-tenant readable in Postgres.
 *
 * Checks:
 *   1. Every TENANT_TABLES entry is backed by a shared/schema pgTable
 *      that has the tenant column (org_id or the per-entry override) —
 *      except MIGRATION_CREATED_TENANT_TABLES (created in raw SQL).
 *   2. Every org_id-bearing pgTable in shared/schema is listed in
 *      TENANT_TABLES.
 *   3. RLS_EXEMPT entries name registry tables and carry a non-empty
 *      reason (the cross-org code path that would break under RLS).
 *   4. Every non-exempt registry entry appears in an RLS migration
 *      (ARRAY list in 0018/0045-style migrations, or a literal
 *      `ALTER TABLE <t> ... ROW LEVEL SECURITY`), and no exempt entry
 *      does. Until the first catch-up migration exists
 *      (0045_rls_catchup.sql), missing RLS enablement is reported as a
 *      warning worklist instead of an error.
 *
 * Run:  node scripts/check-rls-coverage.mjs
 * Exit: 0 = pass, 1 = violation found
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const schemaDir = resolve(root, "shared/schema");
const migrationsDir = resolve(root, "migrations");
const registryPath = resolve(root, "server/tenancy/tenant-tables.ts");

// The catch-up migration that brings the registry's full set under RLS.
// Until it lands, check 4 only warns (bootstrap mode).
const CATCHUP_MIGRATION = "0045_rls_catchup.sql";

/** Extract `export const <name> = pgTable("<physical>", ...)` bodies. */
function extractTables(src) {
  const tables = [];
  const re = /export const (\w+) = pgTable\(\s*"([a-z_0-9]+)"\s*,/g;
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
    tables.push({ physical: m[2], body: src.slice(re.lastIndex, i - 1) });
  }
  return tables;
}

/** Slice an `export const NAME = ...` block out of the registry source. */
function sliceExport(src, name) {
  const start = src.indexOf(`export const ${name}`);
  if (start === -1) return "";
  const end = src.indexOf("]);", start);
  return end === -1 ? src.slice(start) : src.slice(start, end);
}

// ---------------------------------------------------------------- schema
const schemaTables = new Map(); // physical name -> { file, columns body }
for (const fileName of readdirSync(schemaDir).sort()) {
  if (!fileName.endsWith(".ts") || fileName.endsWith(".d.ts")) continue;
  const src = readFileSync(join(schemaDir, fileName), "utf8");
  for (const t of extractTables(src)) {
    schemaTables.set(t.physical, { file: fileName, body: t.body });
  }
}

function hasColumn(body, column) {
  if (column === "org_id" && /\.\.\.tenantColumn\(/.test(body)) return true;
  return new RegExp(`["']${column}["']`).test(body);
}

// -------------------------------------------------------------- registry
const registrySrc = readFileSync(registryPath, "utf8");

const tenantSection = sliceExport(registrySrc, "TENANT_TABLES");
const registry = []; // { table, tenantColumn }
for (const m of tenantSection.matchAll(
  /\{\s*table:\s*"([a-z_0-9]+)"(?:\s*,\s*tenantColumn:\s*"([a-z_0-9]+)")?/g
)) {
  registry.push({ table: m[1], tenantColumn: m[2] ?? "org_id" });
}

const exemptSection = sliceExport(registrySrc, "RLS_EXEMPT");
const exempt = []; // { table, reason }
for (const m of exemptSection.matchAll(
  /\{\s*table:\s*"([a-z_0-9]+)",\s*reason:\s*"([\s\S]*?)"\s*,?\s*\}/g
)) {
  exempt.push({ table: m[1], reason: m[2].trim() });
}

const migrationCreated = new Set(
  [...sliceExport(registrySrc, "MIGRATION_CREATED_TENANT_TABLES").matchAll(
    /"([a-z_0-9]+)"/g
  )].map((m) => m[1])
);

// ------------------------------------------------------- RLS migrations
// Tables RLS-enabled via TENANT_TABLES arrays (0018/0045 style) or
// literal `ALTER TABLE <t> FORCE ROW LEVEL SECURITY` statements (0034/
// 0038 style). Only up-migrations count.
const rlsEnabled = new Set();
for (const fileName of readdirSync(migrationsDir).sort()) {
  if (!fileName.endsWith(".sql") || fileName.endsWith(".down.sql")) continue;
  const src = readFileSync(join(migrationsDir, fileName), "utf8");
  for (const block of src.matchAll(
    /TENANT_TABLES\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/g
  )) {
    for (const m of block[1].matchAll(/'([a-z_0-9]+)'/g)) rlsEnabled.add(m[1]);
  }
  for (const m of src.matchAll(
    /ALTER TABLE\s+([a-z_0-9]+)\s+FORCE ROW LEVEL SECURITY/gi
  )) {
    rlsEnabled.add(m[1]);
  }
}

// ----------------------------------------------------------------- checks
const errors = [];
const warnings = [];
const registryNames = new Set(registry.map((r) => r.table));
const exemptNames = new Set(exempt.map((e) => e.table));

// 1. Registry entries must be backed by a real schema table + column.
for (const { table, tenantColumn } of registry) {
  if (migrationCreated.has(table)) continue;
  const schema = schemaTables.get(table);
  if (!schema) {
    errors.push(
      `phantom registry entry "${table}" — no pgTable with that physical name in shared/schema; ` +
        `TenantDeleteService would abort on it ("relation does not exist")`
    );
  } else if (!hasColumn(schema.body, tenantColumn)) {
    errors.push(
      `registry entry "${table}" lacks its tenant column "${tenantColumn}" (${schema.file})`
    );
  }
}

// 2. Every org_id table must be registered.
for (const [physical, { file, body }] of schemaTables) {
  if (!hasColumn(body, "org_id")) continue;
  if (physical === "organizations") continue;
  if (!registryNames.has(physical)) {
    errors.push(
      `org_id table "${physical}" (${file}) is not in TENANT_TABLES — ` +
        `it gets no RLS policy and is skipped by GDPR tenant delete`
    );
  }
}

// 3. Exempt entries: known tables, non-empty reasons.
for (const { table, reason } of exempt) {
  if (!registryNames.has(table)) {
    errors.push(
      `RLS_EXEMPT entry "${table}" is not in TENANT_TABLES — exemption only applies to registered tenant tables`
    );
  }
  if (!reason) {
    errors.push(`RLS_EXEMPT entry "${table}" has an empty reason`);
  }
}

// 4. RLS enablement coverage.
const catchupExists = existsSync(join(migrationsDir, CATCHUP_MIGRATION));
const unprotected = registry
  .map((r) => r.table)
  .filter((t) => !exemptNames.has(t) && !rlsEnabled.has(t));
if (unprotected.length > 0) {
  const lines = unprotected.map((t) => `  '${t}',`).join("\n");
  if (catchupExists) {
    errors.push(
      `${unprotected.length} registry table(s) are in no RLS migration (add to ${CATCHUP_MIGRATION} or RLS_EXEMPT):\n${lines}`
    );
  } else {
    warnings.push(
      `${unprotected.length} registry table(s) await RLS enablement — worklist for ${CATCHUP_MIGRATION}:\n${lines}`
    );
  }
}
// tenant_quotas/tenant_usage appear in 0018's array but never actually
// got RLS: 0018's DO block runs before their CREATE TABLE at the bottom
// of the same file, so the has_table check skipped them. The hub-admin
// tenant console depends on that (cross-org reads/writes), hence the
// exemption. Do not extend this set — new contradictions are bugs.
const KNOWN_ARRAY_VS_REALITY = new Set(["tenant_quotas", "tenant_usage"]);
for (const t of exemptNames) {
  if (rlsEnabled.has(t) && !KNOWN_ARRAY_VS_REALITY.has(t)) {
    errors.push(
      `RLS_EXEMPT table "${t}" already has RLS enabled by a migration — drop the exemption or the policy, not both`
    );
  }
}

// ----------------------------------------------------------------- report
console.log("=== RLS / Tenant Registry Coverage ===");
console.log(
  `${schemaTables.size} schema tables, ${registry.length} registry entries ` +
    `(${exempt.length} RLS-exempt, ${migrationCreated.size} migration-created), ` +
    `${rlsEnabled.size} tables RLS-enabled by migrations`
);
for (const w of warnings) console.log(`\n⚠ ${w}`);
if (errors.length > 0) {
  console.log(`\n${errors.length} violation(s):\n`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(
    "\nFix: keep server/tenancy/tenant-tables.ts in lockstep with shared/schema " +
      "(add new org_id tables to TENANT_TABLES + the current RLS catch-up migration; " +
      "remove entries when tables are dropped/renamed; RLS_EXEMPT needs a reason)."
  );
  process.exit(1);
}
console.log("\nRegistry, schema, and RLS migrations are in lockstep. All clear.");
process.exit(0);
