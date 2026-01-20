/**
 * Simulation Event Bridge
 * Connects domain events to WebSocket broadcasts for real-time UI updates
 */

import { schedulerEventBus } from '../../../events/scheduler-bus.js';
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
  schedulerEventBus.onSimulationPreviewCreated((event) => {
    if (!wsServer) {
      console.warn('[SimulationEventBridge] No WebSocket server registered, skipping preview_created broadcast');
      return;
    }
    wsServer.broadcastScheduleSimulation('preview_created', {
      previewId: event.previewId,
      orgId: event.orgId,
      proposedCount: event.proposedCount,
      unfilledCount: event.unfilledCount,
      complianceRate: event.complianceRate,
      strategy: event.strategy,
      dateRange: event.dateRange,
    });
  });

  schedulerEventBus.onSimulationCommitted((event) => {
    if (!wsServer) {
      console.warn('[SimulationEventBridge] No WebSocket server registered, skipping committed broadcast');
      return;
    }
    wsServer.broadcastScheduleSimulation('committed', {
      previewId: event.previewId,
      runId: event.runId,
      orgId: event.orgId,
      assignmentsCommitted: event.assignmentsCommitted,
      selectedOnly: event.selectedOnly,
    });
    wsServer.broadcastSchedulePlannerUpdate('refresh', {
      orgId: event.orgId,
      runId: event.runId,
      reason: 'simulation_committed',
    });
  });

  schedulerEventBus.onSimulationDiscarded((event) => {
    if (!wsServer) {
      console.warn('[SimulationEventBridge] No WebSocket server registered, skipping discarded broadcast');
      return;
    }
    wsServer.broadcastScheduleSimulation('discarded', {
      previewId: event.previewId,
      orgId: event.orgId,
      reason: event.reason,
    });
  });

  schedulerEventBus.onSchedulerRunCompleted((event) => {
    if (!wsServer) {
      return;
    }
    wsServer.broadcastSchedulePlannerUpdate('refresh', {
      orgId: event.orgId,
      runId: event.runId,
      reason: 'scheduler_run_completed',
    });
  });

  console.log('[SimulationEventBridge] Event listeners registered');
}
