import { logger } from "../utils/logger";

const LOG_CTX = "DashboardPrecompute";

interface PrecomputedDashboard {
  data: unknown;
  computedAt: Date;
  durationMs: number;
  stale: boolean;
}

class DashboardPrecomputeService {
  private cache = new Map<string, PrecomputedDashboard>();
  private isRunning = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private computeFn: ((orgId: string) => Promise<unknown>) | null = null;
  private intervalMs = 60 * 1000;
  private maxStaleMs = 5 * 60 * 1000;
  private orgIds: string[] = [];

  start(
    computeFn: (orgId: string) => Promise<unknown>,
    orgIds: string[],
    intervalMs?: number
  ): void {
    this.computeFn = computeFn;
    this.orgIds = orgIds;
    this.intervalMs = intervalMs ?? this.intervalMs;

    this.runAll().catch(err =>
      logger.error(LOG_CTX, "Initial computation failed", err)
    );

    this.intervalHandle = setInterval(() => {
      this.runAll().catch(err =>
        logger.error(LOG_CTX, "Scheduled computation failed", err)
      );
    }, this.intervalMs);

    this.isRunning = true;
    logger.info(LOG_CTX, `Started. ${orgIds.length} orgs, ${this.intervalMs}ms interval`);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
  }

  get(orgId: string): PrecomputedDashboard | null {
    const entry = this.cache.get(orgId);
    if (!entry) return null;

    const stale = Date.now() - entry.computedAt.getTime() > this.maxStaleMs;
    return { ...entry, stale };
  }

  addOrg(orgId: string): void {
    if (!this.orgIds.includes(orgId)) {
      this.orgIds.push(orgId);
      this.computeForOrg(orgId).catch(err =>
        logger.error(LOG_CTX, `Failed to compute for new org ${orgId}`, err)
      );
    }
  }

  private async runAll(): Promise<void> {
    for (const orgId of this.orgIds) {
      await this.computeForOrg(orgId);
    }
  }

  private async computeForOrg(orgId: string): Promise<void> {
    if (!this.computeFn) return;

    const start = Date.now();
    try {
      const data = await this.computeFn(orgId);
      this.cache.set(orgId, {
        data,
        computedAt: new Date(),
        durationMs: Date.now() - start,
        stale: false,
      });
    } catch (error) {
      logger.warn(LOG_CTX, `Computation failed for org ${orgId}, keeping stale data`, error);
    }
  }

  getStatus(): { isRunning: boolean; cachedOrgs: number; intervalMs: number } {
    return {
      isRunning: this.isRunning,
      cachedOrgs: this.cache.size,
      intervalMs: this.intervalMs,
    };
  }
}

export const dashboardPrecompute = new DashboardPrecomputeService();
export default DashboardPrecomputeService;
