/**
 * Push A1 — ONNX Runtime inference adapter.
 *
 * Implements the hexagonal `InferenceRunnerPort` from
 * `server/domains/pdm-platform/inference/ports.ts` using onnxruntime-node.
 * Models trained out-of-band (XGBoost via sklearn -> ONNX, bearing/pump
 * RUL regressors, etc.) are stored on disk as `.onnx` artifacts and loaded
 * via this adapter.
 *
 * Lazy module import keeps onnxruntime-node off the cold-start critical
 * path; sessions are cached per absolute model path so repeated
 * predictions reuse the underlying `ort.InferenceSession`.
 *
 * The adapter is intentionally model-agnostic: it inspects the loaded
 * graph's first input/output names rather than hard-coding tensor names,
 * so the same code path serves both classification heads (probability
 * vector) and regression heads (RUL scalar). Models that disagree with
 * the expected feature shape throw at predict time — caller is wrapped
 * by the existing `serveWithShadowOrCanary` so candidate errors NEVER
 * propagate to the user-facing path.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createLogger } from "../lib/structured-logger";
import type {
  FeatureVector,
  InferenceContext,
  InferenceRunnerPort,
  PredictionScore,
} from "../domains/pdm-platform/inference/ports";

const logger = createLogger("OnnxInferenceAdapter");

interface OrtSessionLike {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | BigInt64Array }>>;
}

interface OrtModuleLike {
  InferenceSession: {
    create(path: string, options?: Record<string, unknown>): Promise<OrtSessionLike>;
  };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
}

let ortModulePromise: Promise<OrtModuleLike> | null = null;
function loadOrt(): Promise<OrtModuleLike> {
  if (!ortModulePromise) {
    ortModulePromise = import("onnxruntime-node")
      .then((m) => (m as object as { default?: OrtModuleLike }).default ?? (m as object as OrtModuleLike))
      .catch((err) => {
        ortModulePromise = null;
        throw err;
      });
  }
  return ortModulePromise;
}

const sessionCache = new Map<string, Promise<OrtSessionLike>>();

async function getSession(modelPath: string): Promise<OrtSessionLike> {
  const abs = path.resolve(modelPath);
  const existing = sessionCache.get(abs);
  if (existing) {return existing;}
  const fresh = (async () => {
    await fs.access(abs);
    const ort = await loadOrt();
    return ort.InferenceSession.create(abs, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
  })();
  sessionCache.set(abs, fresh);
  try {
    return await fresh;
  } catch (err) {
    sessionCache.delete(abs);
    throw err;
  }
}

/** Canonical feature ordering — must match the trainer's column order. */
export const ONNX_FEATURE_ORDER: ReadonlyArray<keyof FeatureVector> = [
  "meanTemp",
  "meanVibration",
  "rmsVibration",
  "meanPressure",
  "kurtosis",
  "peakToPeak",
] as const;

function buildFeatureTensor(
  ort: OrtModuleLike,
  features: FeatureVector
): InstanceType<OrtModuleLike["Tensor"]> {
  const arr = new Float32Array(ONNX_FEATURE_ORDER.length);
  for (let i = 0; i < ONNX_FEATURE_ORDER.length; i++) {
    const key = ONNX_FEATURE_ORDER[i];
    const v = key ? features[key] : undefined;
    arr[i] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  return new ort.Tensor("float32", arr, [1, ONNX_FEATURE_ORDER.length]);
}

function extractProbability(out: { data: Float32Array | BigInt64Array }): number {
  const data = out.data;
  if (!data || data.length === 0) {return 0;}
  if (data instanceof BigInt64Array) {
    return Number(data[0]) > 0 ? 0.8 : 0.1;
  }
  if (data.length === 1) {
    const v = data[0] ?? 0;
    return v >= 0 && v <= 1 ? v : 1 / (1 + Math.exp(-v));
  }
  let positive = data[data.length - 1] ?? 0;
  if (!(positive >= 0 && positive <= 1)) {
    let max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const di = data[i] ?? 0;
      if (di > max) {max = di;}
    }
    let sum = 0;
    for (let i = 0; i < data.length; i++) {sum += Math.exp((data[i] ?? 0) - max);}
    positive = Math.exp((data[data.length - 1] ?? 0) - max) / sum;
  }
  return Math.min(Math.max(positive, 0), 1);
}

function riskLevel(p: number): PredictionScore["riskLevel"] {
  if (p >= 0.7) {return "critical";}
  if (p >= 0.4) {return "high";}
  if (p >= 0.2) {return "medium";}
  return "low";
}

export interface OnnxInferenceAdapterOptions {
  modelPath: string;
  rulOutputName?: string;
  probabilityOutputName?: string;
}

export class OnnxInferenceAdapter implements InferenceRunnerPort {
  constructor(private readonly opts: OnnxInferenceAdapterOptions) {}

  async scoreFeatures(context: InferenceContext): Promise<PredictionScore> {
    const features = context.features;
    if (!features) {
      return {
        failureProbability: 0.1,
        riskLevel: "low",
        remainingUsefulLife: 90,
        method: "model",
        caveat: "ONNX adapter received null features — returning conservative default",
      };
    }

    const session = await getSession(this.opts.modelPath);
    const ort = await loadOrt();
    const tensor = buildFeatureTensor(ort, features);
    const inputName = session.inputNames[0];
    if (!inputName) {
      throw new Error("ONNX session has no input names");
    }
    const feeds: Record<string, unknown> = { [inputName]: tensor };

    let outputs: Record<string, { data: Float32Array | BigInt64Array }>;
    try {
      outputs = await session.run(feeds);
    } catch (err) {
      logger.warn("ONNX inference failed", {
        modelPath: this.opts.modelPath,
        equipmentId: context.equipmentId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const firstOut = session.outputNames[0];
    if (!firstOut) {
      throw new Error("ONNX session has no output names");
    }
    const probName =
      this.opts.probabilityOutputName ??
      session.outputNames.find((n) => /prob|score|fail/i.test(n)) ??
      firstOut;
    const rulName =
      this.opts.rulOutputName ?? session.outputNames.find((n) => /rul|days|life/i.test(n));

    const probOut = outputs[probName] ?? outputs[firstOut];
    if (!probOut) {
      throw new Error(`ONNX outputs missing probability tensor for ${probName}`);
    }
    const failureProbability = extractProbability(probOut);

    let remainingUsefulLife: number;
    const rulOut = rulName ? outputs[rulName] : undefined;
    if (rulOut && rulOut.data.length > 0) {
      const raw = rulOut.data;
      const first = raw[0] ?? 0;
      remainingUsefulLife = Math.max(
        Math.floor(raw instanceof BigInt64Array ? Number(first) : (first as number)),
        1
      );
    } else {
      remainingUsefulLife = Math.max(Math.floor(365 * (1 - failureProbability)), 7);
    }

    return {
      failureProbability,
      remainingUsefulLife,
      riskLevel: riskLevel(failureProbability),
      method: "model",
      caveat: `ONNX model ${path.basename(this.opts.modelPath)}`,
    };
  }
}

/** Test/admin hook — drops the in-memory session cache. */
export function clearOnnxSessionCache(): void {
  sessionCache.clear();
}
