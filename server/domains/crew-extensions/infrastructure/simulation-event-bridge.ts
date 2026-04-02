import { domainEventBus } from '../../../lib/domain-event-bus/index.js';
import type { TelemetryWebSocketServer } from '../../../websocket.js';

let wsServer: TelemetryWebSocketServer | null = null;
let bridgeInitialized = false;

export function setWebSocketServer(server: TelemetryWebSocketServer): void {
  wsServer = server;
  console.log('[SimulationEventBridge] WebSocket server registered');
}

export function setupSimulationEventBridge(): void {
  if (bridgeInitialized) {
    console.log('[SimulationEventBridge] Bridge already initialized, skipping duplicate setup');
    return;
  }
  bridgeInitialized = true;

  domainEventBus.on("simulation.preview.created", (event) => {
    if (!wsServer) {
      console.warn('[SimulationEventBridge] No WebSocket server registered, skipping preview_created broadcast');
      return;
    }
    const p = event.payload as {
      previewId: string; proposedCount: number; unfilledCount: number;
      complianceRate: number; strategy: string; dateRange: { start: string; end: string };
    };
    wsServer.broadcastScheduleSimulation('preview_created', {
      previewId: p.previewId,
      orgId: event.orgId,
      proposedCount: p.proposedCount,
      unfilledCount: p.unfilledCount,
      complianceRate: p.complianceRate,
      strategy: p.strategy,
      dateRange: p.dateRange,
    });
  });

  domainEventBus.on("simulation.committed", (event) => {
    if (!wsServer) {
      console.warn('[SimulationEventBridge] No WebSocket server registered, skipping committed broadcast');
      return;
    }
    const p = event.payload as {
      previewId: string; runId: string; assignmentsCommitted: number; selectedOnly: boolean;
    };
    wsServer.broadcastScheduleSimulation('committed', {
      previewId: p.previewId,
      runId: p.runId,
      orgId: event.orgId,
      assignmentsCommitted: p.assignmentsCommitted,
      selectedOnly: p.selectedOnly,
    });
    wsServer.broadcastSchedulePlannerUpdate('refresh', {
      orgId: event.orgId,
      runId: p.runId,
      reason: 'simulation_committed',
    });
  });

  domainEventBus.on("simulation.discarded", (event) => {
    if (!wsServer) {
      console.warn('[SimulationEventBridge] No WebSocket server registered, skipping discarded broadcast');
      return;
    }
    const p = event.payload as { previewId: string; reason: string };
    wsServer.broadcastScheduleSimulation('discarded', {
      previewId: p.previewId,
      orgId: event.orgId,
      reason: p.reason,
    });
  });

  domainEventBus.on("scheduler.run.completed", (event) => {
    if (!wsServer) {
      return;
    }
    const p = event.payload as { runId: string };
    wsServer.broadcastSchedulePlannerUpdate('refresh', {
      orgId: event.orgId,
      runId: p.runId,
      reason: 'scheduler_run_completed',
    });
  });

  console.log('[SimulationEventBridge] Event listeners registered (unified bus)');
}
