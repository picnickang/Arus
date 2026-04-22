import { EventEmitter } from "node:events";

export type SchedulerEventName =
  | "pdm.rul.updated"
  | "pdm.anomaly.created"
  | "pdm.maintenance.window"
  | "scheduler.run.started"
  | "scheduler.run.completed"
  | "scheduler.run.failed"
  | "simulation.preview.created"
  | "simulation.committed"
  | "simulation.discarded";

export interface RulUpdatedEvent {
  orgId: string;
  vesselId: string;
  equipmentId: string;
  remainingDays: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  operatingMode?: string;
}

export interface AnomalyCreatedEvent {
  orgId: string;
  vesselId: string;
  equipmentId: string;
  severity: "low" | "medium" | "high" | "critical";
  anomalyType: string;
  window?: { start: Date; end: Date };
}

export interface MaintenanceWindowEvent {
  orgId: string;
  vesselId: string;
  equipmentId: string;
  start: Date;
  end: Date;
  priority: string;
}

export interface SchedulerRunStartedEvent {
  orgId: string;
  runId: string;
  trigger: string;
  triggerContext?: any;
}

export interface SchedulerRunCompletedEvent {
  orgId: string;
  runId: string;
  assigned: number;
  unfilled: number;
  objectiveValue?: number;
}

export interface SchedulerRunFailedEvent {
  orgId: string;
  runId: string;
  error: string;
}

export interface SimulationPreviewCreatedEvent {
  orgId: string;
  previewId: string;
  proposedCount: number;
  unfilledCount: number;
  complianceRate: number;
  strategy: string;
  dateRange: { start: string; end: string };
}

export interface SimulationCommittedEvent {
  orgId: string;
  previewId: string;
  runId: string;
  assignmentsCommitted: number;
  selectedOnly: boolean;
}

export interface SimulationDiscardedEvent {
  orgId: string;
  previewId: string;
  reason: string;
}

class SchedulerEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitRulUpdate(event: RulUpdatedEvent): void {
    this.emit("pdm.rul.updated", event);
  }

  emitAnomalyCreated(event: AnomalyCreatedEvent): void {
    this.emit("pdm.anomaly.created", event);
  }

  emitMaintenanceWindow(event: MaintenanceWindowEvent): void {
    this.emit("pdm.maintenance.window", event);
  }

  emitSchedulerRunStarted(event: SchedulerRunStartedEvent): void {
    this.emit("scheduler.run.started", event);
  }

  emitSchedulerRunCompleted(event: SchedulerRunCompletedEvent): void {
    this.emit("scheduler.run.completed", event);
  }

  emitSchedulerRunFailed(event: SchedulerRunFailedEvent): void {
    this.emit("scheduler.run.failed", event);
  }

  onRulUpdate(handler: (event: RulUpdatedEvent) => Promise<void> | void): void {
    this.on("pdm.rul.updated", handler);
  }

  onAnomalyCreated(handler: (event: AnomalyCreatedEvent) => Promise<void> | void): void {
    this.on("pdm.anomaly.created", handler);
  }

  onMaintenanceWindow(handler: (event: MaintenanceWindowEvent) => Promise<void> | void): void {
    this.on("pdm.maintenance.window", handler);
  }

  onSchedulerRunStarted(handler: (event: SchedulerRunStartedEvent) => Promise<void> | void): void {
    this.on("scheduler.run.started", handler);
  }

  onSchedulerRunCompleted(
    handler: (event: SchedulerRunCompletedEvent) => Promise<void> | void
  ): void {
    this.on("scheduler.run.completed", handler);
  }

  onSchedulerRunFailed(handler: (event: SchedulerRunFailedEvent) => Promise<void> | void): void {
    this.on("scheduler.run.failed", handler);
  }

  emitSimulationPreviewCreated(event: SimulationPreviewCreatedEvent): void {
    this.emit("simulation.preview.created", event);
  }

  emitSimulationCommitted(event: SimulationCommittedEvent): void {
    this.emit("simulation.committed", event);
  }

  emitSimulationDiscarded(event: SimulationDiscardedEvent): void {
    this.emit("simulation.discarded", event);
  }

  onSimulationPreviewCreated(
    handler: (event: SimulationPreviewCreatedEvent) => Promise<void> | void
  ): void {
    this.on("simulation.preview.created", handler);
  }

  onSimulationCommitted(handler: (event: SimulationCommittedEvent) => Promise<void> | void): void {
    this.on("simulation.committed", handler);
  }

  onSimulationDiscarded(handler: (event: SimulationDiscardedEvent) => Promise<void> | void): void {
    this.on("simulation.discarded", handler);
  }
}

export const schedulerEventBus = new SchedulerEventBus();
