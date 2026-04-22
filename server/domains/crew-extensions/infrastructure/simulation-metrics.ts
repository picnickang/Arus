/**
 * Schedule Simulation - Prometheus Metrics
 * Observability metrics for SIMULATE mode operations
 */

import client from "prom-client";

export const simulationLatency = new client.Histogram({
  name: "arus_schedule_simulation_latency_seconds",
  help: "Latency of schedule simulation operations in seconds",
  labelNames: ["org_id", "operation", "strategy"],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
});

export const simulationPreviewsActive = new client.Gauge({
  name: "arus_schedule_simulation_previews_active",
  help: "Current number of active simulation previews",
  labelNames: ["org_id"],
});

export const simulationPreviewsCreated = new client.Counter({
  name: "arus_schedule_simulation_previews_created_total",
  help: "Total number of simulation previews created",
  labelNames: ["org_id", "strategy"],
});

export const simulationPreviewsCommitted = new client.Counter({
  name: "arus_schedule_simulation_previews_committed_total",
  help: "Total number of simulation previews committed to database",
  labelNames: ["org_id"],
});

export const simulationPreviewsDiscarded = new client.Counter({
  name: "arus_schedule_simulation_previews_discarded_total",
  help: "Total number of simulation previews discarded",
  labelNames: ["org_id", "reason"],
});

export const simulationAssignmentsProposed = new client.Gauge({
  name: "arus_schedule_simulation_assignments_proposed",
  help: "Number of assignments in the current simulation preview",
  labelNames: ["org_id", "preview_id"],
});

export const simulationUnfilledShifts = new client.Gauge({
  name: "arus_schedule_simulation_unfilled_shifts",
  help: "Number of unfilled shifts in the current simulation preview",
  labelNames: ["org_id", "preview_id"],
});

export const simulationComplianceRate = new client.Gauge({
  name: "arus_schedule_simulation_compliance_rate",
  help: "Compliance rate of the current simulation preview (0-100)",
  labelNames: ["org_id", "preview_id"],
});

export const simulationViolations = new client.Gauge({
  name: "arus_schedule_simulation_violations",
  help: "Number of violations detected in simulation preview",
  labelNames: ["org_id", "preview_id", "violation_type"],
});

export const simulationWebSocketBroadcasts = new client.Counter({
  name: "arus_schedule_simulation_websocket_broadcasts_total",
  help: "Total number of WebSocket broadcasts for simulation events",
  labelNames: ["event_type"],
});

export function recordSimulationOperation(
  orgId: string,
  operation: "simulate" | "commit" | "discard" | "preview",
  strategy: string,
  durationMs: number
): void {
  simulationLatency.observe({ org_id: orgId, operation, strategy }, durationMs / 1000);
}

export function recordSimulationCreated(
  orgId: string,
  strategy: string,
  previewId: string,
  proposedCount: number,
  unfilledCount: number,
  complianceRate: number
): void {
  simulationPreviewsCreated.inc({ org_id: orgId, strategy });
  simulationPreviewsActive.inc({ org_id: orgId });
  simulationAssignmentsProposed.set({ org_id: orgId, preview_id: previewId }, proposedCount);
  simulationUnfilledShifts.set({ org_id: orgId, preview_id: previewId }, unfilledCount);
  simulationComplianceRate.set({ org_id: orgId, preview_id: previewId }, complianceRate);
}

export function recordSimulationCommitted(orgId: string, previewId: string): void {
  simulationPreviewsCommitted.inc({ org_id: orgId });
  simulationPreviewsActive.dec({ org_id: orgId });
  simulationAssignmentsProposed.set({ org_id: orgId, preview_id: previewId }, 0);
  simulationUnfilledShifts.set({ org_id: orgId, preview_id: previewId }, 0);
}

export function recordSimulationDiscarded(
  orgId: string,
  reason: "manual" | "expired" | "superseded",
  previewId: string
): void {
  simulationPreviewsDiscarded.inc({ org_id: orgId, reason });
  simulationPreviewsActive.dec({ org_id: orgId });
  simulationAssignmentsProposed.set({ org_id: orgId, preview_id: previewId }, 0);
  simulationUnfilledShifts.set({ org_id: orgId, preview_id: previewId }, 0);
}

export function recordWebSocketBroadcast(eventType: string): void {
  simulationWebSocketBroadcasts.inc({ event_type: eventType });
}
