import { Router } from "express";
import {
  getBridgeDeadLetterQueue,
  getBridgeCircuitBreaker,
  getBridgeState,
} from "../services/sqlite-bridge";
import { logger } from "../utils/logger";
import { withErrorHandling } from "../lib/route-utils";

export const telemetryDlqRouter = Router();

telemetryDlqRouter.get(
  "/status",
  withErrorHandling("get DLQ status", async (_req, res) => {
    const dlq = getBridgeDeadLetterQueue();
    const circuitBreaker = getBridgeCircuitBreaker();
    const bridgeState = getBridgeState();

    const dlqMetrics =
      "getMetricsAsync" in dlq ? await (dlq as any).getMetricsAsync() : dlq.getMetrics();

    res.json({
      dlq: dlqMetrics,
      circuitBreaker: {
        state: circuitBreaker.getState(),
        metrics: circuitBreaker.getMetrics(),
      },
      bridge: {
        isRunning: bridgeState.isRunning,
        pgOffline: bridgeState.pgOffline,
        lagFrames: bridgeState.lagFrames,
        lastSuccessAt: bridgeState.lastSuccessAt
          ? new Date(bridgeState.lastSuccessAt).toISOString()
          : null,
        retryBackoffMs: bridgeState.retryBackoffMs,
      },
    });
  })
);

telemetryDlqRouter.get(
  "/entries",
  withErrorHandling("list DLQ entries", async (req, res) => {
    const dlq = getBridgeDeadLetterQueue();
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const source = req.query.source as string | undefined;

    const entries =
      "listAsync" in dlq
        ? await (dlq as any).listAsync({ limit, offset, source })
        : dlq.list({ limit, offset, source });
    res.json({ entries, count: entries.length });
  })
);

telemetryDlqRouter.get(
  "/entries/:id",
  withErrorHandling("get DLQ entry", async (req, res) => {
    const dlq = getBridgeDeadLetterQueue();
    const entry =
      "getAsync" in dlq ? await (dlq as any).getAsync(req.params.id) : dlq.get(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    res.json(entry);
  })
);

telemetryDlqRouter.post(
  "/entries/:id/replay",
  withErrorHandling("replay DLQ entry", async (req, res) => {
    const dlq = getBridgeDeadLetterQueue();
    const circuitBreaker = getBridgeCircuitBreaker();

    if (circuitBreaker.isOpen()) {
      return res.status(503).json({
        success: false,
        message: "Circuit breaker is open - PostgreSQL unavailable",
        circuitState: circuitBreaker.getState(),
      });
    }

    const result = await dlq.replay(req.params.id);

    if (result.success) {
      logger.info("TelemetryDLQRoutes", "Entry replayed successfully", { entryId: req.params.id });
      res.json(result);
    } else {
      logger.warn("TelemetryDLQRoutes", "Entry replay failed", {
        entryId: req.params.id,
        error: result.error,
      });
      res.status(400).json(result);
    }
  })
);

telemetryDlqRouter.post(
  "/replay-all",
  withErrorHandling("replay all DLQ entries", async (req, res) => {
    const dlq = getBridgeDeadLetterQueue();
    const circuitBreaker = getBridgeCircuitBreaker();

    if (circuitBreaker.isOpen()) {
      return res.status(503).json({
        success: false,
        message: "Circuit breaker is open - PostgreSQL unavailable",
        circuitState: circuitBreaker.getState(),
      });
    }

    const limit = Number(req.query.limit) || 100;
    const source = req.query.source as string | undefined;

    const results = await dlq.replayAll({ limit, source });

    const successCount = results.filter((r: any) => r.success).length;
    const failureCount = results.filter((r: any) => !r.success).length;

    logger.info("TelemetryDLQRoutes", "Replay all completed", { successCount, failureCount });

    res.json({
      total: results.length,
      successCount,
      failureCount,
      results,
    });
  })
);

telemetryDlqRouter.delete(
  "/entries/:id",
  withErrorHandling("delete DLQ entry", async (req, res) => {
    const dlq = getBridgeDeadLetterQueue();
    const entry =
      "getAsync" in dlq ? await (dlq as any).getAsync(req.params.id) : dlq.get(req.params.id);

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if ("deleteAsync" in dlq) {
      await (dlq as any).deleteAsync(req.params.id);
    }

    res.json({ success: true, entryId: req.params.id, message: "Entry removed" });
  })
);

telemetryDlqRouter.post(
  "/prune",
  withErrorHandling("prune DLQ", async (_req, res) => {
    const dlq = getBridgeDeadLetterQueue();
    const removed = "pruneAsync" in dlq ? await (dlq as any).pruneAsync() : dlq.prune();

    logger.info("TelemetryDLQRoutes", "DLQ pruned", { removedCount: removed });
    res.json({ success: true, removed });
  })
);

logger.info(
  "TelemetryDLQRoutes",
  "Registered: GET/POST /status, /entries, /entries/:id, /replay-all, /prune"
);
