#!/usr/bin/env node
/**
 * Push A1 — Sidecar-aware trainer wrapper.
 *
 * Routing rules:
 *   1. Equipment types listed in REAL_TRAINER_REQUIRED_TYPES (bearing,
 *      pump — the two A1 target classes) MUST train through the
 *      Python XGBoost+ONNX path. If Python is unavailable or the
 *      trainer exits with a hard error, this wrapper exits non-zero
 *      rather than silently degrading to the calibration baseline.
 *      Operators see a real failure in the job queue and can fix the
 *      Python env instead of getting stub artifacts in production.
 *   2. Other equipment types prefer the Python trainer when
 *      ML_PYTHON_TRAINER=1 and fall back to the JS calibration
 *      baseline otherwise.
 *
 * Both trainers emit the same JSON-line contract on stdout so the
 * retraining processor doesn't need to know which one ran.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit, env } from "node:process";

const repoRoot = process.cwd();
const py = path.join(repoRoot, "scripts/ml/python/train_xgb.py");
const jsFallback = path.join(repoRoot, "scripts/ml/train-model-skeleton.mjs");

const REAL_TRAINER_REQUIRED_TYPES = new Set(
  (env.ML_REAL_TRAINER_TYPES ?? "bearing,pump")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

function getArg(name) {
  const prefix = `--${name}=`;
  const direct = argv.find((a) => a.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const idx = argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return "";
}

function runChild(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
      ...opts,
    });
    child.on("exit", (code) => resolve(code ?? -1));
    child.on("error", () => resolve(-1));
  });
}

async function main() {
  const equipmentType = getArg("type").toLowerCase();
  const realTrainerRequired = REAL_TRAINER_REQUIRED_TYPES.has(equipmentType);
  const pythonAvailable = existsSync(py);
  const wantsPython =
    realTrainerRequired || env.ML_PYTHON_TRAINER === "1" || env.ML_PYTHON_TRAINER === "true";

  if (realTrainerRequired && !pythonAvailable) {
    console.error(
      `[train-sidecar] equipmentType=${equipmentType} requires the Python trainer ` +
        `(scripts/ml/python/train_xgb.py missing). Refusing to silently downgrade to ` +
        `the calibration baseline.`
    );
    exit(2);
  }

  if (wantsPython && pythonAvailable) {
    const code = await runChild("python3", [py, ...argv.slice(2)]);
    if (code === 0 || code === 3) exit(code); // 3 == skipped (handled upstream)
    if (realTrainerRequired) {
      console.error(
        `[train-sidecar] python trainer hard-failed (exit=${code}) for required type ` +
          `'${equipmentType}'. Not falling back to JS baseline.`
      );
      exit(code);
    }
    console.error(`[train-sidecar] python trainer exit=${code}, falling back to JS baseline`);
  }
  const code = await runChild("node", [jsFallback, ...argv.slice(2)]);
  exit(code);
}

main();
