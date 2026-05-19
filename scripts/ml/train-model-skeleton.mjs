#!/usr/bin/env node
/**
 * Push A1 — Concrete (baseline) retraining harness.
 *
 * Reads labelled outcomes for (org, equipmentType), computes a
 * calibrated per-feature-type baseline classifier, scores it on a
 * held-out tail, and registers a candidate ml_models row. Production
 * MAE is computed against the currently-deployed model for the same
 * equipmentType. Emits machine-readable JSON metrics on stdout that
 * the retrain processor parses for promotion gates.
 *
 * This is intentionally a JS-side baseline, not XGBoost. The point is
 * to exercise the full path (data → metrics → registered candidate →
 * promotion decision) so concrete XGBoost / ONNX trainers can drop in
 * during A2/A3 without changing the orchestration. PSI is computed
 * over the predicted-probability distributions of the candidate vs
 * the production model on the same evaluation slice.
 *
 * Usage:
 *   node scripts/ml/train-model-skeleton.mjs --org=<id> --type=<type>
 *
 * Exit codes:
 *   0  metrics emitted (caller decides promotion)
 *   1  fatal error
 *   2  invalid args
 *   3  insufficient labelled data — emits {stage: "skipped"} on stdout
 */

import { argv, exit, env } from "node:process";
import pg from "pg";
import { randomUUID } from "node:crypto";

const MIN_LABELS = 20;
const PSI_BUCKETS = 10;

function parseArgs(args) {
  const out = {};
  for (const a of args.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    out[m[1]] = m[2] ?? true;
  }
  return out;
}

function emit(obj) {
  console.log(JSON.stringify(obj));
}

function probToLabel(p) {
  return p >= 0.5 ? 1 : 0;
}

function mae(predictions, labels) {
  if (predictions.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < predictions.length; i++) {
    s += Math.abs(predictions[i] - labels[i]);
  }
  return s / predictions.length;
}

/** Population Stability Index between two probability distributions. */
function psi(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const buckets = PSI_BUCKETS;
  const ah = new Array(buckets).fill(0);
  const bh = new Array(buckets).fill(0);
  for (const x of a) ah[Math.min(buckets - 1, Math.max(0, Math.floor(x * buckets)))]++;
  for (const x of b) bh[Math.min(buckets - 1, Math.max(0, Math.floor(x * buckets)))]++;
  let total = 0;
  for (let i = 0; i < buckets; i++) {
    const pa = (ah[i] + 0.5) / (a.length + buckets * 0.5);
    const pb = (bh[i] + 0.5) / (b.length + buckets * 0.5);
    total += (pa - pb) * Math.log(pa / pb);
  }
  return Math.abs(total);
}

/**
 * Fit a tiny logistic-regression-style calibration: learn a single
 * scale + bias on the predicted_failure_probability so the model
 * minimises MAE against the actual_outcome_label on the training tail.
 * This is a defensible improvement when feedback shows systematic
 * over- or under-confidence in the current production model.
 */
function fitCalibration(rows) {
  if (rows.length < 5) return { scale: 1, bias: 0 };
  let bestMae = Infinity;
  let best = { scale: 1, bias: 0 };
  for (let scale = 0.5; scale <= 1.5; scale += 0.1) {
    for (let bias = -0.2; bias <= 0.2; bias += 0.05) {
      let s = 0;
      for (const r of rows) {
        const cal = Math.min(1, Math.max(0, r.predicted * scale + bias));
        s += Math.abs(cal - r.actual);
      }
      const m = s / rows.length;
      if (m < bestMae) {
        bestMae = m;
        best = { scale: Math.round(scale * 100) / 100, bias: Math.round(bias * 100) / 100 };
      }
    }
  }
  return best;
}

async function main() {
  const args = parseArgs(argv);
  if (!args.org || !args.type) {
    console.error("usage: train-model-skeleton.mjs --org=<id> --type=<equipmentType>");
    exit(2);
  }

  if (!env.DATABASE_URL) {
    emit({ stage: "skipped", reason: "DATABASE_URL not set" });
    exit(3);
  }

  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const labelled = await client.query(
      `SELECT po.predicted_failure_probability AS predicted,
              po.actual_outcome_label AS label,
              po.observed_at
         FROM prediction_outcomes po
         JOIN equipment e ON e.id = po.equipment_id
        WHERE po.org_id = $1
          AND e.type = $2
          AND po.use_for_retraining = true
          AND po.observed_at >= $3
          AND po.actual_outcome_label IS NOT NULL`,
      [args.org, args.type, since]
    );

    if (labelled.rows.length < MIN_LABELS) {
      emit({
        stage: "skipped",
        reason: `insufficient labels (${labelled.rows.length} < ${MIN_LABELS})`,
        labelsFound: labelled.rows.length,
      });
      exit(3);
    }

    const rows = labelled.rows.map((r) => ({
      predicted: Number(r.predicted) || 0,
      actual: r.label === "confirmed" || r.label === "true_positive" ? 1 : 0,
    }));

    // 80/20 split (chronological — most recent rows used as eval).
    const splitIdx = Math.floor(rows.length * 0.8);
    const train = rows.slice(0, splitIdx);
    const evalSet = rows.slice(splitIdx);

    const cal = fitCalibration(train);
    const candidatePreds = evalSet.map((r) =>
      Math.min(1, Math.max(0, r.predicted * cal.scale + cal.bias))
    );
    const productionPreds = evalSet.map((r) => r.predicted);
    const labels = evalSet.map((r) => r.actual);

    const candidateMae = mae(candidatePreds, labels);
    const productionMae = mae(productionPreds, labels);
    const driftPsi = psi(productionPreds, candidatePreds);

    // Register the candidate in ml_models.
    const modelId = randomUUID();
    const hyperparameters = JSON.stringify({
      kind: "calibration_baseline",
      scale: cal.scale,
      bias: cal.bias,
    });
    const trainingMetrics = JSON.stringify({
      mae: candidateMae,
      productionMae,
      psi: driftPsi,
      trainSize: train.length,
      evalSize: evalSet.length,
    });
    await client.query(
      `INSERT INTO ml_models (id, org_id, name, type, status, equipment_type,
                              data_points, data_window_days, training_duration_ms,
                              hyperparameters, training_metrics, trained_on, version)
       VALUES ($1, $2, $3, 'calibration_baseline', 'trained', $4, $5, 7, 0, $6::jsonb, $7::jsonb, NOW(), '1.0')`,
      [
        modelId,
        args.org,
        `${args.type}-calibration-${new Date().toISOString().slice(0, 10)}`,
        args.type,
        rows.length,
        hyperparameters,
        trainingMetrics,
      ]
    );

    emit({
      stage: "metrics",
      org: args.org,
      type: args.type,
      mae: candidateMae,
      productionMae,
      psi: driftPsi,
      modelId,
      hyperparameters: { scale: cal.scale, bias: cal.bias },
      trainSize: train.length,
      evalSize: evalSet.length,
    });

    emit({ stage: "complete", modelId });
    exit(0);
  } catch (err) {
    emit({ stage: "error", message: err instanceof Error ? err.message : String(err) });
    exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
