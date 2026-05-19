#!/bin/bash
set -e
npm install
npx drizzle-kit push --force

# Push A1 — One-shot historical backfill into prediction_outcomes so
# the first weekly retrain has labels to score against. Idempotent
# via the (prediction_id, prediction_type, outcome_source) unique
# constraint, so safe to re-run. Non-fatal: the rest of post-merge
# should not be blocked by an empty failure_history table.
node scripts/ml/backfill-prediction-outcomes.mjs || \
  echo "[post-merge] prediction_outcomes backfill skipped (non-fatal)"
