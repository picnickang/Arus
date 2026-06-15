import type { DomainEventEnvelope } from "./envelope";
import type {
  PdmRulUpdatedPayload,
  PdmAnomalyCreatedPayload,
  PdmMaintenanceWindowPayload,
  SchedulerRunStartedPayload,
  SchedulerRunCompletedPayload,
  SchedulerRunFailedPayload,
  SimulationPreviewCreatedPayload,
  SimulationCommittedPayload,
  SimulationDiscardedPayload,
  WorkOrderCreatedPayload,
  WorkOrderUpdatedPayload,
  WorkOrderStatusChangedPayload,
  WorkOrderCompletedPayload,
  WorkOrderAssignedPayload,
  WorkOrderPartAddedPayload,
  WorkOrderTaskCompletedPayload,
  InventoryPartCreatedPayload,
  InventoryPartUpdatedPayload,
  InventoryPartDeletedPayload,
  InventoryItemCreatedPayload,
  InventoryItemUpdatedPayload,
  InventoryItemDeletedPayload,
  InventoryStockMovementPayload,
  InventoryLowStockPayload,
  InventoryStockReplenishedPayload,
  CrewMemberCreatedPayload,
  CrewMemberUpdatedPayload,
  CrewMemberDeletedPayload,
  CrewAssignedPayload,
  CrewUnassignedPayload,
  CrewLeaveRequestedPayload,
  CrewLeaveApprovedPayload,
  CrewCertificationExpiringPayload,
  MaintenanceScheduledPayload,
  MaintenanceUpdatedPayload,
  MaintenanceDeletedPayload,
  MaintenanceCompletedPayload,
  MaintenanceOverduePayload,
  MaintenanceAutoScheduledPayload,
  MaintenanceTemplateCreatedPayload,
  MaintenanceTemplateUpdatedPayload,
  MaintenanceTemplateDeletedPayload,
  PredictionThresholdExceededPayload,
  AgentSignalDispatchedPayload,
  AlertTriggeredPayload,
  ComplianceViolationPayload,
  TelemetryAnomalyDetectedPayload,
  TelemetryBatchIngestedPayload,
  BunkeringStartedPayload,
  BunkeringCompletedPayload,
  RmsAlertTriggeredPayload,
  ServiceRequestCreatedPayload,
  ServiceRequestApprovedPayload,
  ServiceRequestRejectedPayload,
  ServiceRequestConvertedPayload,
} from "./payloads";

export interface DomainEventMap {
  "pdm.rul.updated": DomainEventEnvelope<"pdm.rul.updated", PdmRulUpdatedPayload>;
  "pdm.anomaly.created": DomainEventEnvelope<"pdm.anomaly.created", PdmAnomalyCreatedPayload>;
  "pdm.maintenance.window": DomainEventEnvelope<
    "pdm.maintenance.window",
    PdmMaintenanceWindowPayload
  >;

  "scheduler.run.started": DomainEventEnvelope<"scheduler.run.started", SchedulerRunStartedPayload>;
  "scheduler.run.completed": DomainEventEnvelope<
    "scheduler.run.completed",
    SchedulerRunCompletedPayload
  >;
  "scheduler.run.failed": DomainEventEnvelope<"scheduler.run.failed", SchedulerRunFailedPayload>;

  "simulation.preview.created": DomainEventEnvelope<
    "simulation.preview.created",
    SimulationPreviewCreatedPayload
  >;
  "simulation.committed": DomainEventEnvelope<"simulation.committed", SimulationCommittedPayload>;
  "simulation.discarded": DomainEventEnvelope<"simulation.discarded", SimulationDiscardedPayload>;

  "work_order.created": DomainEventEnvelope<"work_order.created", WorkOrderCreatedPayload>;
  "work_order.updated": DomainEventEnvelope<"work_order.updated", WorkOrderUpdatedPayload>;
  "work_order.status_changed": DomainEventEnvelope<
    "work_order.status_changed",
    WorkOrderStatusChangedPayload
  >;
  "work_order.completed": DomainEventEnvelope<"work_order.completed", WorkOrderCompletedPayload>;
  "work_order.assigned": DomainEventEnvelope<"work_order.assigned", WorkOrderAssignedPayload>;
  "work_order.part_added": DomainEventEnvelope<"work_order.part_added", WorkOrderPartAddedPayload>;
  "work_order.task_completed": DomainEventEnvelope<
    "work_order.task_completed",
    WorkOrderTaskCompletedPayload
  >;

  "inventory.part_created": DomainEventEnvelope<
    "inventory.part_created",
    InventoryPartCreatedPayload
  >;
  "inventory.part_updated": DomainEventEnvelope<
    "inventory.part_updated",
    InventoryPartUpdatedPayload
  >;
  "inventory.part_deleted": DomainEventEnvelope<
    "inventory.part_deleted",
    InventoryPartDeletedPayload
  >;
  "inventory.item_created": DomainEventEnvelope<
    "inventory.item_created",
    InventoryItemCreatedPayload
  >;
  "inventory.item_updated": DomainEventEnvelope<
    "inventory.item_updated",
    InventoryItemUpdatedPayload
  >;
  "inventory.item_deleted": DomainEventEnvelope<
    "inventory.item_deleted",
    InventoryItemDeletedPayload
  >;
  "inventory.stock_movement": DomainEventEnvelope<
    "inventory.stock_movement",
    InventoryStockMovementPayload
  >;
  "inventory.low_stock": DomainEventEnvelope<"inventory.low_stock", InventoryLowStockPayload>;
  "inventory.stock_replenished": DomainEventEnvelope<
    "inventory.stock_replenished",
    InventoryStockReplenishedPayload
  >;

  "crew.member_created": DomainEventEnvelope<"crew.member_created", CrewMemberCreatedPayload>;
  "crew.member_updated": DomainEventEnvelope<"crew.member_updated", CrewMemberUpdatedPayload>;
  "crew.member_deleted": DomainEventEnvelope<"crew.member_deleted", CrewMemberDeletedPayload>;
  "crew.assigned": DomainEventEnvelope<"crew.assigned", CrewAssignedPayload>;
  "crew.unassigned": DomainEventEnvelope<"crew.unassigned", CrewUnassignedPayload>;
  "crew.leave_requested": DomainEventEnvelope<"crew.leave_requested", CrewLeaveRequestedPayload>;
  "crew.leave_approved": DomainEventEnvelope<"crew.leave_approved", CrewLeaveApprovedPayload>;
  "crew.certification_expiring": DomainEventEnvelope<
    "crew.certification_expiring",
    CrewCertificationExpiringPayload
  >;

  "maintenance.scheduled": DomainEventEnvelope<
    "maintenance.scheduled",
    MaintenanceScheduledPayload
  >;
  "maintenance.updated": DomainEventEnvelope<"maintenance.updated", MaintenanceUpdatedPayload>;
  "maintenance.deleted": DomainEventEnvelope<"maintenance.deleted", MaintenanceDeletedPayload>;
  "maintenance.completed": DomainEventEnvelope<
    "maintenance.completed",
    MaintenanceCompletedPayload
  >;
  "maintenance.overdue": DomainEventEnvelope<"maintenance.overdue", MaintenanceOverduePayload>;
  "maintenance.auto_scheduled": DomainEventEnvelope<
    "maintenance.auto_scheduled",
    MaintenanceAutoScheduledPayload
  >;
  "maintenance.template_created": DomainEventEnvelope<
    "maintenance.template_created",
    MaintenanceTemplateCreatedPayload
  >;
  "maintenance.template_updated": DomainEventEnvelope<
    "maintenance.template_updated",
    MaintenanceTemplateUpdatedPayload
  >;
  "maintenance.template_deleted": DomainEventEnvelope<
    "maintenance.template_deleted",
    MaintenanceTemplateDeletedPayload
  >;

  "prediction.threshold_exceeded": DomainEventEnvelope<
    "prediction.threshold_exceeded",
    PredictionThresholdExceededPayload
  >;
  "agent.signal_dispatched": DomainEventEnvelope<
    "agent.signal_dispatched",
    AgentSignalDispatchedPayload
  >;

  "alert.triggered": DomainEventEnvelope<"alert.triggered", AlertTriggeredPayload>;
  "compliance.violation_detected": DomainEventEnvelope<
    "compliance.violation_detected",
    ComplianceViolationPayload
  >;

  "telemetry.anomaly_detected": DomainEventEnvelope<
    "telemetry.anomaly_detected",
    TelemetryAnomalyDetectedPayload
  >;
  "telemetry.batch_ingested": DomainEventEnvelope<
    "telemetry.batch_ingested",
    TelemetryBatchIngestedPayload
  >;

  "bunkering.started": DomainEventEnvelope<"bunkering.started", BunkeringStartedPayload>;
  "bunkering.completed": DomainEventEnvelope<"bunkering.completed", BunkeringCompletedPayload>;
  "rms.alert_triggered": DomainEventEnvelope<"rms.alert_triggered", RmsAlertTriggeredPayload>;

  "service_request.created": DomainEventEnvelope<
    "service_request.created",
    ServiceRequestCreatedPayload
  >;
  "service_request.approved": DomainEventEnvelope<
    "service_request.approved",
    ServiceRequestApprovedPayload
  >;
  "service_request.rejected": DomainEventEnvelope<
    "service_request.rejected",
    ServiceRequestRejectedPayload
  >;
  "service_request.converted": DomainEventEnvelope<
    "service_request.converted",
    ServiceRequestConvertedPayload
  >;
}

export type DomainEventName = keyof DomainEventMap;
