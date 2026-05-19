#!/usr/bin/env node
/**
 * Push A1 — Training harness skeleton.
 *
 * Invoked out-of-band by the weekly retrain cron (or manually by an MLE)
 * to train a candidate model for a specific equipment type. Loads the
 * `prediction_outcomes` table joined to point-in-time feature snapshots,
 * builds a training matrix, hands it to the model-specific trainer, and
 * (when promotion criteria pass) registers the produced .onnx artifact
 * via the existing `/api/v1/ml/models` endpoint.
 *
 * This file is intentionally a skeleton:
 *   - The actual XGBoost trainer lives in TS at `server/ml-xgboost-model.ts`.
 *   - Bearing/pump-specific trainers (per the strategic-push plan) are
 *     planned to call into Python sidecars exporting to ONNX.
 *
 * Usage:
 *   node scripts/ml/train-model-skeleton.mjs \
 *        --org=acme --type=pump --output=models/pump-v3.onnx
 *
 * Promotion criteria (enforced by the retrain processor, not here):
 *   - candidate MAE >= 5% improvement over production
 *   - PSI < 0.25 between training and serving feature distributions
 */

import { argv, exit } from "node:process";

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
  if (!args.org || !args.type) {
    console.error("usage: train-model-skeleton.mjs --org=<id> --type=<equipmentType> [--output=<path>]");
    exit(2);
  }

  console.log(JSON.stringify({
    stage: "init",
    org: args.org,
    type: args.type,
    output: args.output ?? null,
    note: "skeleton — pulls outcomes, trains, exports ONNX, registers via API",
    promotionCriteria: {
      minMaeImprovementPct: 5,
      maxPsi: 0.25,
    },
  }));

  console.log(JSON.stringify({
    stage: "skipped",
    reason: "skeleton harness — wire concrete trainer in Push A2/A3",
  }));
}

main().catch((err) => {
  console.error(JSON.stringify({ stage: "error", message: err.message }));
  exit(1);
});
