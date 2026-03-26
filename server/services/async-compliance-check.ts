import { logger } from "../utils/logger";

const LOG_CTX = "AsyncComplianceCheck";

interface PendingCheck {
  orgId: string;
  vesselId: string;
  logDate: string;
  logType: string;
  requestedAt: number;
  timeoutHandle: NodeJS.Timeout;
}

class AsyncComplianceCheckService {
  private pendingChecks = new Map<string, PendingCheck>();
  private debounceMs = 30 * 1000;
  private wsServer: any = null;

  setWsServer(ws: any): void {
    this.wsServer = ws;
  }

  scheduleCheck(orgId: string, vesselId: string, logDate: string, logType: string): string {
    const key = `${orgId}:${vesselId}:${logDate}:${logType}`;

    const existing = this.pendingChecks.get(key);
    if (existing) {
      clearTimeout(existing.timeoutHandle);
    }

    const timeoutHandle = setTimeout(() => {
      this.executeCheck(key, orgId, vesselId, logDate, logType);
    }, this.debounceMs);

    this.pendingChecks.set(key, {
      orgId,
      vesselId,
      logDate,
      logType,
      requestedAt: Date.now(),
      timeoutHandle,
    });

    return key;
  }

  private async executeCheck(
    key: string,
    orgId: string,
    vesselId: string,
    logDate: string,
    logType: string
  ): Promise<void> {
    this.pendingChecks.delete(key);

    try {
      const { complianceRulesEngine } = await import("../services/compliance-rules-engine");

      const result = await complianceRulesEngine.runComplianceCheck({
        orgId,
        vesselId,
        logDate,
        logType,
      });

      logger.info(LOG_CTX, `Compliance check completed: ${result.newFindings.length} new findings`, {
        key, orgId, vesselId,
      });

      if (this.wsServer) {
        this.wsServer.broadcast?.({
          type: "compliance_check_complete",
          orgId,
          vesselId,
          logDate,
          logType,
          newFindings: result.newFindings.length,
          autoResolved: result.autoResolved.length,
          stillOpen: result.stillOpen.length,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error(LOG_CTX, `Compliance check failed for ${key}`, error);
    }
  }

  getPendingCount(): number {
    return this.pendingChecks.size;
  }
}

export const asyncComplianceCheck = new AsyncComplianceCheckService();
export default AsyncComplianceCheckService;
