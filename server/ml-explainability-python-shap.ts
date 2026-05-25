/**
 * Push A1 — Python TreeSHAP client.
 *
 * Spawns scripts/ml/python/tree_shap.py once per call (simple,
 * stateless, no IPC framing). The script reads a JSON payload on
 * stdin and writes a single JSON line on stdout containing exact
 * TreeSHAP values from XGBoost's native `Booster.predict(pred_contribs=True)`.
 *
 * Gated by ML_PYTHON_SHAP=1. When disabled, missing, or the spawned
 * process errors, callers fall back to the TS permutation-importance
 * path in ml-explainability-service.ts — explanations degrade
 * gracefully and never break the prediction write path.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { createLogger } from "./lib/structured-logger";

const logger = createLogger("PythonShapClient");
const SHAP_SCRIPT = path.resolve(process.cwd(), "scripts/ml/python/tree_shap.py");
const SHAP_TIMEOUT_MS = 15_000;

export interface PythonShapResult {
  baseValue: number;
  shapValues: Record<string, number>;
  modelId: string;
  featureOrder: string[];
}

/**
 * Push A1 — TreeSHAP is the DEFAULT explainability path for deployed
 * XGBoost models. Operators can opt out with ML_PYTHON_SHAP=0 (e.g.
 * deployments without Python). The sidecar script must exist on disk
 * — if it doesn't, we treat it as opt-out so callers fall through to
 * the permutation path with telemetry rather than spawning failures.
 */
export function isPythonShapEnabled(): boolean {
  const flag = process.env['ML_PYTHON_SHAP'];
  const explicitlyDisabled = flag === "0" || flag === "false";
  if (explicitlyDisabled) return false;
  return existsSync(SHAP_SCRIPT);
}

export async function shapAttribute(
  modelId: string,
  orgId: string,
  features: Record<string, number>
): Promise<PythonShapResult | null> {
  if (!isPythonShapEnabled()) return null;

  return new Promise((resolve) => {
    const child = spawn("python3", [SHAP_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (val: PythonShapResult | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const timer = setTimeout(() => {
      logger.warn("Python SHAP timed out", { modelId });
      child.kill("SIGKILL");
      finish(null);
    }, SHAP_TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      logger.warn("Python SHAP spawn failed", { modelId, err: err.message });
      finish(null);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        if (stderr) logger.warn("Python SHAP stderr", { modelId, stderr: stderr.slice(0, 400) });
        finish(null);
        return;
      }
      const line = stdout.split("\n").map((l) => l.trim()).filter(Boolean).pop();
      if (!line) {
        finish(null);
        return;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed.stage !== "shap" || typeof parsed.baseValue !== "number") {
          finish(null);
          return;
        }
        finish({
          modelId: String(parsed.modelId ?? modelId),
          baseValue: Number(parsed.baseValue),
          shapValues: parsed.shapValues ?? {},
          featureOrder: parsed.featureOrder ?? [],
        });
      } catch (err) {
        logger.warn("Python SHAP JSON parse failed", {
          modelId,
          err: err instanceof Error ? err.message : String(err),
        });
        finish(null);
      }
    });
    try {
      child.stdin.write(JSON.stringify({ modelId, orgId, features }));
      child.stdin.end();
    } catch (err) {
      clearTimeout(timer);
      logger.warn("Python SHAP stdin write failed", {
        modelId,
        err: err instanceof Error ? err.message : String(err),
      });
      finish(null);
    }
  });
}
