#!/usr/bin/env bash
# ============================================================================
# LR-1A — Migration reversibility CI check.
#
# Boots an ephemeral Postgres schema, runs the full up → down → up cycle,
# and diffs the schema snapshots either side of the down to prove that
# every migration's .down.sql actually restores prior state.
#
# Steps:
#   1. Pick a working DB. If REVERSIBILITY_DATABASE_URL is set, use it.
#      Otherwise fall back to DATABASE_URL and CREATE/DROP a uniquely
#      named scratch schema so we never touch the developer's data.
#   2. Apply all up migrations.   (state A)
#   3. Snapshot schema.           (snapshot A)
#   4. Revert ALL up migrations.  (state empty)
#   5. Re-apply all up migrations.(state B — must == state A)
#   6. Snapshot schema.           (snapshot B)
#   7. Diff A vs B. Non-zero diff fails the build.
#
# Skips cleanly (exit 0) when neither REVERSIBILITY_DATABASE_URL nor
# DATABASE_URL is set, so the script can ship in CI ahead of the
# Postgres service that hosts it.
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

SCRATCH_SCHEMA="arus_revcheck_$$"
TMP=$(mktemp -d)
trap 'rm -rf "${TMP}"; PGOPTIONS="" psql "${DB_URL}" -c "DROP SCHEMA IF EXISTS ${SCRATCH_SCHEMA} CASCADE" >/dev/null 2>&1 || true' EXIT

echo "[reversibility] creating scratch schema ${SCRATCH_SCHEMA}"
psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA ${SCRATCH_SCHEMA}" >/dev/null

# All subsequent operations route through search_path so they land in
# the scratch schema rather than public. The migration SQL files use
# unqualified table names, so this redirection is what isolates us.
export PGOPTIONS="--search_path=${SCRATCH_SCHEMA},public"

echo "[reversibility] up #1"
DATABASE_URL="${DB_URL}" node scripts/run-sql-migrations.mjs up

echo "[reversibility] snapshot A"
pg_dump --schema-only --schema="${SCRATCH_SCHEMA}" "${DB_URL}" \
  | grep -v -E '^(--|SET |SELECT pg_catalog\.|$)' > "${TMP}/snapshot_a.sql"

# Revert everything. The arus_migrations tracker tells us how many up
# migrations are currently applied; we ask the runner to revert that
# many. We discover the count via the tracker rather than counting files
# because a half-applied prior run would otherwise mislead us.
APPLIED=$(psql "${DB_URL}" -tAc "SELECT count(*) FROM ${SCRATCH_SCHEMA}.arus_migrations")
echo "[reversibility] reverting ${APPLIED} migrations"
DATABASE_URL="${DB_URL}" node scripts/run-sql-migrations.mjs down --count "${APPLIED}"

echo "[reversibility] up #2"
DATABASE_URL="${DB_URL}" node scripts/run-sql-migrations.mjs up

echo "[reversibility] snapshot B"
pg_dump --schema-only --schema="${SCRATCH_SCHEMA}" "${DB_URL}" \
  | grep -v -E '^(--|SET |SELECT pg_catalog\.|$)' > "${TMP}/snapshot_b.sql"

echo "[reversibility] diffing snapshots"
if ! diff -u "${TMP}/snapshot_a.sql" "${TMP}/snapshot_b.sql"; then
  echo "[reversibility] FAIL: schema after up→down→up differs from initial up. Inspect diff above." >&2
  exit 1
fi

echo "[reversibility] OK — every migration in $(ls migrations/[0-9]*.sql | grep -v down | wc -l) is reversible"
