import { dbAlertStorage } from "./repositories";
import type { BroadcastPayload, WebSocketClient } from "./websocket-types";

type BroadcastFn = (channel: string, data: BroadcastPayload, orgId?: string) => void;
type LogFn = (message: string) => void;

export class WebSocketBroadcasts {
  constructor(
    private readonly broadcast: BroadcastFn,
    private readonly log: LogFn
  ) {}

  async sendLatestAlerts(client: WebSocketClient): Promise<void> {
    try {
      const alerts = await dbAlertStorage.getAlertNotifications(false);
      client.ws.send(
        JSON.stringify({
          type: "alerts_initial",
          data: alerts,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      this.log(`Failed to send latest alerts to client ${client.id}: ${error}`);
    }
  }

  broadcastAlert(alert: BroadcastPayload & { message?: string }): void {
    this.broadcast("alerts", {
      type: "alert_new",
      data: alert,
      timestamp: new Date().toISOString(),
    });
    this.log(`Broadcasted new alert: ${alert.message ?? "unknown"}`);
  }

  broadcastAlertAcknowledged(alertId: string, acknowledgedBy: string): void {
    this.broadcast("alerts", {
      type: "alert_acknowledged",
      data: { alertId, acknowledgedBy },
      timestamp: new Date().toISOString(),
    });
    this.log(`Broadcasted alert acknowledgment: ${alertId}`);
  }

  broadcastDashboardUpdate(updateType: string, data: BroadcastPayload): void {
    this.broadcast("dashboard", {
      type: `dashboard_${updateType}`,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastDataChange(
    entity: string,
    operation: "create" | "update" | "delete",
    data: BroadcastPayload & { id?: string }
  ): void {
    const message = {
      type: "data_change",
      entity,
      operation,
      data,
      timestamp: new Date().toISOString(),
    };

    this.broadcast(`data:${entity}`, message);
    this.broadcast("data:all", message);
    this.log(`Broadcasted ${operation} for ${entity}: ${data.id || "N/A"}`);
  }

  broadcastWorkOrderChange(
    operation: "create" | "update" | "delete",
    workOrder: BroadcastPayload
  ): void {
    this.broadcastDataChange("work_orders", operation, workOrder);
  }

  broadcastEquipmentChange(
    operation: "create" | "update" | "delete",
    equipment: BroadcastPayload
  ): void {
    this.broadcastDataChange("equipment", operation, equipment);
  }

  broadcastVesselChange(operation: "create" | "update" | "delete", vessel: BroadcastPayload): void {
    this.broadcastDataChange("vessels", operation, vessel);
  }

  broadcastCrewChange(operation: "create" | "update" | "delete", crew: BroadcastPayload): void {
    this.broadcastDataChange("crew", operation, crew);
  }

  broadcastMaintenanceScheduleChange(
    operation: "create" | "update" | "delete",
    schedule: BroadcastPayload
  ): void {
    this.broadcastDataChange("maintenance_schedules", operation, schedule);
  }

  broadcastCrewAssignmentChange(
    operation: "create" | "update" | "delete",
    assignment: BroadcastPayload
  ): void {
    this.broadcastDataChange("crew_assignments", operation, assignment);
  }

  broadcastPartsChange(operation: "create" | "update" | "delete", part: BroadcastPayload): void {
    this.broadcastDataChange("parts", operation, part);
  }

  broadcastStockChange(operation: "create" | "update" | "delete", stock: BroadcastPayload): void {
    this.broadcastDataChange("stock", operation, stock);
  }

  broadcastUpdateNotification(updateNotification: {
    id: string;
    type:
      | "update_available"
      | "update_started"
      | "update_completed"
      | "update_failed"
      | "update_rollback";
    deviceId?: string;
    version?: string;
    previousVersion?: string;
    message: string;
    severity: "critical" | "warning" | "info";
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const eventTimestamp = updateNotification.timestamp || new Date().toISOString();
    this.broadcast("updates", {
      type: "update_notification",
      data: {
        ...updateNotification,
        timestamp: eventTimestamp,
      },
      timestamp: new Date().toISOString(),
    });
    this.log(
      `Broadcasted update notification: ${updateNotification.type} - ${updateNotification.message}`
    );
  }

  broadcastAlertSuppression(suppression: BroadcastPayload): void {
    this.broadcast("alerts", {
      type: "alert_suppression",
      data: suppression,
      timestamp: new Date().toISOString(),
    });
    this.log("Broadcasted alert suppression");
  }

  broadcastWorkOrderCreated(workOrder: BroadcastPayload): void {
    this.broadcastDataChange("work_orders", "create", workOrder);
  }

  broadcastScheduleSimulation(
    eventType: "preview_created" | "committed" | "discarded" | "expired",
    data: BroadcastPayload
  ): void {
    this.broadcast("schedule_simulation", {
      type: `simulation_${eventType}`,
      data,
      timestamp: new Date().toISOString(),
    });
    this.log(`Broadcasted schedule simulation event: ${eventType}`);
  }

  broadcastSchedulePlannerUpdate(
    updateType: "refresh" | "assignment_changed" | "violation_detected",
    data: BroadcastPayload
  ): void {
    this.broadcast("schedule_planner", {
      type: `planner_${updateType}`,
      data,
      timestamp: new Date().toISOString(),
    });
    this.log(`Broadcasted schedule planner update: ${updateType}`);
  }

  broadcastTelemetryImmediate(data: BroadcastPayload): void {
    this.broadcast("telemetry", {
      type: "telemetry",
      data,
      timestamp: new Date().toISOString(),
    });
  }
}
