/**
 * ML Training Job Queue
 *
 * GAP FILL #6: Moves ML training off the API server event loop onto background workers.
 *
 * Problem: LSTM training on a year of telemetry data blocks the Node.js event loop
 * for minutes, making the entire API unresponsive.
 *
 * Solution: Route training requests through pg-boss (already used for KB document
 * ingestion in the codebase). Training runs asynchronously, with status polling
 * and WebSocket notifications on completion.
 *
 * Integration points:
 * - Uses existing pg-boss instance from job-queue-service
 * - Uses existing WebSocket server for completion notifications
 * - Uses existing model registry for storing results
 *
 * Usage:
 *   const mlJobQueue = new MlTrainingJobQueue(pgBoss, db);
 *   const jobId = await mlJobQueue.enqueueTraining(orgId, config);
 *   const status = await mlJobQueue.getJobStatus(jobId);
 */

import PgBoss from "pg-boss";
import type { db as DbInstance } from "../../db";
import type { TrainingResult } from "../../ml-training-pipeline";
import { logger } from "../../utils/logger";

const LOG_CTX = "MlTrainingJobQueue";
const QUEUE_NAME = "ml-training";

// ============================================================================
// Types
// ============================================================================

export interface MlTrainingJobData {
  orgId: string;
  modelType: "lstm" | "random_forest" | "xgboost" | "all";
  equipmentType?: string | undefined;
  config: Record<string, unknown>;
  initiatedBy?: string | undefined;
  priority?: number | undefined;
}

export interface MlTrainingJobResult {
  modelId?: string | undefined;
  modelType: string;
  success: boolean;
  metrics?: Record<string, number> | undefined;
  error?: string | undefined;
  durationMs: number;
  /**
   * Outcome of the held-out evaluation gate for this run:
   *  - "passed"        — ModelEvaluationGate ran and approved the model.
   *  - "failed"        — gate ran and rejected the model.
   *  - "not_evaluated" — no held-out test data was available, or the gate
   *                      itself errored. NEVER reported as "passed".
   * Replaces the old `evaluationPassed: true` placeholder, which dishonestly
   * claimed every model passed an evaluation that never actually ran.
   */
  evaluationStatus?: "passed" | "not_evaluated" | "failed" | undefined;
}

export interface MlJobStatus {
  jobId: string;
  state: "pending" | "active" | "completed" | "failed" | "expired";
  data: MlTrainingJobData;
  result?: MlTrainingJobResult | undefined;
  createdAt: Date;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
  progress?: number | undefined;
}

/**
 * Narrow structural type for the only WebSocket method this service uses.
 * Matches `server/websocket.ts` `broadcast(channel, data, orgId?)` signature.
 */
export interface WsBroadcaster {
  broadcast: (channel: string, data: Record<string, unknown>, orgId?: string) => void;
}

type DbHandle = typeof DbInstance;

/**
 * pg-boss v10 reports states as
 *   'created' | 'retry' | 'active' | 'completed' | 'cancelled' | 'failed'
 * (see `node_modules/pg-boss/types.d.ts`). Map to the public MlJobStatus
 * state union so external consumers keep a stable contract.
 */
function mapState(raw: string | undefined | null): MlJobStatus["state"] {
  switch (raw) {
    case "created":
    case "retry":
      return "pending";
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "cancelled":
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}

// ============================================================================
// Main Service
// ============================================================================

export class MlTrainingJobQueue {
  private boss: PgBoss;
  private db: DbHandle | undefined;
  private wsServer: WsBroadcaster | undefined;
  private isWorkerRegistered = false;

  constructor(pgBoss: PgBoss, db?: DbHandle, wsServer?: WsBroadcaster) {
    this.boss = pgBoss;
    this.db = db;
    this.wsServer = wsServer;
  }

  /**
   * Register the worker that processes training jobs.
   * Call this once on server startup.
   *
   * pg-boss v10's `WorkHandler<T>` receives `Job<T>[]` — a batch — so we
   * iterate even though `teamSize:1, teamConcurrency:1` means batches of
   * one in practice.
   */
  async registerWorker(): Promise<void> {
    if (this.isWorkerRegistered) {
      return;
    }

    // pg-boss v10: concurrency is controlled by `batchSize` (max jobs per
    // fetch). Keep training serialized by fetching one at a time.
    await this.boss.work<MlTrainingJobData>(QUEUE_NAME, { batchSize: 1 }, async (jobs) => {
      const results: MlTrainingJobResult[] = [];
      for (const job of jobs) {
        results.push(await this.processTrainingJob(job));
      }
      return results.length === 1 ? results[0] : results;
    });

    this.isWorkerRegistered = true;
    logger.info(LOG_CTX, "ML training worker registered");
  }

  /**
   * Enqueue a new training job. Returns the pg-boss job ID, or throws if
   * pg-boss declines to accept the job (e.g. duplicate singleton key).
   */
  async enqueueTraining(data: MlTrainingJobData): Promise<string> {
    const jobId = await this.boss.send(QUEUE_NAME, data, {
      expireInSeconds: 45 * 60,
      retryLimit: 1,
      priority: data.priority ?? 0,
    });

    if (!jobId) {
      throw new Error("pg-boss rejected the training job (no jobId returned)");
    }

    logger.info(LOG_CTX, `Training job enqueued: ${jobId}`, {
      orgId: data.orgId,
      modelType: data.modelType,
    });

    return jobId;
  }

  /**
   * Get the status of a training job.
   *
   * pg-boss v10's `getJobById` requires both the queue name and the id, and
   * returns `JobWithMetadata<T> | null` with camelCase metadata fields.
   */
  async getJobStatus(jobId: string): Promise<MlJobStatus | null> {
    const job = await this.boss.getJobById<MlTrainingJobData>(QUEUE_NAME, jobId, {
      includeArchive: true,
    });
    if (!job) {
      return null;
    }

    const output = job.output as MlTrainingJobResult | null | undefined;

    return {
      jobId: job.id,
      state: mapState(job.state),
      data: job.data,
      result: output ?? undefined,
      createdAt: new Date(job.createdOn),
      startedAt: job.startedOn ? new Date(job.startedOn) : undefined,
      completedAt: job.completedOn ? new Date(job.completedOn) : undefined,
    };
  }

  /**
   * Get all training jobs for an org (recent).
   *
   * Reads `pgboss.job` directly so we can org-scope without iterating the
   * SDK. The raw pg-boss columns are lowercase (`createdon`, `startedon`,
   * `completedon`) — distinct from the SDK-side camelCase metadata.
   */
  async getRecentJobs(orgId: string, limit = 20): Promise<MlJobStatus[]> {
    if (!this.db) {
      return [];
    }
    try {
      const { sql } = await import("drizzle-orm");
      const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
      const result = await this.db.execute(
        sql`SELECT id, state, data, output, createdon, startedon, completedon
        FROM pgboss.job
        WHERE name = ${QUEUE_NAME}
          AND data->>'orgId' = ${orgId}
        ORDER BY createdon DESC
        LIMIT ${safeLimit}`
      );

      const rawRows = result?.rows ?? [];
      return rawRows.flatMap((raw): MlJobStatus[] => {
        if (!raw || typeof raw !== "object") {
          return [];
        }
        const row = raw as Record<string, unknown>;
        const id = row["id"];
        const state = row["state"];
        const createdon = row["createdon"];
        if (typeof id !== "string" || typeof state !== "string") {
          return [];
        }
        if (!(typeof createdon === "string" || createdon instanceof Date)) {
          return [];
        }
        const startedon = row["startedon"];
        const completedon = row["completedon"];
        const data = (row["data"] ?? {}) as MlTrainingJobData;
        const output = (row["output"] ?? undefined) as MlTrainingJobResult | undefined;
        return [
          {
            jobId: id,
            state: mapState(state),
            data,
            result: output ?? undefined,
            createdAt: new Date(createdon),
            startedAt:
              typeof startedon === "string" || startedon instanceof Date
                ? new Date(startedon)
                : undefined,
            completedAt:
              typeof completedon === "string" || completedon instanceof Date
                ? new Date(completedon)
                : undefined,
          },
        ];
      });
    } catch {
      return [];
    }
  }

  // ===========================================================================
  // Private: Job processing
  // ===========================================================================

  /**
   * Run the model-evaluation gate for a completed training run.
   *
   * Returns "not_evaluated" when the run carried no held-out test data (the
   * current reality — the training pipeline is a stub) OR when the gate itself
   * errors. A gate error must never be laundered into a "passed": a model that
   * was not genuinely evaluated is reported as such so downstream deployment
   * logic cannot treat it as validated.
   */
  private async runEvaluationGate(
    orgId: string,
    result: TrainingResult | undefined
  ): Promise<"passed" | "not_evaluated" | "failed"> {
    const evaluation = result?.evaluation;
    if (!evaluation || evaluation.testData.length === 0 || !this.db) {
      return "not_evaluated";
    }
    const db = this.db;
    try {
      const { ModelEvaluationGate } = await import("./model-evaluation-gate");
      // Worker evaluations always use the gate's DEFAULT_CONFIG thresholds.
      // Request-provided thresholds (as accepted by /api/ml/evaluate-model)
      // are not threaded through training jobs.
      const gate = new ModelEvaluationGate(db);
      const gateResult = await gate.evaluate(
        orgId,
        evaluation.modelId,
        evaluation.testData,
        evaluation.predict
      );
      return gateResult.approved ? "passed" : "failed";
    } catch (error) {
      logger.error(LOG_CTX, "Model evaluation gate errored; recording run as not_evaluated", error);
      return "not_evaluated";
    }
  }

  private async processTrainingJob(
    job: PgBoss.Job<MlTrainingJobData>
  ): Promise<MlTrainingJobResult> {
    const data = job.data;
    const startTime = Date.now();

    logger.info(LOG_CTX, `Processing training job ${job.id}: ${data.modelType}`, {
      orgId: data.orgId,
    });

    try {
      let result: TrainingResult | undefined;
      const equipmentType = data.equipmentType ?? "unknown";

      if (data.modelType === "all") {
        const { retrainAllModels } = await import("../../ml-training-pipeline");
        const all = await retrainAllModels(data.orgId, data.equipmentType);
        result = all[0];
      } else if (data.modelType === "lstm") {
        const { trainLSTMForFailurePrediction } = await import("../../ml-training-pipeline");
        result = await trainLSTMForFailurePrediction({
          jobId: job.id,
          orgId: data.orgId,
          equipmentType,
          modelType: "lstm",
          ...((data.config["lstmConfig"] as Record<string, unknown> | undefined) || {}),
        });
      } else if (data.modelType === "random_forest") {
        const { trainRFForHealthClassification } = await import("../../ml-training-pipeline");
        result = await trainRFForHealthClassification({
          jobId: job.id,
          orgId: data.orgId,
          equipmentType,
          modelType: "random_forest",
          ...((data.config["rfConfig"] as Record<string, unknown> | undefined) || {}),
        });
      } else if (data.modelType === "xgboost") {
        const { trainXGBoostForHealthClassification } = await import("../../ml-training-pipeline");
        result = await trainXGBoostForHealthClassification({
          jobId: job.id,
          orgId: data.orgId,
          equipmentType,
          modelType: "xgboost",
          ...((data.config["xgboostConfig"] as Record<string, unknown> | undefined) || {}),
        });
      }

      const durationMs = Date.now() - startTime;

      // Run the held-out evaluation gate before reporting success. When the
      // training run surfaced no test data the status is "not_evaluated" —
      // we never claim a model "passed" an evaluation that did not run.
      const evaluationStatus = await this.runEvaluationGate(data.orgId, result);

      // Notify via WebSocket
      this.notifyCompletion(data.orgId, job.id, data.modelType, true, durationMs);

      logger.info(
        LOG_CTX,
        `Training job ${job.id} completed in ${durationMs}ms (evaluation: ${evaluationStatus})`,
        { orgId: data.orgId }
      );

      return {
        modelType: data.modelType,
        success: true,
        metrics: result?.metrics,
        durationMs,
        evaluationStatus,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error(LOG_CTX, `Training job ${job.id} failed: ${errorMsg}`, { orgId: data.orgId });

      // Notify failure via WebSocket
      this.notifyCompletion(data.orgId, job.id, data.modelType, false, durationMs, errorMsg);

      return {
        modelType: data.modelType,
        success: false,
        error: errorMsg,
        durationMs,
      };
    }
  }

  private notifyCompletion(
    orgId: string,
    jobId: string,
    modelType: string,
    success: boolean,
    durationMs: number,
    error?: string
  ): void {
    if (!this.wsServer) {
      return;
    }

    try {
      this.wsServer.broadcast(
        "ml_training",
        {
          type: "ml_training_complete",
          orgId,
          jobId,
          modelType,
          success,
          durationMs,
          error,
          timestamp: new Date().toISOString(),
        },
        orgId
      );
    } catch {
      // WebSocket notification is best-effort
    }
  }
}
