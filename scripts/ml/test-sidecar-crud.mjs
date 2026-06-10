#!/usr/bin/env node
/**
 * CRUD smoke test for the Python ML sidecar (Push A1).
 *
 *   C  — train a small XGBoost classifier via python, save .ubj
 *        artifact, INSERT a row in ml_models referencing it.
 *   R  — spawn scripts/ml/python/tree_shap.py with a feature payload
 *        and assert it returns exact TreeSHAP values for all 6
 *        features in FEATURE_ORDER.
 *   U  — flip status trained -> deployed (simulating /promote) and
 *        re-run SHAP to prove the deployed booster is still served.
 *   D  — DELETE the ml_models row + unlink the .ubj artifact, re-run
 *        SHAP, and assert the script reports the graceful
 *        "deployed model artifact unavailable" error stage rather
 *        than crashing.
 *
 * Single-process, no jest needed. Run:  node scripts/ml/test-sidecar-crud.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const REPO = process.cwd();
const SHAP = path.join(REPO, "scripts/ml/python/tree_shap.py");
const ORG = "default-org-id";
const EQUIP_TYPE = "bearing";
const MODELS_DIR = path.join(REPO, "models");

function step(label) {
  process.stdout.write(`\n=== ${label} ===\n`);
}
function ok(msg) {
  process.stdout.write(`  \u2713 ${msg}\n`);
}
function fail(msg) {
  process.stdout.write(`  \u2717 ${msg}\n`);
  process.exitCode = 1;
}

function runPy(scriptOrCode, { input = "", isCode = false } = {}) {
  return new Promise((resolve) => {
    const args = isCode ? ["-c", scriptOrCode] : [scriptOrCode];
    const child = spawn("python3", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("exit", (code) => resolve({ code: code ?? -1, stdout: out, stderr: err }));
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

const FEATURES = {
  meanTemp: 78.5,
  meanVibration: 4.2,
  rmsVibration: 5.1,
  meanPressure: 105.3,
  kurtosis: 3.1,
  peakToPeak: 7.8,
};

async function main() {
  if (!existsSync(MODELS_DIR)) mkdirSync(MODELS_DIR, { recursive: true });

  const modelId = randomUUID();
  const artifactPath = path.join("models", `crud-test-${EQUIP_TYPE}-${modelId}.ubj`);
  const absArtifact = path.join(REPO, artifactPath);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Seed the organizations the harness references so the org_id foreign
    // keys on ml_models, equipment, equipment_features, … resolve: the
    // default org plus the foreign org used by the wrong-org SHAP phase.
    // Idempotent across re-runs.
    await pool.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, 'Default Org', 'default'),
              ('t89-test-org', 'T89 Foreign Org', 't89-test-org')
       ON CONFLICT DO NOTHING`,
      [ORG]
    );

    // ---------- CREATE ----------
    step("C — train XGB model and INSERT ml_models row");
    const trainPy = `
import numpy as np, xgboost as xgb
rng = np.random.default_rng(42)
n = 400
X = rng.normal(size=(n, 6)).astype("float32")
# label = noisy threshold on feature 0 (meanTemp proxy)
y = (X[:, 0] + 0.3 * X[:, 2] + rng.normal(scale=0.5, size=n) > 0).astype(int)
clf = xgb.XGBClassifier(n_estimators=20, max_depth=3, learning_rate=0.2,
                       objective="binary:logistic", eval_metric="logloss",
                       use_label_encoder=False)
clf.fit(X, y)
clf.get_booster().save_model("${absArtifact}")
print("trained_ok")
`;
    const train = await runPy(trainPy, { isCode: true });
    if (train.code !== 0 || !train.stdout.includes("trained_ok")) {
      fail(`xgboost train failed: code=${train.code} stderr=${train.stderr.slice(-300)}`);
      return;
    }
    if (!existsSync(absArtifact)) {
      fail(`artifact not on disk: ${absArtifact}`);
      return;
    }
    ok(`trained + saved ${artifactPath}`);

    await pool.query(
      `INSERT INTO ml_models (id, org_id, name, type, status, equipment_type, version, training_metrics)
       VALUES ($1, $2, $3, 'xgboost', 'trained', $4, '1.0', $5::jsonb)`,
      [
        modelId,
        ORG,
        `crud-test ${EQUIP_TYPE}`,
        EQUIP_TYPE,
        JSON.stringify({
          mae: 0.21,
          productionMae: 0.3,
          psi: 0.04,
          artifactPath: artifactPath.replace(".ubj", ".onnx"),
          nativeArtifactPath: absArtifact,
        }),
      ]
    );
    const inserted = await pool.query(
      `SELECT id, status, training_metrics->>'nativeArtifactPath' AS native
       FROM ml_models WHERE id=$1`,
      [modelId]
    );
    if (inserted.rowCount !== 1) {
      fail("ml_models row missing after INSERT");
      return;
    }
    ok(`ml_models row id=${modelId.slice(0, 8)}… status=${inserted.rows[0].status}`);

    // ---------- READ (SHAP) ----------
    step("R — invoke tree_shap.py against the deployed artifact");
    const r1 = await runPy(SHAP, {
      input: JSON.stringify({ modelId, orgId: ORG, features: FEATURES }),
    });
    if (r1.code !== 0) {
      fail(`tree_shap exit=${r1.code} stderr=${r1.stderr.slice(-300)}`);
      return;
    }
    const r1Line = r1.stdout.trim().split("\n").pop();
    let r1Parsed;
    try {
      r1Parsed = JSON.parse(r1Line);
    } catch {
      fail(`bad JSON: ${r1Line}`);
      return;
    }
    if (r1Parsed.stage !== "shap") {
      fail(`expected stage=shap, got ${JSON.stringify(r1Parsed)}`);
      return;
    }
    const expectedFeatures = [
      "meanTemp",
      "meanVibration",
      "rmsVibration",
      "meanPressure",
      "kurtosis",
      "peakToPeak",
    ];
    const missing = expectedFeatures.filter((f) => !(f in (r1Parsed.shapValues || {})));
    if (missing.length) {
      fail(`shapValues missing features: ${missing.join(",")}`);
      return;
    }
    if (typeof r1Parsed.baseValue !== "number") {
      fail("baseValue not numeric");
      return;
    }
    ok(
      `stage=shap baseValue=${r1Parsed.baseValue.toFixed(4)} features=${Object.keys(r1Parsed.shapValues).length}/6`
    );
    ok(
      `shapValues sample: meanTemp=${r1Parsed.shapValues.meanTemp.toFixed(4)} rmsVibration=${r1Parsed.shapValues.rmsVibration.toFixed(4)}`
    );

    // ---------- UPDATE (promote) ----------
    step("U — promote trained -> deployed and re-run SHAP");
    await pool.query(`UPDATE ml_models SET status='deployed', deployed_on=now() WHERE id=$1`, [
      modelId,
    ]);
    const promoted = await pool.query(`SELECT status, deployed_on FROM ml_models WHERE id=$1`, [
      modelId,
    ]);
    if (promoted.rows[0].status !== "deployed") {
      fail(`status not deployed: ${promoted.rows[0].status}`);
      return;
    }
    ok(
      `status=deployed deployed_on=${promoted.rows[0].deployed_on?.toISOString?.() ?? promoted.rows[0].deployed_on}`
    );
    const r2 = await runPy(SHAP, {
      input: JSON.stringify({ modelId, orgId: ORG, features: { ...FEATURES, meanTemp: 95.0 } }),
    });
    const r2Parsed = JSON.parse(r2.stdout.trim().split("\n").pop());
    if (r2Parsed.stage !== "shap") {
      fail(`post-promote SHAP failed: ${JSON.stringify(r2Parsed)}`);
      return;
    }
    // higher meanTemp should push positive contribution given our synthetic label rule
    ok(
      `post-promote SHAP still serves (meanTemp shap=${r2Parsed.shapValues.meanTemp.toFixed(4)} for higher input)`
    );

    // ---------- DELETE ----------
    step("D — delete artifact + ml_models row, expect graceful error");
    unlinkSync(absArtifact);
    ok(`unlinked ${artifactPath}`);
    const r3 = await runPy(SHAP, {
      input: JSON.stringify({ modelId, orgId: ORG, features: FEATURES }),
    });
    const r3Parsed = JSON.parse(r3.stdout.trim().split("\n").pop());
    if (r3Parsed.stage === "error" && /artifact unavailable/i.test(r3Parsed.message)) {
      ok(`graceful error: "${r3Parsed.message}" (exit=${r3.code})`);
    } else {
      fail(`expected artifact-unavailable error, got ${JSON.stringify(r3Parsed)}`);
    }
    const del = await pool.query(`DELETE FROM ml_models WHERE id=$1 RETURNING id`, [modelId]);
    if (del.rowCount !== 1) {
      fail("DELETE did not remove row");
      return;
    }
    ok(`deleted ml_models row`);

    // Final wrong-org read should also fail closed even with a fresh row.
    step("Bonus — wrong-org SHAP request must NOT serve a foreign model");
    const otherId = randomUUID();
    const otherArtifact = path.join(REPO, "models", `crud-test-foreign-${otherId}.ubj`);
    // re-train a tiny throwaway model and register under a *different* org
    const trainPy2 = trainPy.replace(absArtifact, otherArtifact);
    await runPy(trainPy2, { isCode: true });
    await pool.query(
      `INSERT INTO ml_models (id, org_id, name, type, status, equipment_type, version, training_metrics)
       VALUES ($1, 't89-test-org', 'foreign', 'xgboost', 'deployed', $2, '1.0', $3::jsonb)`,
      [otherId, EQUIP_TYPE, JSON.stringify({ nativeArtifactPath: otherArtifact })]
    );
    const r4 = await runPy(SHAP, {
      input: JSON.stringify({ modelId: otherId, orgId: ORG, features: FEATURES }),
    });
    const r4Parsed = JSON.parse(r4.stdout.trim().split("\n").pop());
    if (r4Parsed.stage === "error") {
      ok(`cross-org request refused: "${r4Parsed.message}"`);
    } else {
      fail(`cross-org request served! ${JSON.stringify(r4Parsed)}`);
    }
    await pool.query(`DELETE FROM ml_models WHERE id=$1`, [otherId]);
    if (existsSync(otherArtifact)) unlinkSync(otherArtifact);

    // ===================================================================
    // Phase 2 — Train-side sidecar end-to-end:
    //   seed equipment + features + outcomes ->
    //   invoke scripts/ml/train-model-sidecar.mjs (which exec's train_xgb.py)
    //   -> assert ONNX + UBJ produced and ml_models row registered.
    // ===================================================================
    await trainerEndToEnd(pool);
  } finally {
    if (existsSync(absArtifact)) {
      try {
        unlinkSync(absArtifact);
      } catch {
        // Cleanup best-effort only; failing here would hide the test result.
      }
    }
    await pool.end();
  }
}

async function trainerEndToEnd(pool) {
  step("T — train_xgb.py end-to-end via train-model-sidecar.mjs");
  const eqId = `crud-test-bearing-${randomUUID().slice(0, 8)}`;
  const trainerOrg = ORG;
  const trainerType = "bearing";
  const N = 60;
  // Track artifacts written by the trainer so we can clean them up
  // even if the harness fails mid-way.
  const before = existsSync(MODELS_DIR) ? new Set(readdirSync(MODELS_DIR)) : new Set();
  let trainedModelId = null;

  try {
    // 1) Seed a fresh bearing equipment.
    await pool.query(
      `INSERT INTO equipment (id, org_id, name, type, criticality_level, location, is_active)
       VALUES ($1, $2, 'CRUD harness bearing', 'bearing', 'medium', 'Test', true)`,
      [eqId, trainerOrg]
    );
    ok(`seeded equipment ${eqId}`);

    // 2) Seed N feature snapshots + N matching prediction_outcomes rows.
    //    Labelling rule mirrors the synthetic CREATE phase: high temp +
    //    high RMS -> "confirmed" (positive), else "false_positive".
    const featIds = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    for (let i = 0; i < N; i++) {
      const featId = randomUUID();
      featIds.push(featId);
      const ts = new Date(now - (N - i) * (oneDay / 12)); // last ~5 days
      const meanTemp = 40 + Math.random() * 60; // 40..100
      const meanVibration = 1 + Math.random() * 6;
      const rmsVibration = 1 + Math.random() * 7;
      const meanPressure = 80 + Math.random() * 40;
      const kurtosis = 1 + Math.random() * 4;
      const peakToPeak = 2 + Math.random() * 10;
      await pool.query(
        `INSERT INTO equipment_features
           (id, org_id, equipment_id, timestamp, mean_temp, mean_vibration,
            rms_vibration, mean_pressure, kurtosis, peak_to_peak, sample_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,60)`,
        [
          featId,
          trainerOrg,
          eqId,
          ts,
          meanTemp,
          meanVibration,
          rmsVibration,
          meanPressure,
          kurtosis,
          peakToPeak,
        ]
      );
      const positive = meanTemp > 75 && rmsVibration > 5;
      const predProb = positive ? 0.55 + Math.random() * 0.4 : Math.random() * 0.45;
      const label = positive ? "confirmed" : "false_positive";
      await pool.query(
        `INSERT INTO prediction_outcomes
           (org_id, prediction_id, prediction_type, equipment_id,
            feature_snapshot_id, predicted_failure_probability,
            actual_outcome_label, outcome_source, use_for_retraining, observed_at)
         VALUES ($1, $2, 'failure', $3, $4, $5, $6, 'manual', true, $7)`,
        [trainerOrg, 100000 + i, eqId, featId, predProb, label, ts]
      );
    }
    ok(`seeded ${N} equipment_features + ${N} prediction_outcomes (labelled)`);

    // 3) Invoke the sidecar wrapper. Lower MIN_LABELS so the 60-row seed
    //    isn't rejected as "insufficient".
    const env = {
      ...process.env,
      PYTRAINER_MIN_LABELS: "30",
      RETRAIN_WINDOW_DAYS: "30",
    };
    const out = await new Promise((resolve) => {
      const child = spawn(
        "node",
        ["scripts/ml/train-model-sidecar.mjs", `--org=${trainerOrg}`, `--type=${trainerType}`],
        { stdio: ["ignore", "pipe", "pipe"], env }
      );
      let so = "",
        se = "";
      child.stdout.on("data", (d) => (so += d.toString()));
      child.stderr.on("data", (d) => (se += d.toString()));
      child.on("exit", (code) => resolve({ code: code ?? -1, stdout: so, stderr: se }));
    });
    if (out.code !== 0) {
      fail(`trainer exit=${out.code}; stderr=${out.stderr.slice(-400)}`);
      return;
    }
    const lines = out.stdout
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const metrics = lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((x) => x && x.stage === "metrics")
      .pop();
    if (!metrics) {
      fail(`no stage=metrics line in trainer stdout; got: ${lines.slice(-3).join(" | ")}`);
      return;
    }
    trainedModelId = metrics.modelId;
    ok(
      `trainer stage=metrics modelId=${trainedModelId.slice(0, 8)}… framework=${metrics.framework}`
    );
    ok(
      `mae=${metrics.mae?.toFixed?.(4)} productionMae=${metrics.productionMae?.toFixed?.(4)} psi=${metrics.psi?.toFixed?.(4)} train=${metrics.trainSize} eval=${metrics.evalSize}`
    );

    // 4) Both artifacts present on disk.
    const onnx = path.join(REPO, metrics.artifactPath);
    const ubj = onnx.replace(/\.onnx$/, ".ubj");
    if (!existsSync(onnx)) {
      fail(`ONNX artifact missing: ${onnx}`);
      return;
    }
    if (!existsSync(ubj)) {
      fail(`UBJ artifact missing: ${ubj}`);
      return;
    }
    ok(`artifacts on disk: ${path.basename(onnx)} + ${path.basename(ubj)}`);

    // 5) ml_models row exists with the trainer's contract.
    const row = await pool.query(
      `SELECT type, status, equipment_type, training_metrics
         FROM ml_models WHERE id=$1`,
      [trainedModelId]
    );
    if (row.rowCount !== 1) {
      fail("ml_models row missing");
      return;
    }
    const r = row.rows[0];
    if (r.type !== "xgboost") fail(`expected type=xgboost, got ${r.type}`);
    if (r.status !== "trained") fail(`expected status=trained, got ${r.status}`);
    if (r.equipment_type !== "bearing")
      fail(`expected equipment_type=bearing, got ${r.equipment_type}`);
    const native = r.training_metrics?.nativeArtifactPath;
    if (!native || !existsSync(native)) {
      fail(`training_metrics.nativeArtifactPath broken: ${native}`);
      return;
    }
    ok(`ml_models row registered: type=xgboost status=trained nativeArtifactPath ok`);

    // 6) Closed loop: feed the freshly-trained model into the SHAP sidecar.
    const shapRes = await runPy(SHAP, {
      input: JSON.stringify({
        modelId: trainedModelId,
        orgId: trainerOrg,
        features: FEATURES,
      }),
    });
    const shapParsed = JSON.parse(shapRes.stdout.trim().split("\n").pop());
    if (shapParsed.stage !== "shap") {
      fail(`SHAP on freshly-trained model failed: ${JSON.stringify(shapParsed)}`);
      return;
    }
    ok(
      `closed loop: SHAP on trainer-produced model returns ${Object.keys(shapParsed.shapValues).length}/6 attributions (baseValue=${shapParsed.baseValue.toFixed(4)})`
    );
  } finally {
    // Cleanup: ml_models row + artifacts + outcomes + features + equipment.
    if (trainedModelId) {
      try {
        await pool.query(`DELETE FROM ml_models WHERE id=$1`, [trainedModelId]);
      } catch {
        // Cleanup best-effort only; failing here would hide the test result.
      }
    }
    // Remove any new files in models/ that weren't there before this phase.
    if (existsSync(MODELS_DIR)) {
      for (const fn of readdirSync(MODELS_DIR)) {
        if (!before.has(fn)) {
          try {
            unlinkSync(path.join(MODELS_DIR, fn));
          } catch {
            // Cleanup best-effort only; failing here would hide the test result.
          }
        }
      }
    }
    try {
      await pool.query(`DELETE FROM prediction_outcomes WHERE equipment_id=$1`, [eqId]);
    } catch {
      // Cleanup best-effort only; failing here would hide the test result.
    }
    try {
      await pool.query(`DELETE FROM equipment_features WHERE equipment_id=$1`, [eqId]);
    } catch {
      // Cleanup best-effort only; failing here would hide the test result.
    }
    try {
      await pool.query(`DELETE FROM equipment WHERE id=$1`, [eqId]);
    } catch {
      // Cleanup best-effort only; failing here would hide the test result.
    }
  }
}

main().catch((err) => {
  console.error("CRUD harness crashed:", err);
  process.exit(1);
});
