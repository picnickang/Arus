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
import { mkdirSync, existsSync, unlinkSync } from "node:fs";
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
    let out = "", err = "";
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
          productionMae: 0.30,
          psi: 0.04,
          artifactPath: artifactPath.replace(".ubj", ".onnx"),
          nativeArtifactPath: absArtifact,
        }),
      ],
    );
    const inserted = await pool.query(
      `SELECT id, status, training_metrics->>'nativeArtifactPath' AS native
       FROM ml_models WHERE id=$1`,
      [modelId],
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
    try { r1Parsed = JSON.parse(r1Line); } catch { fail(`bad JSON: ${r1Line}`); return; }
    if (r1Parsed.stage !== "shap") {
      fail(`expected stage=shap, got ${JSON.stringify(r1Parsed)}`);
      return;
    }
    const expectedFeatures = ["meanTemp","meanVibration","rmsVibration","meanPressure","kurtosis","peakToPeak"];
    const missing = expectedFeatures.filter((f) => !(f in (r1Parsed.shapValues || {})));
    if (missing.length) { fail(`shapValues missing features: ${missing.join(",")}`); return; }
    if (typeof r1Parsed.baseValue !== "number") { fail("baseValue not numeric"); return; }
    ok(`stage=shap baseValue=${r1Parsed.baseValue.toFixed(4)} features=${Object.keys(r1Parsed.shapValues).length}/6`);
    ok(`shapValues sample: meanTemp=${r1Parsed.shapValues.meanTemp.toFixed(4)} rmsVibration=${r1Parsed.shapValues.rmsVibration.toFixed(4)}`);

    // ---------- UPDATE (promote) ----------
    step("U — promote trained -> deployed and re-run SHAP");
    await pool.query(
      `UPDATE ml_models SET status='deployed', deployed_on=now() WHERE id=$1`,
      [modelId],
    );
    const promoted = await pool.query(
      `SELECT status, deployed_on FROM ml_models WHERE id=$1`,
      [modelId],
    );
    if (promoted.rows[0].status !== "deployed") {
      fail(`status not deployed: ${promoted.rows[0].status}`);
      return;
    }
    ok(`status=deployed deployed_on=${promoted.rows[0].deployed_on?.toISOString?.() ?? promoted.rows[0].deployed_on}`);
    const r2 = await runPy(SHAP, {
      input: JSON.stringify({ modelId, orgId: ORG, features: { ...FEATURES, meanTemp: 95.0 } }),
    });
    const r2Parsed = JSON.parse(r2.stdout.trim().split("\n").pop());
    if (r2Parsed.stage !== "shap") { fail(`post-promote SHAP failed: ${JSON.stringify(r2Parsed)}`); return; }
    // higher meanTemp should push positive contribution given our synthetic label rule
    ok(`post-promote SHAP still serves (meanTemp shap=${r2Parsed.shapValues.meanTemp.toFixed(4)} for higher input)`);

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
    if (del.rowCount !== 1) { fail("DELETE did not remove row"); return; }
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
      [otherId, EQUIP_TYPE, JSON.stringify({ nativeArtifactPath: otherArtifact })],
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
  } finally {
    if (existsSync(absArtifact)) {
      try { unlinkSync(absArtifact); } catch {}
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error("CRUD harness crashed:", err);
  process.exit(1);
});
