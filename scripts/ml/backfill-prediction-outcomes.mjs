#!/usr/bin/env node
/**
 * Push A1 — Backfill historical failure_history into prediction_outcomes.
 *
 * For each row in failure_history, locate the most recent failure
 * prediction made for the same equipment strictly before the failure
 * occurred. Insert a corresponding prediction_outcomes row labelled
 * "true_positive" (an actual failure happened for that prediction).
 * The unique constraint (prediction_id, prediction_type, outcome_source)
 * means re-runs are idempotent.
 *
 * Usage:
 *   node scripts/ml/backfill-prediction-outcomes.mjs [--org=<id>] [--limit=N]
 */

import { argv, exit, env } from "node:process";
import pg from "pg";

function parseArgs(args) {
  const out = {};
  for (const a of args.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    out[m[1]] = m[2] ?? true;
  }
  return out;
}

async function main() {
  const args = parseArgs(argv);
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    exit(2);
  }
  const limit = Number(args.limit) || 5000;
  const orgFilter = args.org ? "AND fh.org_id = $1" : "";
  const params = args.org ? [args.org, limit] : [limit];

  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `WITH matched AS (
         SELECT fh.org_id,
                fh.equipment_id,
                fh.failure_timestamp AS failed_at,
                fh.failure_mode,
                (
                  SELECT fp.id
                    FROM failure_predictions fp
                   WHERE fp.equipment_id = fh.equipment_id
                     AND fp.org_id = fh.org_id
                     AND fp.created_at < fh.failure_timestamp
                   ORDER BY fp.created_at DESC
                   LIMIT 1
                ) AS prediction_id,
                (
                  SELECT fp.failure_probability
                    FROM failure_predictions fp
                   WHERE fp.equipment_id = fh.equipment_id
                     AND fp.org_id = fh.org_id
                     AND fp.created_at < fh.failure_timestamp
                   ORDER BY fp.created_at DESC
                   LIMIT 1
                ) AS predicted_prob,
                (
                  SELECT fp.predicted_failure_date
                    FROM failure_predictions fp
                   WHERE fp.equipment_id = fh.equipment_id
                     AND fp.org_id = fh.org_id
                     AND fp.created_at < fh.failure_timestamp
                   ORDER BY fp.created_at DESC
                   LIMIT 1
                ) AS predicted_failure_date
           FROM failure_history fh
          WHERE 1 = 1 ${orgFilter}
          ORDER BY fh.failure_timestamp DESC
          LIMIT $${args.org ? 2 : 1}
       )
       INSERT INTO prediction_outcomes (
         org_id, prediction_id, prediction_type, equipment_id,
         predicted_failure_probability, predicted_failure_date,
         actual_failure_mode, actual_failure_date,
         actual_outcome_label, outcome_source, source_record_id, use_for_retraining
       )
       SELECT org_id, prediction_id, 'failure', equipment_id,
              COALESCE(predicted_prob, 0), predicted_failure_date,
              failure_mode, failed_at,
              'true_positive', 'failure_history_backfill', NULL, true
         FROM matched
        WHERE prediction_id IS NOT NULL
       ON CONFLICT (prediction_id, prediction_type, outcome_source) DO NOTHING
       RETURNING id`,
      params
    );

    console.log(JSON.stringify({
      stage: "complete",
      org: args.org ?? "(all)",
      inserted: result.rowCount,
      limit,
    }));
  } catch (err) {
    console.error(JSON.stringify({ stage: "error", message: err instanceof Error ? err.message : String(err) }));
    exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
