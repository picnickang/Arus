#!/usr/bin/env node
/**
 * Push A1 — Calibration-baseline retraining harness.
 *
 * This is NOT a deep-learning trainer. It does not export an ONNX
 * artifact and it does not train an XGBoost/RF model. It is a working
 * end-to-end exercise of the retraining contract so the orchestration
 * (label-pull → metrics → promotion gate → mlModels registration) is
 * provably real, and a concrete trainer can be dropped in without
 * touching the processor.
 *
 * Specifically it:
 *   1. Pulls labelled outcomes from prediction_outcomes joined to the
 *      equipment table for (org, equipmentType) over the last 7 days.
 *   2. Splits 80/20 by observation order (most-recent rows = eval).
 *   3. Grid-searches a single-parameter calibration (scale, bias) on
 *      the train tail that minimises MAE against actual_outcome_label.
 *   4. Computes candidate MAE, production MAE (raw predictions), and
 *      PSI between the two probability distributions on the eval tail.
 *   5. Registers an ml_models row of type "calibration_baseline" with
 *      the fitted params in hyperparameters and metrics in
 *      training_metrics. NO ONNX artifact is written.
 *   6. Emits a single {stage:"metrics", modelId, mae, productionMae,
 *      psi} JSON line on stdout, then {stage:"complete"}. NO artifactPath
 *      is emitted because no artifact exists.
 *
 * The retrain processor reads the JSON, applies the MAE-improvement +
 * PSI gates, and uses the registered modelId for promotion. Real
 * model trainers (bearing/pump XGBoost + ONNX export) will replace
 * this harness once labelled fleet data is available; the processor
 * contract is stable across that swap.
 *
 * Usage:
 *   node scripts/ml/train-model-skeleton.mjs --org=<id> --type=<type>
 *
 * Exit codes:
 *   0  metrics emitted (caller decides promotion)
 *   1  fatal error
 *   2  invalid args
 *   3  insufficient labelled data — emits {stage:"skipped"} on stdout
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

function mae(predictions, labels) {
  if (predictions.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < predictions.length; i++) {
    s += Math.abs(predictions[i] - labels[i]);
  }
  return s / predictions.length;
}

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

    const modelId = randomUUID();
    const hyperparameters = JSON.stringify({
      kind: "calibration_baseline",
      scale: cal.scale,
      bias: cal.bias,
      note: "no ONNX export — see scripts/ml/train-model-skeleton.mjs",
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
