export interface PdmRulUpdatedPayload {
  vesselId: string;
  equipmentId: string;
  remainingDays: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  operatingMode?: string | undefined;
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
  objectiveValue?: number | undefined;
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
  vesselId?: string | undefined;
  equipmentId?: string | undefined;
  priority: string;
}

/**
 * Optional metadata attached to `work_order.updated` / `work_order.status_changed`
 * when the change is an assigned crew member accepting or declining the work.
 * Carrying it on the already-emitted event lets a downstream subscriber notify
 * supervisors without adding a new write path or re-fetching the work order.
 */
export interface WorkOrderAssignmentResponsePayload {
  response: "accepted" | "declined";
  crewId: string;
  crewName?: string | undefined;
  reason?: string | null | undefined;
  equipmentId: string;
  woNumber?: string | null | undefined;
}

export interface WorkOrderUpdatedPayload {
  workOrderId: string;
  changes: Record<string, unknown>;
  assignmentResponse?: WorkOrderAssignmentResponsePayload | undefined;
}

export interface WorkOrderStatusChangedPayload {
  workOrderId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string | undefined;
  assignmentResponse?: WorkOrderAssignmentResponsePayload | undefined;
}

export interface WorkOrderCompletedPayload {
  workOrderId: string;
  completedBy?: string | undefined;
  actualHours?: number | undefined;
  completionNotes?: string | undefined;
}

export interface WorkOrderAssignedPayload {
  workOrderId: string;
  assigneeId: string;
  assignedBy?: string | undefined;
}

export interface WorkOrderPartAddedPayload {
  workOrderId: string;
  partId: string;
  quantity: number;
}

export interface WorkOrderTaskCompletedPayload {
  workOrderId: string;
  taskId: string;
  completedBy?: string | undefined;
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
  vesselId?: string | undefined;
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
  endDate?: Date | undefined;
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
  estimatedDuration?: number | undefined;
  triggeredBy?: "manual" | "pdm" | "interval" | "condition";
  autoGenerated?: boolean | undefined;
  pdmScore?: number | undefined;
}

export interface MaintenanceUpdatedPayload {
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  changedFields: string[];
}

export interface MaintenanceDeletedPayload {
  equipmentId: string;
  scheduledDate: Date;
  reason?: string | undefined;
}

export interface MaintenanceCompletedPayload {
  equipmentId: string;
  completedAt: Date;
  completedBy?: string | undefined;
  actualDuration?: number | undefined;
  findings?: string[] | undefined;
  notes?: string | undefined;
  scheduledDate?: Date | undefined;
}

export interface MaintenanceOverduePayload {
  equipmentId: string;
  scheduledDate: Date;
  daysOverdue: number;
}

export interface MaintenanceAutoScheduledPayload {
  equipmentId: string;
  scheduledDate: Date;
  pdmScore: number;
  triggerSource: "pdm_prediction" | "rul_threshold" | "anomaly_detection";
  modelId?: string | undefined;
  modelVersion?: string | undefined;
}

export interface MaintenanceTemplateCreatedPayload {
  name: string;
  equipmentType?: string | undefined;
  maintenanceType: string;
}

export interface MaintenanceTemplateUpdatedPayload {
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  changedFields: string[];
}

export interface MaintenanceTemplateDeletedPayload {
  name: string;
  equipmentType?: string | undefined;
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

export interface BunkeringStartedPayload {
  eventId: string;
  vesselId: string;
  flowKgPerH: number;
  startedAt: Date;
}

export interface BunkeringCompletedPayload {
  eventId: string;
  vesselId: string;
  volumeKg: number;
  volumeLitres: number;
  durationHours: number;
  avgFlowKgPerH: number;
  peakFlowKgPerH: number;
  startedAt: Date;
  endedAt: Date;
}

export interface RmsAlertTriggeredPayload {
  alertLogId: string;
  configId?: string | undefined;
  vesselId: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
}

export interface ServiceRequestCreatedPayload {
  serviceRequestId: string;
  requestNumber: string;
  workOrderId: string;
  title: string;
  urgency: string;
  requestedBy: string;
}

export interface ServiceRequestApprovedPayload {
  serviceRequestId: string;
  requestNumber: string;
  workOrderId: string;
  approvedBy: string;
}

export interface ServiceRequestRejectedPayload {
  serviceRequestId: string;
  requestNumber: string;
  workOrderId: string;
  rejectedBy: string;
  reason?: string | undefined;
}

export interface ServiceRequestConvertedPayload {
  serviceRequestId: string;
  requestNumber: string;
  workOrderId: string;
  serviceOrderId: string;
  soNumber: string;
  convertedBy: string;
}
