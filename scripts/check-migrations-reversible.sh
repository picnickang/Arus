#!/usr/bin/env bash
# ============================================================================
# LR-1A — Migration reversibility CI check.
#
# Proves the numbered migrations/NNNN_*.sql replay AND reverse cleanly on top
# of the real schema, by running repeated up→down→up cycles in a throwaway
# database and diffing the schema across two full cycles.
#
# WHY A SCRATCH DATABASE (not a scratch schema) + A SEEDED BASELINE:
#   The numbered migrations are additive deltas on top of the `drizzle-kit
#   push` baseline — they ALTER tables push already created and never recreate
#   that base themselves. So a from-empty replay dies at 0001 ("relation
#   equipment does not exist"). We mirror production: seed the push baseline
#   first, then replay the deltas. `drizzle-kit push` targets a database (it
#   does not reliably honour a non-public search_path), so we use a dedicated
#   scratch DATABASE rather than a scratch schema. A small shim
#   (reversibility-baseline-shim.sql) recreates the four tables that mid-chain
#   deltas reference but that 0044/0050 later dropped from the live schema.
#
# WHY TWO CYCLES (compare down→up vs down→up, not up vs down→up):
#   The seeded baseline already contains the columns the idempotent
#   `ADD COLUMN IF NOT EXISTS` deltas add, in schema (push) order. A down→up
#   round-trip drops and re-adds those columns, which moves them to the end of
#   the table — a benign reordering that a positional pg_dump diff would flag.
#   Taking BOTH snapshots after a down→up cycle puts them in the same order, so
#   the diff stays exact while still catching a down that errors, fails to
#   revert, or produces a non-deterministic schema.
#
# Steps:
#   1. Pick a working server (REVERSIBILITY_DATABASE_URL or DATABASE_URL).
#   2. Create a throwaway database on it.
#   3. Seed: `drizzle-kit push` + the baseline shim.
#   4. up; (down; up) → snapshot A.
#   5. (down; up) → snapshot B.
#   6. Diff A vs B. Non-zero diff fails the build.
#
# Skips cleanly (exit 0) when no DATABASE_URL is set or psql/pg_dump are
# missing, so the script can ship ahead of the Postgres service that hosts it.
# ============================================================================
set -euo pipefail

DB_URL="${REVERSIBILITY_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "${DB_URL}" ]]; then
  echo "[reversibility] no DATABASE_URL — skipping"
  exit 0
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "[reversibility] psql not found — skipping (install postgresql-client to enable)"
  exit 0
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[reversibility] pg_dump not found — skipping"
  exit 0
fi

# Derive a scratch-database URL from the admin URL, preserving userinfo/host/
# port and any query string and swapping only the database name.
SCRATCH_DB="arus_revcheck_$$"
if [[ "${DB_URL}" =~ ^(.*://[^/]+)/([^?]*)(\?.*)?$ ]]; then
  URL_BASE="${BASH_REMATCH[1]}"
  URL_QUERY="${BASH_REMATCH[3]:-}"
  SCRATCH_URL="${URL_BASE}/${SCRATCH_DB}${URL_QUERY}"
else
  echo "[reversibility] could not parse a database name out of DATABASE_URL — skipping"
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHIM="${ROOT}/scripts/reversibility-baseline-shim.sql"
TMP=$(mktemp -d)
NUM_MIGRATIONS=$(ls "${ROOT}"/migrations/[0-9]*.sql | grep -v '\.down\.sql$' | wc -l | tr -d ' ')

cleanup() {
  rm -rf "${TMP}"
  # Terminate any lingering sessions so the drop succeeds (PG13+ WITH FORCE).
  psql "${DB_URL}" -c "DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[reversibility] creating scratch database ${SCRATCH_DB}"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${SCRATCH_DB}" >/dev/null
# pgvector is part of the schema; the CI Postgres image ships it.
psql "${SCRATCH_URL}" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector" >/dev/null

echo "[reversibility] seeding db:push baseline"
DATABASE_URL="${SCRATCH_URL}" npm run --silent db:push >/dev/null

echo "[reversibility] seeding dead-table shim"
psql "${SCRATCH_URL}" -v ON_ERROR_STOP=1 -f "${SHIM}" >/dev/null

snapshot() {
  pg_dump --schema-only --schema=public "${SCRATCH_URL}" \
    | grep -v -E '^(--|SET |SELECT pg_catalog\.|\\restrict|\\unrestrict|$)'
}

run_up() { DATABASE_URL="${SCRATCH_URL}" node "${ROOT}/scripts/run-sql-migrations.mjs" up >/dev/null; }
run_down() {
  local applied
  applied=$(psql "${SCRATCH_URL}" -tAc "SELECT count(*) FROM arus_migrations")
  DATABASE_URL="${SCRATCH_URL}" node "${ROOT}/scripts/run-sql-migrations.mjs" down --count "${applied}" >/dev/null
}

echo "[reversibility] up (apply all deltas on the seeded baseline)"
run_up

echo "[reversibility] cycle 1 (down → up) → snapshot A"
run_down
# Liveness: a full down must actually revert every tracked migration.
REMAINING=$(psql "${SCRATCH_URL}" -tAc "SELECT count(*) FROM arus_migrations")
if [[ "${REMAINING}" != "0" ]]; then
  echo "[reversibility] FAIL: ${REMAINING} migration(s) still tracked after a full down — a down did not revert." >&2
  exit 1
fi
run_up
snapshot > "${TMP}/snapshot_a.sql"

echo "[reversibility] cycle 2 (down → up) → snapshot B"
run_down
run_up
snapshot > "${TMP}/snapshot_b.sql"

echo "[reversibility] diffing snapshots"
if ! diff -u "${TMP}/snapshot_a.sql" "${TMP}/snapshot_b.sql"; then
  echo "[reversibility] FAIL: schema differs across down→up cycles. Inspect diff above." >&2
  exit 1
fi

echo "[reversibility] OK — ${NUM_MIGRATIONS} migrations replay and reverse cleanly"
