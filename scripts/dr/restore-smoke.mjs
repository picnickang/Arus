#!/usr/bin/env node
// LR-3 — Restore smoke suite. Runs a fixed set of correctness probes
// against a (presumably just-restored) Postgres URL. Exits non-zero
// on any failure so the orchestrator (provision-ephemeral.mjs, CI)
// can fail the drill.
//
// Probes:
//   1. Pool opens, `SELECT 1` returns.
//   2. `__drizzle_migrations` head matches the count of files in
//      `migrations/` on disk (no missing or extra applied rows).
//   3. RLS smoke: with two distinct `org_id` UUIDs set via
//      `app.current_org_id`, an INSERT as tenant A is not visible
//      to a SELECT as tenant B against a representative tenanted
//      table (`equipment`).
//   4. Object-storage cross-reference (skipped unless
//      `--check-object-storage` and `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
//      are present): sample 10 `kb_documents.storage_key` rows and
//      assert each one exists.
//
// Usage:
//   node scripts/dr/restore-smoke.mjs --db-url=postgres://...
//   node scripts/dr/restore-smoke.mjs --db-url=$EPHEMERAL_DB_URL --check-object-storage

import { readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.length ? rest.join("=") : "true"];
  }),
);

const dbUrl = args["db-url"] ?? process.env["DATABASE_URL"];
if (!dbUrl) {
  console.error("usage: restore-smoke.mjs --db-url=<postgres-url>");
  process.exit(2);
}

const checkObjectStorage = args["check-object-storage"] === "true";

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

async function probeConnectivity() {
  const { rows } = await pool.query("SELECT 1 AS ok");
  if (rows[0]?.ok !== 1) throw new Error("SELECT 1 returned unexpected shape");
}

async function probeMigrationHead() {
  // Drizzle stores applied migrations in `__drizzle_migrations` (id, hash, created_at).
  const { rows: applied } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM __drizzle_migrations",
  );
  const onDisk = readdirSync("migrations", { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".sql"))
    .length;
  if (applied[0].n !== onDisk) {
    throw new Error(`applied=${applied[0].n} on-disk=${onDisk}`);
  }
  return `${applied[0].n} migrations`;
}

async function probeRls() {
  // Defence-in-depth: confirm RLS is actually enabled on the
  // `equipment` table before trusting the cross-org isolation
  // probe. A restored database with RLS disabled would let the
  // probe silently pass — the worst kind of false green.
  const { rows: rlsRows } = await pool.query(
    "SELECT relrowsecurity AS enabled FROM pg_class WHERE relname = 'equipment'",
  );
  if (rlsRows.length === 0) {
    throw new Error("equipment table not present");
  }
  if (rlsRows[0].enabled !== true) {
    throw new Error(
      "RLS NOT ENABLED on equipment — restore is missing security policies",
    );
  }

  const orgA = randomUUID();
  const orgB = randomUUID();
  const eqId = randomUUID();
  const clientA = await pool.connect();
  const clientB = await pool.connect();
  try {
    await clientA.query("BEGIN");
    await clientA.query(`SET LOCAL app.current_org_id = '${orgA}'`);
    await clientA.query(
      `INSERT INTO equipment (id, org_id, name, type)
         VALUES ($1, $2, 'restore-smoke', 'pump')
         ON CONFLICT DO NOTHING`,
      [eqId, orgA],
    );

    await clientB.query("BEGIN");
    await clientB.query(`SET LOCAL app.current_org_id = '${orgB}'`);
    const { rows } = await clientB.query(
      "SELECT id FROM equipment WHERE id = $1",
      [eqId],
    );
    if (rows.length !== 0) {
      throw new Error(
        `RLS BREACH: orgB saw orgA equipment ${eqId} (${rows.length} rows)`,
      );
    }
    await clientA.query("ROLLBACK");
    await clientB.query("ROLLBACK");
  } finally {
    clientA.release();
    clientB.release();
  }
  return "orgB cannot read orgA equipment";
}

async function probeObjectStorage() {
  if (!process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"]) {
    return "skipped (no bucket configured)";
  }
  const { rows } = await pool.query(
    "SELECT storage_key FROM kb_documents WHERE storage_key IS NOT NULL ORDER BY random() LIMIT 10",
  );
  if (rows.length === 0) return "skipped (no kb_documents rows)";
  // We resolve via the same object-storage client the server uses
  // so credentials and bucket layout match production reality.
  const { ObjectStorageClient } = await import("../../server/objectStorage.js")
    .catch(async () => await import("../../server/objectStorage.ts"));
  if (!ObjectStorageClient) {
    return "skipped (object-storage client not exported in this build)";
  }
  const client = new ObjectStorageClient();
  let missing = 0;
  for (const { storage_key: key } of rows) {
    const exists = await client.head(key).then(() => true).catch(() => false);
    if (!exists) missing += 1;
  }
  if (missing > 0) throw new Error(`${missing}/${rows.length} keys missing`);
  return `${rows.length}/${rows.length} sampled keys present`;
}

async function run(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail);
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  console.log(`Restore smoke against ${dbUrl.replace(/:[^:@]+@/, ":***@")}`);
  await run("connectivity", probeConnectivity);
  await run("migration-head", probeMigrationHead);
  await run("rls-tenant-isolation", probeRls);
  if (checkObjectStorage) {
    await run("object-storage-cross-ref", probeObjectStorage);
  }
  await pool.end();
  const failed = results.filter((r) => !r.ok);
  console.log("");
  if (failed.length === 0) {
    console.log(`RESTORE-SMOKE GREEN — ${results.length} probe(s) passed`);
    process.exit(0);
  }
  console.error(`RESTORE-SMOKE RED — ${failed.length}/${results.length} probe(s) failed`);
  process.exit(1);
}

main().catch(async (err) => {
  console.error("restore-smoke unexpected error:", err);
  await pool.end().catch(() => {});
  process.exit(2);
});
