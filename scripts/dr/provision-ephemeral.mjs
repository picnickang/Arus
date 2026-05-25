#!/usr/bin/env node
/**
 * LR-2 — Ephemeral DR drill harness.
 *
 * Provisions a throwaway Postgres database, restores either the latest
 * production dump or a small fixture dump into it, runs a smoke
 * validation (schema parity vs. live + non-empty anchor tables), and
 * tears the ephemeral DB down — all in a single CI-friendly script.
 *
 * Why this exists separately from `verify-backup.mjs`:
 *   - `verify-backup.mjs` assumes you already have a scratch DB and a
 *     dump file. It's the inner validation engine.
 *   - This script is the OUTER orchestration that an on-call would run
 *     during a drill ("simulate a full DR from zero on a clean box").
 *     It owns the ephemeral DB lifecycle so the drill is reproducible.
 *
 * Connection strategy:
 *   - If `EPHEMERAL_DB_URL` is supplied, use it as-is (CI services /
 *     local docker postgres). The script will only create / drop a
 *     uniquely-named database inside that cluster, never touch the
 *     `postgres` admin DB or other tenants.
 *   - Otherwise, fail loudly. We deliberately do NOT spin up a
 *     postgres process here — managing a child process across CI
 *     runners, dev machines, and air-gapped drill kits is its own
 *     can of worms.
 *
 * Backup source selection:
 *   - `BACKUP_URL` (presigned object-storage URL) — production drill.
 *   - `BACKUP_PATH` (local custom-format dump) — laptop drill.
 *   - `--fixture` (no env var needed) — restore the small fixture
 *     dump at `scripts/dr/fixtures/baseline.dump` if present. Designed
 *     for first-time wiring or smoke-running the harness itself
 *     without leaking real prod credentials into CI.
 *
 * Exit codes mirror `verify-backup.mjs`:
 *   0 — drill passed
 *   1 — validation failure (read the JSON report at REPORT_PATH)
 *   2 — harness error (couldn't connect, missing inputs)
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const FIXTURE_PATH = join(SCRIPT_DIR, "fixtures", "baseline.dump");

function log(msg) {
  console.log(`[dr-drill] ${msg}`);
}

function die(code, message) {
  console.error(`[dr-drill] FATAL: ${message}`);
  process.exit(code);
}

async function run(cmd, args, opts = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function psqlExec(adminUrl, sql) {
  return new Promise((resolveExec, rejectExec) => {
    const child = spawn("psql", [adminUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", rejectExec);
    child.on("close", (code) => {
      if (code === 0) resolveExec();
      else rejectExec(new Error(`psql exited ${code}: ${stderr}`));
    });
  });
}

function deriveEphemeralUrl(adminUrl, dbName) {
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function main() {
  const adminUrl = process.env.EPHEMERAL_DB_URL;
  if (!adminUrl) {
    die(
      2,
      "EPHEMERAL_DB_URL is required (a Postgres cluster URL where this script may create/drop databases — e.g. a CI services postgres or a local docker-compose db).",
    );
  }

  const live = process.env.DATABASE_URL;
  if (!live) {
    die(2, "DATABASE_URL is required (read-only live DB for parity reference).");
  }

  const useFixture = process.argv.includes("--fixture");
  const backupUrl = process.env.BACKUP_URL;
  const backupPath = process.env.BACKUP_PATH;

  if (!useFixture && !backupUrl && !backupPath) {
    die(
      2,
      "Pass one of: --fixture, BACKUP_URL=..., or BACKUP_PATH=... to indicate which dump to restore.",
    );
  }

  if (useFixture && !existsSync(FIXTURE_PATH)) {
    die(
      2,
      `--fixture requested but ${FIXTURE_PATH} does not exist. Generate one with:\n` +
        `  pg_dump --format=custom --no-owner --no-privileges $DATABASE_URL > scripts/dr/fixtures/baseline.dump\n` +
        `(scrubbed of tenant PII first — see scripts/dr/README.md).`,
    );
  }

  const dbName = `arus_drdrill_${Date.now()}_${randomUUID().slice(0, 8)}`.toLowerCase();
  const ephemeralUrl = deriveEphemeralUrl(adminUrl, dbName);

  log(`Ephemeral DB: ${dbName}`);
  log("Creating ephemeral database...");
  // Connect to the admin DB (whatever the URL points at) to issue CREATE DATABASE.
  await psqlExec(adminUrl, `CREATE DATABASE "${dbName}"`);

  try {
    log("Running backup verification against ephemeral DB...");
    const env = {
      ...process.env,
      DATABASE_URL: live,
      VERIFY_DATABASE_URL: ephemeralUrl,
    };
    if (useFixture) {
      env.BACKUP_PATH = FIXTURE_PATH;
    }
    await run("node", [join(SCRIPT_DIR, "verify-backup.mjs")], { env, cwd: REPO_ROOT });
    log("Drill passed.");
  } catch (err) {
    log(`Drill FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    log("Tearing down ephemeral database...");
    try {
      // FORCE so any leftover sessions from a crashed run can't block teardown.
      await psqlExec(
        adminUrl,
        `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`,
      );
      log(`Ephemeral DB ${dbName} dropped.`);
    } catch (err) {
      // Don't shadow the original exit code — just warn.
      log(
        `WARN: teardown of ${dbName} failed: ${err instanceof Error ? err.message : String(err)}. ` +
          `Manual cleanup may be required.`,
      );
    }
  }
}

main().catch((err) => {
  die(2, `harness error: ${err instanceof Error ? err.message : String(err)}`);
});
