#!/usr/bin/env node
/**
 * Push A1 — Sidecar-aware trainer wrapper.
 *
 * If ML_PYTHON_TRAINER=1 is set (and python3 + the Python trainer
 * script exist), this delegates to scripts/ml/python/train_xgb.py.
 * Otherwise it falls through to scripts/ml/train-model-skeleton.mjs
 * so deployments without Python keep working on the calibration
 * baseline.
 *
 * The two trainers honour the same JSON-line contract on stdout, so
 * the retraining processor doesn't need to know which one ran.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit, env } from "node:process";

const repoRoot = process.cwd();
const py = path.join(repoRoot, "scripts/ml/python/train_xgb.py");
const jsFallback = path.join(repoRoot, "scripts/ml/train-model-skeleton.mjs");

function runChild(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"], env: process.env, ...opts });
    child.on("exit", (code) => resolve(code ?? -1));
    child.on("error", () => resolve(-1));
  });
}

async function main() {
  const wantsPython = env.ML_PYTHON_TRAINER === "1" || env.ML_PYTHON_TRAINER === "true";
  if (wantsPython && existsSync(py)) {
    const code = await runChild("python3", [py, ...argv.slice(2)]);
    if (code === 0 || code === 3) exit(code); // 3 == skipped (handled upstream)
    // Hard error from Python — fall through to JS baseline so the
    // weekly cron still produces a result rather than nothing.
    console.error(`[train-sidecar] python trainer exit=${code}, falling back to JS baseline`);
  }
  const code = await runChild("node", [jsFallback, ...argv.slice(2)]);
  exit(code);
}

main();
