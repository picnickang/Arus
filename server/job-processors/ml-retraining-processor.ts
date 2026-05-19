/**
 * Push A1 — Weekly model retraining processor.
 *
 * Per org with sufficient labelled outcomes in the rolling window:
 *   1. Invoke the training harness as a child process per equipment type.
 *      The harness loads outcomes, joins to point-in-time feature
 *      snapshots, trains the candidate, exports an ONNX artifact, and
 *      emits a JSON metrics block on stdout.
 *   2. Parse the candidate's reported MAE / PSI from stdout.
 *   3. Auto-promote (via the production-internal promote API path) iff
 *      candidate MAE improves by >= 5% over the current production model
 *      and the training-vs-serving PSI is < 0.25.
 *
 * Concrete model trainers (XGBoost for bearing & pump, RUL regressors)
 * are pulled in by the skeleton harness as Push A2/A3 wires them; this
 * processor is the orchestration shell that keeps the promotion criteria
 * and observability in one place.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { predictionOutcomes, equipment } from "@shared/schema";
import { createLogger } from "../lib/structured-logger";

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

interface TrainerMetrics {
  mae?: number;
  productionMae?: number;
  psi?: number;
  artifactPath?: string;
  modelId?: string;
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

function parseTrainerMetrics(stdout: string): TrainerMetrics {
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
    const script = path.resolve(process.cwd(), "scripts/ml/train-model-skeleton.mjs");
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
      const improvement =
        metrics.mae != null && metrics.productionMae != null && metrics.productionMae > 0
          ? ((metrics.productionMae - metrics.mae) / metrics.productionMae) * 100
          : undefined;
      const psiOk = metrics.psi == null || metrics.psi < MAX_PSI_FOR_PROMOTION;
      const maeOk = improvement != null && improvement >= MIN_MAE_IMPROVEMENT_PCT;
      let promoted = false;
      let skipped: string | undefined;
      if (code !== 0) {
        skipped = `trainer exit code ${code}`;
      } else if (!metrics.modelId) {
        skipped = "trainer did not register a candidate model";
      } else if (!maeOk) {
        skipped = `MAE improvement ${improvement?.toFixed(2)}% < ${MIN_MAE_IMPROVEMENT_PCT}%`;
      } else if (!psiOk) {
        skipped = `PSI ${metrics.psi?.toFixed(3)} >= ${MAX_PSI_FOR_PROMOTION}`;
      } else {
        promoted = await attemptPromote(orgId, metrics.modelId, metrics, !!data.dryRun);
        if (promoted) candidatesPromoted += 1;
        else if (data.dryRun) skipped = "dryRun";
      }
      attempts.push({
        orgId,
        equipmentType,
        outcomesUsed,
        candidateMae: metrics.mae,
        productionMae: metrics.productionMae,
        maeImprovementPct: improvement,
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
