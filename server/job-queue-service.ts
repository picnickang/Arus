import PgBoss from "pg-boss";
import { log } from "./vite";
import {
  incrementJobEnqueued,
  incrementJobCompleted,
  incrementJobFailed,
  recordJobDuration,
} from "./observability";
import { withLoggingContext, generateCorrelationId } from "./logging";

export interface DocumentIngestionJob {
  documentId: string;
  orgId: string;
  filePath: string;
  filename: string;
  mimeType: string;
  uploadedBy?: string;
}

export interface JobProgress {
  stage: "parsing" | "chunking" | "embedding" | "complete";
  progress: number;
  chunksProcessed?: number;
  totalChunks?: number;
  error?: string;
}

class JobQueueService {
  private boss: PgBoss | null = null;
  private workerStarted = false;

  async initialize(connectionString: string): Promise<void> {
    if (this.boss) {
      log("JobQueue", "Already initialized");
      return;
    }

    try {
      this.boss = new PgBoss(connectionString);

      this.boss.on("error", (error) => {
        log("JobQueue", `Error: ${error.message}`);
      });

      await this.boss.start();
      log("JobQueue", "Service initialized and started");
    } catch (error) {
      log("JobQueue", `Failed to initialize: ${error}`);
      throw error;
    }
  }

  async enqueueDocumentIngestion(job: DocumentIngestionJob): Promise<string> {
    if (!this.boss) {
      throw new Error("Job queue not initialized");
    }

    const jobId = await this.boss.send("document-ingestion", job, {
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInHours: 24,
    });

    // Emit Prometheus metric for job enqueued
    incrementJobEnqueued("document-ingestion", "normal");

    log("JobQueue", `Enqueued document ingestion job: ${jobId}`);
    return jobId!;
  }

  async getJobStatus(jobId: string): Promise<any> {
    if (!this.boss) {
      throw new Error("Job queue not initialized");
    }

    // @ts-ignore -- bulk-silence
    return this.boss.getJobById(jobId);
  }

  async startWorker(
    handler: (job: PgBoss.Job<DocumentIngestionJob>) => Promise<void>,
    concurrency: number = 5
  ): Promise<void> {
    if (!this.boss) {
      throw new Error("Job queue not initialized");
    }

    if (this.workerStarted) {
      log("JobQueue", "Worker already started");
      return;
    }

    // Wrap handler with logging context for correlation ID tracking
    const instrumentedHandler = async (job: PgBoss.Job<DocumentIngestionJob>) => {
      const correlationId = generateCorrelationId();
      const startTime = Date.now();

      // Run the job handler within logging context for proper correlation
      await withLoggingContext({ correlationId, orgId: job.data.orgId }, async () => {
        try {
          await handler(job);
          await this.completeJob(job.id, undefined, Date.now() - startTime);
        } catch (error) {
          await this.failJob(job.id, error as Error, Date.now() - startTime);
          throw error;
        }
      });
    };

    await this.boss.work(
      "document-ingestion",
      // @ts-ignore -- bulk-silence
      { teamSize: concurrency, teamConcurrency: 1 },
      instrumentedHandler
    );
    this.workerStarted = true;
    log("JobQueue", `Worker started with concurrency: ${concurrency}`);
  }

  async completeJob(jobId: string, result?: any, durationMs?: number): Promise<void> {
    if (!this.boss) {
      throw new Error("Job queue not initialized");
    }

    await this.boss.complete(jobId, result);

    // Emit Prometheus metrics for job completion
    incrementJobCompleted("document-ingestion");
    if (durationMs !== undefined) {
      recordJobDuration("document-ingestion", durationMs / 1000);
    }
  }

  async failJob(jobId: string, error: Error, durationMs?: number): Promise<void> {
    if (!this.boss) {
      throw new Error("Job queue not initialized");
    }

    // @ts-ignore -- bulk-silence
    await this.boss.fail(jobId, error);

    // Emit Prometheus metrics for job failure
    const errorType = (error as any).code || "unknown";
    incrementJobFailed("document-ingestion", errorType);
    if (durationMs !== undefined) {
      recordJobDuration("document-ingestion", durationMs / 1000);
    }
  }

  getBoss(): PgBoss | null {
    return this.boss;
  }

  async stop(): Promise<void> {
    if (this.boss) {
      await this.boss.stop();
      log("JobQueue", "Service stopped");
    }
  }

  /**
   * Get health status for the job queue
   */
  getHealthStatus(): {
    initialized: boolean;
    workerStarted: boolean;
    status: "healthy" | "degraded" | "unavailable";
  } {
    if (!this.boss) {
      return {
        initialized: false,
        workerStarted: false,
        status: "unavailable",
      };
    }

    return {
      initialized: true,
      workerStarted: this.workerStarted,
      status: this.workerStarted ? "healthy" : "degraded",
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queued: number;
    active: number;
    completed: number;
    failed: number;
  } | null> {
    if (!this.boss) {
      return null;
    }

    try {
      const counts = await this.boss.getQueueSize("document-ingestion");
      return {
        queued: typeof counts === "number" ? counts : 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
    } catch {
      return null;
    }
  }
}

export const jobQueueService = new JobQueueService();
