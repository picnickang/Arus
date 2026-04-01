import { v4 as uuidv4 } from "uuid";

export interface DomainEventEnvelope<T extends string = string, P = unknown> {
  eventId: string;
  eventType: T;
  occurredAt: Date;
  orgId: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  aggregateId?: string;
  aggregateType?: string;
  payload: P;
}

export interface PdmRulUpdatedPayload {
  vesselId: string;
  equipmentId: string;
  remainingDays: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  operatingMode?: string;
}

export interface PdmAnomalyCreatedPayload {
  vesselId: string;
  equipmentId: string;
  severity: "low" | "medium" | "high" | "critical";
  anomalyType: string;
  window?: { start: Date; end: Date };
}

export interface PdmMaintenanceWindowPayload {
  vesselId: string;
  equipmentId: string;
  start: Date;
  end: Date;
  priority: string;
}

export interface SchedulerRunStartedPayload {
  runId: string;
  trigger: string;
  triggerContext?: Record<string, unknown>;
}

export interface SchedulerRunCompletedPayload {
  runId: string;
  assigned: number;
  unfilled: number;
  objectiveValue?: number;
}

export interface SchedulerRunFailedPayload {
  runId: string;
  error: string;
}

export interface SimulationPreviewCreatedPayload {
  previewId: string;
  proposedCount: number;
  unfilledCount: number;
  complianceRate: number;
  strategy: string;
  dateRange: { start: string; end: string };
}

export interface SimulationCommittedPayload {
  previewId: string;
  runId: string;
  assignmentsCommitted: number;
  selectedOnly: boolean;
}

export interface SimulationDiscardedPayload {
  previewId: string;
  reason: string;
}

export interface WorkOrderCreatedPayload {
  workOrderId: string;
  vesselId?: string;
  equipmentId?: string;
  priority: string;
}

export interface WorkOrderUpdatedPayload {
  workOrderId: string;
  changes: Record<string, unknown>;
}

export interface WorkOrderStatusChangedPayload {
  workOrderId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
}

export interface WorkOrderCompletedPayload {
  workOrderId: string;
  completedBy?: string;
  actualHours?: number;
  completionNotes?: string;
}

export interface WorkOrderAssignedPayload {
  workOrderId: string;
  assigneeId: string;
  assignedBy?: string;
}

export interface WorkOrderPartAddedPayload {
  workOrderId: string;
  partId: string;
  quantity: number;
}

export interface WorkOrderTaskCompletedPayload {
  workOrderId: string;
  taskId: string;
  completedBy?: string;
}

export interface InventoryPartCreatedPayload {
  partNo: string;
  description: string;
  category: string | null;
  manufacturer: string | null;
}

export interface InventoryPartUpdatedPayload {
  changedFields: string[];
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
}

export interface InventoryPartDeletedPayload {
  partNo: string;
  description: string;
}

export interface InventoryItemCreatedPayload {
  partNo: string;
  name: string;
  quantity: number;
  minQuantity: number;
  location: string | null;
}

export interface InventoryItemUpdatedPayload {
  changedFields: string[];
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
}

export interface InventoryItemDeletedPayload {
  partNo: string;
  name: string;
}

export interface InventoryStockMovementPayload {
  inventoryId: string;
  movementType: "in" | "out" | "adjustment" | "transfer";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
}

export interface InventoryLowStockPayload {
  partNo: string;
  currentQuantity: number;
  minQuantity: number;
  threshold: number;
}

export interface InventoryStockReplenishedPayload {
  partNo: string;
  previousQuantity: number;
  newQuantity: number;
  minQuantity: number;
}

export interface CrewMemberCreatedPayload {
  crewMemberId: string;
  vesselId?: string;
}

export interface CrewMemberUpdatedPayload {
  crewMemberId: string;
  changes: Record<string, unknown>;
}

export interface CrewMemberDeletedPayload {
  crewMemberId: string;
}

export interface CrewAssignedPayload {
  crewMemberId: string;
  vesselId: string;
  assignmentId: string;
  startDate: Date;
  endDate?: Date;
}

export interface CrewUnassignedPayload {
  crewMemberId: string;
  vesselId: string;
  assignmentId: string;
}

export interface CrewLeaveRequestedPayload {
  crewMemberId: string;
  leaveId: string;
  startDate: Date;
  endDate: Date;
  leaveType: string;
}

export interface CrewLeaveApprovedPayload {
  crewMemberId: string;
  leaveId: string;
  approvedBy: string;
}

export interface CrewCertificationExpiringPayload {
  crewMemberId: string;
  certificationId: string;
  expiryDate: Date;
  daysRemaining: number;
}

export interface MaintenanceScheduledPayload {
  equipmentId: string;
  scheduledDate: Date;
  maintenanceType: string;
  priority: string;
  estimatedDuration: number;
  triggeredBy: "manual" | "pdm" | "interval" | "condition";
}

export interface MaintenanceCompletedPayload {
  equipmentId: string;
  completedAt: Date;
  actualDuration: number;
  findings: string[];
  nextScheduledDate?: Date;
}

export interface PredictionThresholdExceededPayload {
  predictionId: number;
  equipmentId: string;
  failureProbability: number;
  failureMode: string;
  riskLevel: string;
  modelId?: string | null;
  predictedFailureDate?: string | null;
}

export interface AgentSignalDispatchedPayload {
  signalType: string;
  equipmentId: string;
  predictionId: number;
  failureProbability: number;
}

export interface AlertTriggeredPayload {
  alertType: string;
  severity: "info" | "warning" | "error" | "critical";
  source: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface ComplianceViolationPayload {
  ruleId: string;
  ruleName: string;
  severity: "minor" | "major" | "critical";
  entityType: string;
  entityId: string;
  details: string;
}

export interface TelemetryAnomalyDetectedPayload {
  equipmentId: string;
  sensorId: string;
  anomalyType: string;
  severity: "low" | "medium" | "high" | "critical";
  value: number;
  threshold: number;
  detectedAt: Date;
}

export interface TelemetryBatchIngestedPayload {
  equipmentId: string;
  readingCount: number;
  startTime: Date;
  endTime: Date;
  source: string;
}

export interface DomainEventMap {
  "pdm.rul.updated": DomainEventEnvelope<"pdm.rul.updated", PdmRulUpdatedPayload>;
  "pdm.anomaly.created": DomainEventEnvelope<"pdm.anomaly.created", PdmAnomalyCreatedPayload>;
  "pdm.maintenance.window": DomainEventEnvelope<"pdm.maintenance.window", PdmMaintenanceWindowPayload>;

  "scheduler.run.started": DomainEventEnvelope<"scheduler.run.started", SchedulerRunStartedPayload>;
  "scheduler.run.completed": DomainEventEnvelope<"scheduler.run.completed", SchedulerRunCompletedPayload>;
  "scheduler.run.failed": DomainEventEnvelope<"scheduler.run.failed", SchedulerRunFailedPayload>;

  "simulation.preview.created": DomainEventEnvelope<"simulation.preview.created", SimulationPreviewCreatedPayload>;
  "simulation.committed": DomainEventEnvelope<"simulation.committed", SimulationCommittedPayload>;
  "simulation.discarded": DomainEventEnvelope<"simulation.discarded", SimulationDiscardedPayload>;

  "work_order.created": DomainEventEnvelope<"work_order.created", WorkOrderCreatedPayload>;
  "work_order.updated": DomainEventEnvelope<"work_order.updated", WorkOrderUpdatedPayload>;
  "work_order.status_changed": DomainEventEnvelope<"work_order.status_changed", WorkOrderStatusChangedPayload>;
  "work_order.completed": DomainEventEnvelope<"work_order.completed", WorkOrderCompletedPayload>;
  "work_order.assigned": DomainEventEnvelope<"work_order.assigned", WorkOrderAssignedPayload>;
  "work_order.part_added": DomainEventEnvelope<"work_order.part_added", WorkOrderPartAddedPayload>;
  "work_order.task_completed": DomainEventEnvelope<"work_order.task_completed", WorkOrderTaskCompletedPayload>;

  "inventory.part_created": DomainEventEnvelope<"inventory.part_created", InventoryPartCreatedPayload>;
  "inventory.part_updated": DomainEventEnvelope<"inventory.part_updated", InventoryPartUpdatedPayload>;
  "inventory.part_deleted": DomainEventEnvelope<"inventory.part_deleted", InventoryPartDeletedPayload>;
  "inventory.item_created": DomainEventEnvelope<"inventory.item_created", InventoryItemCreatedPayload>;
  "inventory.item_updated": DomainEventEnvelope<"inventory.item_updated", InventoryItemUpdatedPayload>;
  "inventory.item_deleted": DomainEventEnvelope<"inventory.item_deleted", InventoryItemDeletedPayload>;
  "inventory.stock_movement": DomainEventEnvelope<"inventory.stock_movement", InventoryStockMovementPayload>;
  "inventory.low_stock": DomainEventEnvelope<"inventory.low_stock", InventoryLowStockPayload>;
  "inventory.stock_replenished": DomainEventEnvelope<"inventory.stock_replenished", InventoryStockReplenishedPayload>;

  "crew.member_created": DomainEventEnvelope<"crew.member_created", CrewMemberCreatedPayload>;
  "crew.member_updated": DomainEventEnvelope<"crew.member_updated", CrewMemberUpdatedPayload>;
  "crew.member_deleted": DomainEventEnvelope<"crew.member_deleted", CrewMemberDeletedPayload>;
  "crew.assigned": DomainEventEnvelope<"crew.assigned", CrewAssignedPayload>;
  "crew.unassigned": DomainEventEnvelope<"crew.unassigned", CrewUnassignedPayload>;
  "crew.leave_requested": DomainEventEnvelope<"crew.leave_requested", CrewLeaveRequestedPayload>;
  "crew.leave_approved": DomainEventEnvelope<"crew.leave_approved", CrewLeaveApprovedPayload>;
  "crew.certification_expiring": DomainEventEnvelope<"crew.certification_expiring", CrewCertificationExpiringPayload>;

  "maintenance.scheduled": DomainEventEnvelope<"maintenance.scheduled", MaintenanceScheduledPayload>;
  "maintenance.completed": DomainEventEnvelope<"maintenance.completed", MaintenanceCompletedPayload>;

  "prediction.threshold_exceeded": DomainEventEnvelope<"prediction.threshold_exceeded", PredictionThresholdExceededPayload>;
  "agent.signal_dispatched": DomainEventEnvelope<"agent.signal_dispatched", AgentSignalDispatchedPayload>;

  "alert.triggered": DomainEventEnvelope<"alert.triggered", AlertTriggeredPayload>;
  "compliance.violation_detected": DomainEventEnvelope<"compliance.violation_detected", ComplianceViolationPayload>;

  "telemetry.anomaly_detected": DomainEventEnvelope<"telemetry.anomaly_detected", TelemetryAnomalyDetectedPayload>;
  "telemetry.batch_ingested": DomainEventEnvelope<"telemetry.batch_ingested", TelemetryBatchIngestedPayload>;
}

export type DomainEventName = keyof DomainEventMap;

export function createDomainEvent<K extends DomainEventName>(
  eventType: K,
  orgId: string,
  payload: DomainEventMap[K]["payload"],
  options?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    aggregateId?: string;
    aggregateType?: string;
  },
): DomainEventMap[K] {
  return {
    eventId: uuidv4(),
    eventType,
    occurredAt: new Date(),
    orgId,
    payload,
    ...options,
  } as DomainEventMap[K];
}
