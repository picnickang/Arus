/**
 * Push A1 — Weekly model retraining processor (orchestration only).
 *
 * Per org with sufficient labelled outcomes in the rolling 7-day window:
 *   1. Invoke scripts/ml/train-model-sidecar.mjs as a child process per
 *      equipment type. The sidecar wrapper routes to the Python
 *      XGBoost+ONNX trainer (scripts/ml/python/train_xgb.py) for A1
 *      target types (bearing, pump — these HARD-FAIL when Python is
 *      unavailable) and to the JS calibration baseline otherwise.
 *      Either trainer emits the same JSON line:
 *      {stage:"metrics", modelId, mae, productionMae, psi, artifactPath?, nativeArtifactPath?}.
 *   2. Parse the reported MAE / PSI / modelId / artifactPath from stdout.
 *   3. Apply promotion gates: MAE improvement >= MIN_MAE_IMPROVEMENT_PCT
 *      AND PSI < MAX_PSI_FOR_PROMOTION. When both pass, perform the
 *      same atomic archive-deployed → deploy-candidate swap that the
 *      /ml/models/:id/promote endpoint performs (Wave 3.2). The
 *      promoted ml_models row is exactly what
 *      PredictionEngineService.resolveActiveVersion() and
 *      ModelBackedInferenceRunner read at serving time — closed loop.
 *   4. artifactPath / nativeArtifactPath are persisted by the Python
 *      trainer into ml_models.training_metrics so the registry-backed
 *      runner can locate the ONNX artifact on disk per modelVersionId.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { predictionOutcomes, equipment, mlModels } from "@shared/schema";
import { createLogger } from "../lib/structured-logger";
import {
  getWriteAdapter,
  ARTIFACT_URI_SCHEME,
} from "../domains/pdm-platform/infrastructure/artifact-storage";

const logger = createLogger("MlRetrainingProcessor");

const MIN_OUTCOMES_FOR_RETRAIN = 50;
const MIN_MAE_IMPROVEMENT_PCT = 5;
const MAX_PSI_FOR_PROMOTION = 0.25;
const RETRAIN_WINDOW_DAYS = 7;
const TRAINER_TIMEOUT_MS = 10 * 60 * 1000;

export interface ModelRetrainJobData {
  orgId?: string;
  equipmentType?: string;
  dryRun?: boolean;
}

export interface RetrainAttempt {
  orgId: string;
  equipmentType: string;
  outcomesUsed: number;
  candidateMae?: number;
  productionMae?: number;
  maeImprovementPct?: number;
  candidatePsi?: number;
  promoted: boolean;
  skipped?: string;
  artifactPath?: string;
  trainerExitCode?: number;
}

export interface ModelRetrainJobResult {
  retrainAt: string;
  orgsScanned: number;
  attempts: RetrainAttempt[];
  candidatesPromoted: number;
}

export interface TrainerMetrics {
  mae?: number;
  productionMae?: number;
  psi?: number;
  artifactPath?: string;
  modelId?: string;
}

export interface PromotionGateDecision {
  promote: boolean;
  improvementPct?: number;
  skipped?: string;
}

/** Push A1 — pure gate predicate, exported so the unit test can drive
 *  it against the same code the weekly job runs (no logic drift). */
export function evaluatePromotionGate(metrics: TrainerMetrics): PromotionGateDecision {
  const improvementPct =
    metrics.mae != null && metrics.productionMae != null && metrics.productionMae > 0
      ? ((metrics.productionMae - metrics.mae) / metrics.productionMae) * 100
      : undefined;
  if (!metrics.modelId) {
    return { promote: false, improvementPct, skipped: "trainer did not register a candidate model" };
  }
  const maeOk = improvementPct != null && improvementPct >= MIN_MAE_IMPROVEMENT_PCT;
  if (!maeOk) {
    return {
      promote: false,
      improvementPct,
      skipped: `MAE improvement ${improvementPct?.toFixed(2)}% < ${MIN_MAE_IMPROVEMENT_PCT}%`,
    };
  }
  const psiOk = metrics.psi == null || metrics.psi < MAX_PSI_FOR_PROMOTION;
  if (!psiOk) {
    return {
      promote: false,
      improvementPct,
      skipped: `PSI ${metrics.psi?.toFixed(3)} >= ${MAX_PSI_FOR_PROMOTION}`,
    };
  }
  return { promote: true, improvementPct };
}

async function fetchEligibleOutcomesCount(orgId: string, sinceMs: number): Promise<number> {
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(predictionOutcomes)
      .where(
        and(
          eq(predictionOutcomes.orgId, orgId),
          eq(predictionOutcomes.useForRetraining, true),
          gte(predictionOutcomes.observedAt, new Date(sinceMs))
        )
      );
    return rows[0]?.count ?? 0;
  } catch (err) {
    logger.warn("Failed to count eligible outcomes", {
      orgId,
      err: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

async function listOrgs(): Promise<string[]> {
  try {
    const rows = await db
      .select({ orgId: predictionOutcomes.orgId })
      .from(predictionOutcomes)
      .groupBy(predictionOutcomes.orgId);
    return rows.map((r) => r.orgId);
  } catch (err) {
    logger.warn("Failed to enumerate orgs for retrain — skipping", {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function listEquipmentTypes(orgId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ type: equipment.type })
      .from(equipment)
      .where(eq(equipment.orgId, orgId))
      .groupBy(equipment.type);
    return rows.map((r) => r.type).filter((t): t is string => !!t);
  } catch {
    return [];
  }
}

export function parseTrainerMetrics(stdout: string): TrainerMetrics {
  const metrics: TrainerMetrics = {};
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const json = JSON.parse(trimmed);
      if (json.stage === "metrics" || json.stage === "complete") {
        if (typeof json.mae === "number") metrics.mae = json.mae;
        if (typeof json.productionMae === "number") metrics.productionMae = json.productionMae;
        if (typeof json.psi === "number") metrics.psi = json.psi;
        if (typeof json.artifactPath === "string") metrics.artifactPath = json.artifactPath;
        if (typeof json.modelId === "string") metrics.modelId = json.modelId;
      }
    } catch {
      // ignore non-JSON lines
    }
  }
  return metrics;
}

function runTrainer(orgId: string, equipmentType: string): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    // Routes through train-model-sidecar.mjs so the Python XGBoost
    // trainer is used when ML_PYTHON_TRAINER=1 and falls back to the
    // JS calibration baseline otherwise. Same JSON-line contract.
    const script = path.resolve(process.cwd(), "scripts/ml/train-model-sidecar.mjs");
    const child = spawn("node", [script, `--org=${orgId}`, `--type=${equipmentType}`], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      logger.warn("Trainer timed out — killing", { orgId, equipmentType });
      child.kill("SIGKILL");
    }, TRAINER_TIMEOUT_MS);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (stderr) {
        logger.warn("Trainer stderr", { orgId, equipmentType, stderr: stderr.slice(0, 500) });
      }
      resolve({ stdout, code: code ?? -1 });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      logger.warn("Trainer spawn error", { orgId, equipmentType, err: err.message });
      resolve({ stdout, code: -1 });
    });
  });
}

/**
 * #108 — After Python writes ONNX (+ optional UBJ) to local disk and
 * INSERTs the ml_models row, upload both artifacts to the admin-
 * selected backend and mutate the row so `training_metrics.artifactPath`
 * + `.nativeArtifactPath` hold `arus-artifact://` URIs the runtime
 * read path knows how to resolve from anywhere. Best-effort: if upload
 * fails (transient network etc.), the local-path stays and the row
 * keeps resolving via the local-disk adapter — no regression vs. the
 * pre-#108 path.
 */
async function uploadCandidateArtifacts(
  orgId: string,
  modelId: string,
): Promise<void> {
  try {
    const [row] = await db
      .select({
        id: mlModels.id,
        metrics: mlModels.trainingMetrics,
      })
      .from(mlModels)
      .where(and(eq(mlModels.id, modelId), eq(mlModels.orgId, orgId)))
      .limit(1);
    if (!row) return;
    const metrics = { ...((row.metrics ?? {}) as Record<string, unknown>) };
    const artifactPath = metrics['artifactPath'] as string | undefined;
    const nativeArtifactPath = metrics['nativeArtifactPath'] as string | undefined;
    // Already migrated (idempotent — covers re-runs).
    if (artifactPath?.startsWith(ARTIFACT_URI_SCHEME)) return;
    if (!artifactPath) return;

    const adapter = await getWriteAdapter();
    if (adapter.backend === "local") {
      // Nothing to do — the local-disk adapter resolves bare paths as
      // legacy local artifacts. Leave the row untouched.
      return;
    }

    const uploads: Array<[string, "artifactPath" | "nativeArtifactPath"]> = [];
    uploads.push([artifactPath, "artifactPath"]);
    if (nativeArtifactPath) uploads.push([nativeArtifactPath, "nativeArtifactPath"]);

    for (const [localPath, field] of uploads) {
      try {
        await fs.access(localPath);
      } catch {
        logger.warn("Trainer artifact missing — skipping upload", {
          orgId,
          modelId,
          field,
          localPath,
        });
        continue;
      }
      const key = path.posix.join("models", path.basename(localPath));
      const ref = await adapter.put(localPath, key);
      metrics[field] = ref.uri;
      // Remove the staging copy ONLY after upload+row-update succeeds;
      // delete here is best-effort to keep ephemeral disk clean.
      fs.unlink(localPath).catch(() => undefined);
    }

    await db
      .update(mlModels)
      .set({ trainingMetrics: metrics as Record<string, unknown> })
      .where(and(eq(mlModels.id, modelId), eq(mlModels.orgId, orgId)));

    logger.info("Candidate artifacts uploaded to backend", {
      orgId,
      modelId,
      backend: adapter.backend,
      artifactPath: metrics['artifactPath'],
    });
  } catch (err) {
    // Hard-failing here would block a promotion that the gate already
    // approved on metrics. Leave the local-path row in place and emit
    // a structured alert so operators can re-run.
    logger.warn("ml.artifact.upload_failed", {
      event: "ml.artifact.upload_failed",
      orgId,
      modelId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function attemptPromote(
  orgId: string,
  modelId: string,
  metrics: TrainerMetrics,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    logger.info("Promotion skipped — dryRun", { orgId, modelId });
    return false;
  }
  try {
    const { dbMlAnalyticsStorage } = await import("../db/ml-analytics/index.js");
    const candidate = await dbMlAnalyticsStorage.getMlModel(modelId, orgId);
    if (!candidate || !candidate.equipmentType) {
      logger.warn("Cannot promote — candidate missing or no equipmentType", { modelId });
      return false;
    }
    const all = await dbMlAnalyticsStorage.getMlModels(orgId);
    const currentlyDeployed = all.filter(
      (m) =>
        m.status === "deployed" &&
        m.equipmentType === candidate.equipmentType &&
        m.id !== candidate.id
    );
    for (const prev of currentlyDeployed) {
      await dbMlAnalyticsStorage.updateMlModel(
        prev.id,
        { status: "archived", archivedOn: new Date() },
        orgId
      );
    }
    await dbMlAnalyticsStorage.updateMlModel(
      candidate.id,
      { status: "deployed", deployedOn: new Date(), archivedOn: null },
      orgId
    );
    logger.info("Candidate promoted", {
      orgId,
      modelId,
      mae: metrics.mae,
      psi: metrics.psi,
      replaced: currentlyDeployed.map((m) => m.id),
    });
    return true;
  } catch (err) {
    logger.warn("Promotion failed — leaving production model in place", {
      orgId,
      modelId,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function processModelRetrain(
  data: ModelRetrainJobData = {}
): Promise<ModelRetrainJobResult> {
  const retrainAt = new Date().toISOString();
  const sinceMs = Date.now() - RETRAIN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  logger.info("Weekly model retrain starting", {
    targetOrg: data.orgId ?? "(all)",
    targetType: data.equipmentType ?? "(all)",
    windowDays: RETRAIN_WINDOW_DAYS,
    dryRun: !!data.dryRun,
  });

  const orgs = data.orgId ? [data.orgId] : await listOrgs();
  const attempts: RetrainAttempt[] = [];
  let candidatesPromoted = 0;

  for (const orgId of orgs) {
    const outcomesUsed = await fetchEligibleOutcomesCount(orgId, sinceMs);
    if (outcomesUsed < MIN_OUTCOMES_FOR_RETRAIN) {
      attempts.push({
        orgId,
        equipmentType: "*",
        outcomesUsed,
        promoted: false,
        skipped: `insufficient labelled outcomes (${outcomesUsed} < ${MIN_OUTCOMES_FOR_RETRAIN})`,
      });
      continue;
    }

    const types = data.equipmentType ? [data.equipmentType] : await listEquipmentTypes(orgId);
    for (const equipmentType of types) {
      const { stdout, code } = await runTrainer(orgId, equipmentType);
      const metrics = parseTrainerMetrics(stdout);
      const gate = evaluatePromotionGate(metrics);
      let promoted = false;
      let skipped: string | undefined = gate.skipped;
      if (code !== 0) {
        skipped = `trainer exit code ${code}`;
      } else if (gate.promote && metrics.modelId) {
        // #108: Lift the locally-staged artifact into the admin-
        // configured backend BEFORE promotion so the ml_models row the
        // runtime reads carries the canonical URI from the moment it
        // flips to 'deployed'. No-op when the backend is 'local'.
        await uploadCandidateArtifacts(orgId, metrics.modelId);
        promoted = await attemptPromote(orgId, metrics.modelId, metrics, !!data.dryRun);
        if (promoted) candidatesPromoted += 1;
        else if (data.dryRun) skipped = "dryRun";
      } else if (!gate.promote && metrics.modelId) {
        // #110: Surface failed-gate decisions as structured alerts so
        // operators see WHICH gate blocked promotion (MAE regression
        // or PSI drift) rather than only the silent log warn that
        // existed before. Keyed `event=ml.promotion.gate_failed` for
        // Loki/observability pipelines.
        logger.warn("ml.promotion.gate_failed", {
          event: "ml.promotion.gate_failed",
          orgId,
          equipmentType,
          modelId: metrics.modelId,
          reason: gate.skipped,
          candidateMae: metrics.mae,
          productionMae: metrics.productionMae,
          improvementPct: gate.improvementPct,
          psi: metrics.psi,
          maeThresholdPct: MIN_MAE_IMPROVEMENT_PCT,
          psiThreshold: MAX_PSI_FOR_PROMOTION,
        });
      }
      attempts.push({
        orgId,
        equipmentType,
        outcomesUsed,
        candidateMae: metrics.mae,
        productionMae: metrics.productionMae,
        maeImprovementPct: gate.improvementPct,
        candidatePsi: metrics.psi,
        artifactPath: metrics.artifactPath,
        trainerExitCode: code,
        promoted,
        skipped,
      });
    }
  }

  const result: ModelRetrainJobResult = {
    retrainAt,
    orgsScanned: orgs.length,
    attempts,
    candidatesPromoted,
  };
  logger.info("Weekly model retrain finished", {
    retrainAt: result.retrainAt,
    orgsScanned: result.orgsScanned,
    candidatesPromoted: result.candidatesPromoted,
    attemptCount: attempts.length,
  });
  return result;
}
