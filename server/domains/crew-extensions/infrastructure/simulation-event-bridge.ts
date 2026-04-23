import { domainEventBus } from "../../../lib/domain-event-bus/index.js";
import type { TelemetryWebSocketServer } from "../../../websocket.js";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("Domains:CrewExtensions:Infrastructure:SimulationEventBridge");

let wsServer: TelemetryWebSocketServer | null = null;
let bridgeInitialized = false;

export function setWebSocketServer(server: TelemetryWebSocketServer): void {
  wsServer = server;
  logger.info("[SimulationEventBridge] WebSocket server registered");
}

export function setupSimulationEventBridge(): void {
  if (bridgeInitialized) {
    logger.info("[SimulationEventBridge] Bridge already initialized, skipping duplicate setup");
    return;
  }
  bridgeInitialized = true;

  domainEventBus.on("simulation.preview.created", (event) => {
    if (!wsServer) {
      logger.warn("[SimulationEventBridge] No WebSocket server registered, skipping preview_created broadcast");
      return;
    }
    const { previewId, proposedCount, unfilledCount, complianceRate, strategy, dateRange } =
      event.payload;
    wsServer.broadcastScheduleSimulation("preview_created", {
      previewId,
      orgId: event.orgId,
      proposedCount,
      unfilledCount,
      complianceRate,
      strategy,
      dateRange,
    });
  });

  domainEventBus.on("simulation.committed", (event) => {
    if (!wsServer) {
      logger.warn("[SimulationEventBridge] No WebSocket server registered, skipping committed broadcast");
      return;
    }
    const { previewId, runId, assignmentsCommitted, selectedOnly } = event.payload;
    wsServer.broadcastScheduleSimulation("committed", {
      previewId,
      runId,
      orgId: event.orgId,
      assignmentsCommitted,
      selectedOnly,
    });
    wsServer.broadcastSchedulePlannerUpdate("refresh", {
      orgId: event.orgId,
      runId,
      reason: "simulation_committed",
    });
  });

  domainEventBus.on("simulation.discarded", (event) => {
    if (!wsServer) {
      logger.warn("[SimulationEventBridge] No WebSocket server registered, skipping discarded broadcast");
      return;
    }
    const { previewId, reason } = event.payload;
    wsServer.broadcastScheduleSimulation("discarded", {
      previewId,
      orgId: event.orgId,
      reason,
    });
  });

  domainEventBus.on("scheduler.run.completed", (event) => {
    if (!wsServer) {
      return;
    }
    const { runId } = event.payload;
    wsServer.broadcastSchedulePlannerUpdate("refresh", {
      orgId: event.orgId,
      runId,
      reason: "scheduler_run_completed",
    });
  });

  logger.info("[SimulationEventBridge] Event listeners registered (unified bus)");
}
