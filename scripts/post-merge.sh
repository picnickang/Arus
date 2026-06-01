#!/bin/bash
# ============================================================================
# Post-merge hook — runs after the platform merges a task agent's branch.
#
# LR-1A: previously this script ran `drizzle-kit push --force` against the
# live database. That bypassed the SQL migration journal, prevented
# rollback, and made the in-DB schema diverge silently from what's
# checked into `migrations/`. We now apply migrations explicitly through
# the SQL migration runner introduced in LR-1A, which keeps an
# `arus_migrations` tracker table and refuses to run unreversible
# migrations in the reversibility CI check.
#
# If the application's Drizzle schema adds new columns/tables that are
# NOT yet represented as a `migrations/NNNN_*.sql` file, the
# `drizzle-kit generate` step here will produce one — the developer
# must then commit the generated SQL (and its .down.sql) so the next
# post-merge run applies it. The script intentionally does NOT call
# `drizzle-kit push --force`; schema additions must go through a
# reviewable, reversible migration.
# ============================================================================
set -e

npm install

# Generate any missing migrations from the Drizzle schema. This is a
# no-op if the schema is already in sync. Drizzle writes new files into
# migrations/ and updates migrations/meta/_journal.json; in CI the
# expectation is that this produces no new files (the developer should
# have committed them locally). Non-fatal so the apply step still runs.
npx drizzle-kit generate || \
  echo "[post-merge] drizzle-kit generate reported no changes or failed (non-fatal)"

# Apply every migration family through the canonical deploy runner
# (Task #260): root migrations/NNNN_*.sql (arus_migrations) + server/migrations
# (arus_sql_migrations), under the shared advisory lock, then assert the
# critical schema objects exist. Same ledger + lock key as the standalone
# scripts/run-sql-migrations.mjs (still used by check-migrations-reversible.sh),
# so the deploy path and the post-merge path stay consistent. Idempotent —
# re-running applies nothing.
npm run db:migrate:deploy

# Push A1 — One-shot historical backfill into prediction_outcomes so
# the first weekly retrain has labels to score against. Idempotent
# via the (prediction_id, prediction_type, outcome_source) unique
# constraint, so safe to re-run. Non-fatal: the rest of post-merge
# should not be blocked by an empty failure_history table.
node scripts/ml/backfill-prediction-outcomes.mjs || \
  echo "[post-merge] prediction_outcomes backfill skipped (non-fatal)"
