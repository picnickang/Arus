import type { AssetTwinState, TwinResidual } from "@shared/schema";
import type { ITwinFreshnessStorage, ITwinUpdateScheduler, TwinFreshnessInfo } from "./ports";
import { TwinStateService } from "../digital-twin/twin-state/twin-state.service";
import { ResidualAnalysisService } from "../digital-twin/residual-analysis/residual-analysis.service";
import { logger } from "../../../utils/logger";

const STALE_THRESHOLD_MINUTES = 10;

export class TwinUpdateService implements ITwinUpdateScheduler {
  constructor(
    private freshnessStorage: ITwinFreshnessStorage,
    private twinStateService: TwinStateService,
    private residualService: ResidualAnalysisService
  ) {}

  async refreshOneTwin(
    orgId: string,
    twinId: string
  ): Promise<{ state: AssetTwinState; residuals: TwinResidual[] }> {
    logger.info("[TwinUpdateService]", "Refreshing twin", { orgId, twinId });

    const state = await this.twinStateService.computeState(orgId, twinId);
    const residuals = await this.residualService.computeResiduals(orgId, twinId);

    logger.info("[TwinUpdateService]", "Twin refreshed", {
      orgId,
      twinId,
      healthScore: state.healthScore,
      residualCount: residuals.length,
    });

    return { state, residuals };
  }

  async refreshAllActiveTwins(orgId: string): Promise<{
    refreshed: number;
    failed: number;
    results: Array<{ twinId: string; success: boolean; error?: string }>;
  }> {
    const twins = await this.freshnessStorage.getActiveTwins(orgId);
    logger.info("[TwinUpdateService]", "Refreshing all active twins", {
      orgId,
      count: twins.length,
    });

    let refreshed = 0;
    let failed = 0;
    const results: Array<{ twinId: string; success: boolean; error?: string }> = [];

    for (const twin of twins) {
      try {
        await this.refreshOneTwin(orgId, twin.id);
        refreshed++;
        results.push({ twinId: twin.id, success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failed++;
        results.push({ twinId: twin.id, success: false, error: message });
        logger.warn("[TwinUpdateService]", "Failed to refresh twin", {
          orgId,
          twinId: twin.id,
          error: message,
        });
      }
    }

    logger.info("[TwinUpdateService]", "Refresh all complete", {
      orgId,
      refreshed,
      failed,
      total: twins.length,
    });

    return { refreshed, failed, results };
  }

  async getFreshnessStatus(orgId: string): Promise<TwinFreshnessInfo[]> {
    const twins = await this.freshnessStorage.getActiveTwins(orgId);
    const now = new Date();

    const freshnessPromises = twins.map(async (twin) => {
      const [lastStateUpdate, lastResidualUpdate] = await Promise.all([
        this.freshnessStorage.getLatestStateTimestamp(orgId, twin.id),
        this.freshnessStorage.getLatestResidualTimestamp(orgId, twin.id),
      ]);

      const latestUpdate = this.getLatestTimestamp(lastStateUpdate, lastResidualUpdate);
      const staleSinceMinutes = latestUpdate
        ? Math.round((now.getTime() - latestUpdate.getTime()) / 60000)
        : null;
      const isStale = staleSinceMinutes === null || staleSinceMinutes > STALE_THRESHOLD_MINUTES;

      return {
        twinId: twin.id,
        twinName: twin.name,
        equipmentId: twin.equipmentId,
        status: twin.status,
        lastStateUpdate,
        lastResidualUpdate,
        isStale,
        staleSinceMinutes,
      };
    });

    return Promise.all(freshnessPromises);
  }

  async getTwinFreshness(orgId: string, twinId: string): Promise<TwinFreshnessInfo | null> {
    const allTwins = await this.freshnessStorage.getActiveTwins(orgId);
    const twin = allTwins.find((t) => t.id === twinId);
    if (!twin) {
      return null;
    }

    const now = new Date();
    const [lastStateUpdate, lastResidualUpdate] = await Promise.all([
      this.freshnessStorage.getLatestStateTimestamp(orgId, twinId),
      this.freshnessStorage.getLatestResidualTimestamp(orgId, twinId),
    ]);

    const latestUpdate = this.getLatestTimestamp(lastStateUpdate, lastResidualUpdate);
    const staleSinceMinutes = latestUpdate
      ? Math.round((now.getTime() - latestUpdate.getTime()) / 60000)
      : null;
    const isStale = staleSinceMinutes === null || staleSinceMinutes > STALE_THRESHOLD_MINUTES;

    return {
      twinId: twin.id,
      twinName: twin.name,
      equipmentId: twin.equipmentId,
      status: twin.status,
      lastStateUpdate,
      lastResidualUpdate,
      isStale,
      staleSinceMinutes,
    };
  }

  private getLatestTimestamp(a: Date | null, b: Date | null): Date | null {
    if (!a && !b) {
      return null;
    }
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    return a.getTime() > b.getTime() ? a : b;
  }
}
