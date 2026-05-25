/**
 * Push A1 — Client-side ONNX inference adapter (onnxruntime-web).
 *
 * Loads the deployed ONNX artifact for an org+equipmentType from the
 * server (GET /api/v1/ml/models/:id/artifact) and runs WASM/CPU
 * inference in the browser. Feature ordering MUST match
 * server/ml-prediction/onnx-adapter.ts ONNX_FEATURE_ORDER.
 *
 * Server-authoritative serving (Wave 3.3 shadow/canary) remains the
 * canonical path — promote/rollback + audit live server-side. This
 * client adapter is opt-in via VITE_PDM_ONNX_WEB=1 for two scenarios:
 *   1. Offline / poor-connectivity PWA scoring (last-known artifact).
 *   2. UI prefetch of "what-if" probabilities while the user is
 *      editing a manual override panel, before committing.
 *
 * Sessions are cached per modelVersionId; artifact bytes are cached
 * in IndexedDB via the browser's HTTP cache (server sets
 * Cache-Control: private, max-age=3600).
 */

const FEATURE_ORDER = [
  "meanTemp",
  "meanVibration",
  "rmsVibration",
  "meanPressure",
  "kurtosis",
  "peakToPeak",
] as const;

export type FeatureRecord = Partial<Record<(typeof FEATURE_ORDER)[number], number>>;

export interface WebOnnxScore {
  failureProbability: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  remainingUsefulLife: number;
  modelVersionId: string;
}

export function isWebOnnxEnabled(): boolean {
  return import.meta.env?.['VITE_PDM_ONNX_WEB'] === "1";
}

type OrtWebModule = typeof import("onnxruntime-web");
type OrtSession = Awaited<ReturnType<OrtWebModule["InferenceSession"]["create"]>>;

let ortModulePromise: Promise<OrtWebModule> | null = null;
function loadOrt(): Promise<OrtWebModule> {
  if (!ortModulePromise) {
    ortModulePromise = import("onnxruntime-web");
  }
  return ortModulePromise;
}

const sessionCache = new Map<string, Promise<OrtSession>>();

async function getSession(modelVersionId: string): Promise<OrtSession> {
  const existing = sessionCache.get(modelVersionId);
  if (existing) return existing;
  const fresh = (async () => {
    const ort = await loadOrt();
    const res = await fetch(`/api/v1/ml/models/${encodeURIComponent(modelVersionId)}/artifact`);
    if (!res.ok) throw new Error(`artifact fetch failed: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  })();
  sessionCache.set(modelVersionId, fresh);
  try {
    return await fresh;
  } catch (err) {
    sessionCache.delete(modelVersionId);
    throw err;
  }
}

function riskLevel(p: number): WebOnnxScore["riskLevel"] {
  if (p >= 0.7) return "critical";
  if (p >= 0.4) return "high";
  if (p >= 0.2) return "medium";
  return "low";
}

function extractProbability(data: Float32Array | BigInt64Array): number {
  if (data instanceof BigInt64Array) return Number(data[0]) > 0 ? 0.8 : 0.1;
  if (data.length === 1) {
    const v = data[0];
    return v >= 0 && v <= 1 ? v : 1 / (1 + Math.exp(-v));
  }
  let positive = data[data.length - 1];
  if (!(positive >= 0 && positive <= 1)) {
    let max = -Infinity;
    for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += Math.exp(data[i] - max);
    positive = Math.exp(data[data.length - 1] - max) / sum;
  }
  return Math.min(Math.max(positive, 0), 1);
}

export async function scoreInBrowser(
  modelVersionId: string,
  features: FeatureRecord
): Promise<WebOnnxScore> {
  const ort = await loadOrt();
  const session = await getSession(modelVersionId);
  const arr = new Float32Array(FEATURE_ORDER.length);
  for (let i = 0; i < FEATURE_ORDER.length; i++) {
    const v = features[FEATURE_ORDER[i]];
    arr[i] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  const tensor = new ort.Tensor("float32", arr, [1, FEATURE_ORDER.length]);
  const feeds: Record<string, typeof tensor> = { [session.inputNames[0]]: tensor };
  const out = await session.run(feeds);
  const probName =
    session.outputNames.find((n: string) => /prob|score|fail/i.test(n)) ?? session.outputNames[0];
  const data = out[probName].data as Float32Array | BigInt64Array;
  const failureProbability = extractProbability(data);
  return {
    failureProbability,
    riskLevel: riskLevel(failureProbability),
    remainingUsefulLife: Math.max(Math.floor(365 * (1 - failureProbability)), 7),
    modelVersionId,
  };
}

export function clearWebOnnxCache(): void {
  sessionCache.clear();
}
