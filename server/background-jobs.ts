/**
 * Background Jobs — pg-boss-backed implementation (Wave 0.1)
 *
 * Replaces the previous stub. Provides a typed `jobQueue` surface that:
 *   - registerProcessor(type, handler) — register before start; flushed on start()
 *   - start()                          — lazy-inits pg-boss, then `boss.work`s every registered processor
 *   - add(type, data)                  — enqueue a job (boss.send) with retry+backoff
 *   - getStats()                       — counters for the health endpoint
 *   - getRecentJobs(limit)             — in-memory ring buffer (last 100), no pg-boss table coupling
 *   - stop()                           — graceful drain for SIGTERM/SIGINT
 *
 * Failure model: if DATABASE_URL is missing OR pg-boss init throws, we fall
 * back to no-op mode (`supported: false`) and log a single warn — the app
 * still boots. This matches the pattern in `bootstrap/services.ts` for the
 * separate `jobQueueService` (which handles document-ingestion only).
 *
 * Schema isolation: pinned to schema `pgboss_bg` so this instance does not
 * collide with `server/job-queue-service.ts` (which uses the default `pgboss`
 * schema for document-ingestion). Two PgBoss instances on the same database
 * are supported by the library when they target different schemas.
 */

import PgBoss from "pg-boss";
import { createLogger } from "./lib/structured-logger";
import { withTenantContext } from "./middleware/db-context";
import { requireTenantAuth } from "@shared/config/tenant";
import { supportsPinnedConnection } from "./db-config";

const logger = createLogger("BackgroundJobs");

/**
 * Task #88: pull the tenant `orgId` out of a job payload if present.
 * Convention: every tenant-scoped job packs `{ orgId: "...", ... }` into
 * its data (matches the `pgboss-trace` shape). Returns `undefined` for
 * fleet-wide jobs that intentionally have no tenant scope.
 */
function extractOrgId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const candidate = (data as Record<string, unknown>).orgId;
  if (typeof candidate === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(candidate)) {
    return candidate;
  }
  return undefined;
}

export const JOB_TYPES = {
  PROCESS_TELEMETRY: "process-telemetry",
  GENERATE_REPORT: "generate-report",
  SYNC_DATA: "sync-data",
  AI_EQUIPMENT_ANALYSIS: "ai-equipment-analysis",
  AI_FLEET_ANALYSIS: "ai-fleet-analysis",
  REPORT_GENERATION_PDF: "report-generation-pdf",
  REPORT_GENERATION_CSV: "report-generation-csv",
  REPORT_GENERATION_HTML: "report-generation-html",
  CREW_SCHEDULING: "crew-scheduling",
  MAINTENANCE_SCHEDULING: "maintenance-scheduling",
  TELEMETRY_PROCESSING: "telemetry-processing",
  INVENTORY_OPTIMIZATION: "inventory-optimization",
  INSIGHTS_SNAPSHOT_GENERATION: "insights-snapshot-generation",
  MODEL_RETRAIN: "model-retrain-weekly",
  ML_STALE_MODEL_CHECK: "ml-stale-model-check-daily",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
export type JobHandler<T = unknown> = (data: T) => Promise<unknown> | unknown;

interface RecentJob {
  id: string;
  name: string;
  status: "processing" | "completed" | "failed";
  createdAt: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

interface JobQueueStats {
  supported: boolean;
  mode: "pg-boss" | "fallback";
  queued: number;
  processing: number;
  failed: number;
  completed: number;
  registeredHandlers: number;
  wiredHandlers: number;
  wireFailures: Record<string, string>;
}

const RECENT_JOBS_CAPACITY = 100;
const DEFAULT_RETRY_LIMIT = 3;
const DEFAULT_RETRY_BACKOFF = true;
const DEFAULT_BATCH_SIZE = 2;
const BACKGROUND_JOBS_SCHEMA = "pgboss_bg";

class BackgroundJobQueue {
  private boss: PgBoss | null = null;
  private initPromise: Promise<void> | null = null;
  private started = false;
  private fallback = false;

  // Handlers registered before start() get queued here and wired on start.
  private pendingHandlers = new Map<string, JobHandler<unknown>>();

  // Authoritative record of which processors actually got wired via
  // boss.work() — separate from `pendingHandlers` (which is only the
  // registration list) so the health endpoint can surface wire failures
  // instead of false-green `registeredHandlers: N`.
  private wiredHandlers = new Set<string>();
  private wireFailures = new Map<string, string>();

  // Counters for getStats() — sampled cheaply, not authoritative.
  private counters = { queued: 0, processing: 0, completed: 0, failed: 0 };

  // Bounded ring buffer for getRecentJobs() — avoids coupling the
  // health endpoint to pg-boss internal tables.
  private recent: RecentJob[] = [];

  registerProcessor<T = unknown>(type: string, handler: JobHandler<T>): void {
    if (!type) {
      logger.warn("registerProcessor called with empty type — ignored");
      return;
    }
    if (this.pendingHandlers.has(type)) {
      logger.warn(`Processor for "${type}" re-registered; overwriting`);
    }
    this.pendingHandlers.set(type, handler as JobHandler<unknown>);

    // If start() already ran, wire this handler now too.
    if (this.started && this.boss && !this.fallback) {
      void this.wireHandler(type, handler as JobHandler<unknown>);
    }
  }

  /**
   * Back-compat alias for the previous stub's `process()` method. Behaves
   * the same as `registerProcessor`.
   */
  process<T = unknown>(type: string, handler: JobHandler<T>): void {
    this.registerProcessor(type, handler);
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initialize();
    try {
      await this.initPromise;
    } finally {
      this.started = true;
    }
  }

  private async initialize(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      this.fallback = true;
      logger.warn(
        "DATABASE_URL not set — background jobs running in fallback mode (no persistence, no execution)",
      );
      return;
    }

    try {
      const boss = new PgBoss({
        connectionString,
        schema: BACKGROUND_JOBS_SCHEMA,
        // Keep archived jobs around long enough for the health endpoint
        // and post-mortem debugging, but not forever.
        archiveCompletedAfterSeconds: 60 * 60 * 24, // 24h
        deleteAfterDays: 7,
      });

      boss.on("error", (err: Error) => {
        logger.error("pg-boss error", { error: err.message });
      });

      await boss.start();
      this.boss = boss;

      // Wire every processor that was registered before start().
      for (const [type, handler] of this.pendingHandlers) {
        await this.wireHandler(type, handler);
      }

      logger.info(
        `Background job queue started (schema=${BACKGROUND_JOBS_SCHEMA}, processors=${this.pendingHandlers.size})`,
      );

      // Push A1 — register the weekly model-retrain cron once boss is
      // up. Sundays 03:00 UTC. pg-boss persists the schedule so a
      // restart does not double-enqueue.
      try {
        await boss.schedule(JOB_TYPES.MODEL_RETRAIN, "0 3 * * 0", {}, { retryLimit: 1 });
        logger.info(`Scheduled weekly cron: ${JOB_TYPES.MODEL_RETRAIN} @ 0 3 * * 0 UTC`);
      } catch (schedErr) {
        const msg = schedErr instanceof Error ? schedErr.message : String(schedErr);
        logger.warn(`Failed to register weekly retrain schedule: ${msg}`);
      }

      // #110 — daily stale-model SLO sweep. Catches missed weekly
      // retrains within 24h instead of waiting until the next Sunday.
      try {
        await boss.schedule(JOB_TYPES.ML_STALE_MODEL_CHECK, "0 4 * * *", {}, { retryLimit: 1 });
        logger.info(`Scheduled daily cron: ${JOB_TYPES.ML_STALE_MODEL_CHECK} @ 0 4 * * * UTC`);
      } catch (schedErr) {
        const msg = schedErr instanceof Error ? schedErr.message : String(schedErr);
        logger.warn(`Failed to register stale-model SLO schedule: ${msg}`);
      }
    } catch (err: unknown) {
      this.fallback = true;
      this.boss = null;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`pg-boss init failed — running in fallback mode: ${msg}`);
    }
  }

  private async wireHandler(type: string, handler: JobHandler<unknown>): Promise<void> {
    if (!this.boss) return;
    try {
      // pg-boss v10 uses `batchSize` for parallelism; the legacy v9
      // `teamSize`/`teamConcurrency` keys are no longer in WorkOptions.
      await this.boss.work<unknown>(
        type,
        { batchSize: DEFAULT_BATCH_SIZE },
        async (jobs) => {
          // v10 hands the worker an array of jobs (one element per batch slot).
          // Process them sequentially within the slot so handler signatures
          // stay simple (one job → one handler call).
          const jobList = Array.isArray(jobs) ? jobs : [jobs];
          for (const job of jobList) {
            await this.runOne(type, handler, job as { id: string; data: unknown });
          }
        },
      );
      this.wiredHandlers.add(type);
      this.wireFailures.delete(type);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.wireFailures.set(type, msg);
      logger.error(`Failed to wire handler for "${type}": ${msg}`);
    }
  }

  private async runOne(
    type: string,
    handler: JobHandler<unknown>,
    job: { id: string; data: unknown },
  ): Promise<void> {
    const { id: jobId, data } = job;
    this.counters.processing += 1;
    if (this.counters.queued > 0) this.counters.queued -= 1;
    const start = Date.now();
    const recentEntry: RecentJob = {
      id: jobId,
      name: type,
      status: "processing",
      createdAt: new Date().toISOString(),
    };
    this.pushRecent(recentEntry);

    try {
      // Task #88: pinned-RLS parity for background workers. If the job
      // payload carries an orgId (the pgboss-trace convention) and the
      // driver supports pinned connections, wrap the handler in a
      // per-job transaction with `SET LOCAL app.current_org_id` so any
      // `db.*` call the handler makes routes through the same pinned
      // client via `tenantContextStore`. If no orgId is present, run
      // the handler unwrapped — workers that don't touch tenant tables
      // (e.g. fleet-wide cron) are unaffected.
      const jobOrgId = extractOrgId(data);
      if (jobOrgId && supportsPinnedConnection) {
        await withTenantContext(jobOrgId, async () => {
          await handler(data);
        });
      } else {
        if (!jobOrgId && requireTenantAuth()) {
          logger.warn(
            `[${type}] job ${jobId} has no orgId in payload — running without pinned RLS context (REQUIRE_TENANT_AUTH=true)`,
          );
        }
        await handler(data);
      }
      this.counters.processing = Math.max(0, this.counters.processing - 1);
      this.counters.completed += 1;
      recentEntry.status = "completed";
      recentEntry.finishedAt = new Date().toISOString();
      recentEntry.durationMs = Date.now() - start;
    } catch (err: unknown) {
      this.counters.processing = Math.max(0, this.counters.processing - 1);
      this.counters.failed += 1;
      recentEntry.status = "failed";
      recentEntry.finishedAt = new Date().toISOString();
      recentEntry.durationMs = Date.now() - start;
      recentEntry.errorMessage = err instanceof Error ? err.message : String(err);
      // Re-throw so pg-boss can retry per its retry policy.
      throw err;
    }
  }

  async add<T = unknown>(
    type: string,
    data: T,
    options?: { retryLimit?: number; retryBackoff?: boolean; expireInHours?: number },
  ): Promise<string | null> {
    // Eliminate the startup-race window: if init is in flight, await it
    // before deciding fallback vs send. If start() hasn't been called yet
    // at all, kick it off now — schedulers normally call start() during
    // bootstrap, but a caller that races ahead should not silently drop
    // its job. After awaiting init, fallback semantics apply only if
    // pg-boss truly failed to come up.
    if (this.initPromise) {
      await this.initPromise;
    } else if (!this.started) {
      await this.start();
    }
    if (this.fallback || !this.boss) {
      // In fallback mode, drop the job silently after counting it as failed
      // so health metrics reflect lost work rather than pretending it queued.
      this.counters.failed += 1;
      this.pushRecent({
        id: `fallback-${Date.now()}`,
        name: type,
        status: "failed",
        createdAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        errorMessage: "background-jobs in fallback mode (no DATABASE_URL or pg-boss init failed)",
      });
      return null;
    }
    const jobId = await this.boss.send(type, data as object, {
      retryLimit: options?.retryLimit ?? DEFAULT_RETRY_LIMIT,
      retryBackoff: options?.retryBackoff ?? DEFAULT_RETRY_BACKOFF,
      expireInHours: options?.expireInHours ?? 24,
    });
    this.counters.queued += 1;
    return jobId ?? null;
  }

  getStats(): JobQueueStats {
    return {
      supported: !this.fallback,
      mode: this.fallback ? "fallback" : "pg-boss",
      queued: this.counters.queued,
      processing: this.counters.processing,
      failed: this.counters.failed,
      completed: this.counters.completed,
      registeredHandlers: this.pendingHandlers.size,
      wiredHandlers: this.wiredHandlers.size,
      wireFailures: Object.fromEntries(this.wireFailures),
    };
  }

  getRecentJobs(limit = 10): RecentJob[] {
    const n = Math.max(1, Math.min(limit, this.recent.length));
    // Most-recent-first.
    return this.recent.slice(-n).reverse();
  }

  async stop(): Promise<void> {
    if (!this.boss) return;
    try {
      await this.boss.stop({ graceful: true, timeout: 5000 });
      logger.info("Background job queue stopped");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Error during background job queue stop: ${msg}`);
    } finally {
      this.boss = null;
      this.started = false;
      this.initPromise = null;
    }
  }

  private pushRecent(entry: RecentJob): void {
    this.recent.push(entry);
    if (this.recent.length > RECENT_JOBS_CAPACITY) {
      this.recent.splice(0, this.recent.length - RECENT_JOBS_CAPACITY);
    }
  }
}

export const jobQueue = new BackgroundJobQueue();
