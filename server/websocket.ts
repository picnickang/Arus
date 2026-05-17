import { createLogger } from "./lib/structured-logger";
const logger = createLogger("Websocket");
import { WebSocketServer, WebSocket } from "ws";
import { Server } from "node:http";
import { dbAlertStorage } from "./repositories";
import {
  setWebSocketConnections,
  incrementWebSocketMessage,
  incrementWebSocketReconnection,
} from "./observability";

// Simple logger utility (replaces vite.ts log to avoid bundling vite in production)
function log(message: string, source = "websocket") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  logger.info(`${formattedTime} [${source}] ${message}`);
}

type BroadcastPayload = Record<string, unknown> | unknown[];

/**
 * PERFORMANCE: Telemetry broadcast throttler
 * Prevents flooding frontend with high-frequency telemetry updates
 * Collects updates and broadcasts at fixed intervals (250ms default)
 */
class TelemetryThrottler {
  private pendingUpdates: Map<string, BroadcastPayload> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private broadcastFn: ((channel: string, data: BroadcastPayload) => void) | null = null;

  constructor(intervalMs: number = 250) {
    this.intervalMs = intervalMs;
  }

  start(broadcastFn: (channel: string, data: BroadcastPayload) => void): void {
    this.broadcastFn = broadcastFn;
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.flush();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  queue(equipmentId: string, data: BroadcastPayload): void {
    this.pendingUpdates.set(equipmentId, data);
  }

  private flush(): void {
    if (this.pendingUpdates.size === 0 || !this.broadcastFn) {
      return;
    }

    const batch = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    this.broadcastFn("telemetry", {
      type: "telemetry_batch",
      data: batch,
      count: batch.length,
      timestamp: new Date().toISOString(),
    });
  }
}

interface WebSocketClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
}

class TelemetryWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private telemetryThrottler: TelemetryThrottler;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    // PERFORMANCE: Initialize throttled telemetry broadcasting (250ms batches)
    this.telemetryThrottler = new TelemetryThrottler(250);
    this.telemetryThrottler.start((channel, data) => this.broadcast(channel, data));

    this.wss.on("connection", (ws, req) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        ws,
        id: clientId,
        subscriptions: new Set(),
      };

      this.clients.set(clientId, client);
      log(`WebSocket client connected: ${clientId}`);

      // Update connection metrics (enhanced observability)
      setWebSocketConnections(this.clients.size);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "connection",
          clientId,
          timestamp: new Date().toISOString(),
        })
      );

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Track message metrics (enhanced observability)
          // @ts-ignore -- bulk-silence
          incrementWebSocketMessage(message.type || "unknown");

          this.handleMessage(client, message);
        } catch (parseError) {
          log(`WebSocket parse error: ${parseError}`);
          // @ts-ignore -- bulk-silence
          incrementWebSocketMessage("parse_error");
        }
      });

      ws.on("close", () => {
        this.clients.delete(clientId);
        log(`WebSocket client disconnected: ${clientId}`);

        // Update connection metrics (enhanced observability)
        setWebSocketConnections(this.clients.size);
      });

      ws.on("error", (error) => {
        log(`WebSocket error for client ${clientId}: ${error}`);
        this.clients.delete(clientId);

        // Update connection metrics and track reconnection (enhanced observability)
        setWebSocketConnections(this.clients.size);
        incrementWebSocketReconnection("error");
      });
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;
  }

  private handleMessage(client: WebSocketClient, message: { type?: string; channel?: string }) {
    const messageHandlers: Record<string, () => void> = {
      subscribe: () => {
        if (message.channel) {
          client.subscriptions.add(message.channel);
          log(`Client ${client.id} subscribed to ${message.channel}`);
          if (message.channel === "alerts") {
            this.sendLatestAlerts(client);
          }
        }
      },
      unsubscribe: () => {
        if (message.channel) {
          client.subscriptions.delete(message.channel);
          log(`Client ${client.id} unsubscribed from ${message.channel}`);
        }
      },
      ping: () => {
        client.ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
      },
    };
    if (message.type) {
      messageHandlers[message.type]?.();
    }
  }

  public broadcast(channel: string, data: BroadcastPayload) {
    const message = JSON.stringify(data);

    this.clients.forEach((client) => {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error) {
          log(`Failed to send to client ${client.id}: ${error}`);
        }
      }
    });
  }

  public broadcastToAll(data: BroadcastPayload) {
    const message = JSON.stringify(data);

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error) {
          log(`Failed to send to client ${client.id}: ${error}`);
        }
      }
    });
  }

  // Send latest alerts to a specific client
  private async sendLatestAlerts(client: WebSocketClient) {
    try {
      const alerts = await dbAlertStorage.getAlertNotifications(false); // Get unacknowledged alerts
      client.ws.send(
        JSON.stringify({
          type: "alerts_initial",
          data: alerts,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      log(`Failed to send latest alerts to client ${client.id}: ${error}`);
    }
  }

  // Broadcast new alert to all alert subscribers
  public broadcastAlert(alert: BroadcastPayload & { message?: string }) {
    this.broadcast("alerts", {
      type: "alert_new",
      data: alert,
      timestamp: new Date().toISOString(),
    });
    log(`Broadcasted new alert: ${alert.message ?? "unknown"}`);
  }

  // Broadcast alert acknowledgment to all alert subscribers
  public broadcastAlertAcknowledged(alertId: string, acknowledgedBy: string) {
    this.broadcast("alerts", {
      type: "alert_acknowledged",
      data: { alertId, acknowledgedBy },
      timestamp: new Date().toISOString(),
    });
    log(`Broadcasted alert acknowledgment: ${alertId}`);
  }

  // Broadcast dashboard updates
  public broadcastDashboardUpdate(updateType: string, data: BroadcastPayload) {
    this.broadcast("dashboard", {
      type: `dashboard_${updateType}`,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast data change events for multi-device synchronization
  public broadcastDataChange(
    entity: string,
    operation: "create" | "update" | "delete",
    data: BroadcastPayload & { id?: string }
  ) {
    const message = {
      type: "data_change",
      entity,
      operation,
      data,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to entity-specific channel
    this.broadcast(`data:${entity}`, message);

    // Also broadcast to general data changes channel
    this.broadcast("data:all", message);

    log(`Broadcasted ${operation} for ${entity}: ${data.id || "N/A"}`);
  }

  // Convenience methods for specific entities
  public broadcastWorkOrderChange(
    operation: "create" | "update" | "delete",
    workOrder: BroadcastPayload
  ) {
    this.broadcastDataChange("work_orders", operation, workOrder);
  }

  public broadcastEquipmentChange(
    operation: "create" | "update" | "delete",
    equipment: BroadcastPayload
  ) {
    this.broadcastDataChange("equipment", operation, equipment);
  }

  public broadcastVesselChange(
    operation: "create" | "update" | "delete",
    vessel: BroadcastPayload
  ) {
    this.broadcastDataChange("vessels", operation, vessel);
  }

  public broadcastCrewChange(operation: "create" | "update" | "delete", crew: BroadcastPayload) {
    this.broadcastDataChange("crew", operation, crew);
  }

  public broadcastMaintenanceScheduleChange(
    operation: "create" | "update" | "delete",
    schedule: BroadcastPayload
  ) {
    this.broadcastDataChange("maintenance_schedules", operation, schedule);
  }

  public broadcastCrewAssignmentChange(
    operation: "create" | "update" | "delete",
    assignment: BroadcastPayload
  ) {
    this.broadcastDataChange("crew_assignments", operation, assignment);
  }

  public broadcastPartsChange(operation: "create" | "update" | "delete", part: BroadcastPayload) {
    this.broadcastDataChange("parts", operation, part);
  }

  public broadcastStockChange(operation: "create" | "update" | "delete", stock: BroadcastPayload) {
    this.broadcastDataChange("stock", operation, stock);
  }

  // Broadcast software update notification to all update subscribers
  public broadcastUpdateNotification(updateNotification: {
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
  }) {
    const eventTimestamp = updateNotification.timestamp || new Date().toISOString();
    this.broadcast("updates", {
      type: "update_notification",
      data: {
        ...updateNotification,
        timestamp: eventTimestamp,
      },
      timestamp: new Date().toISOString(),
    });
    log(
      `Broadcasted update notification: ${updateNotification.type} - ${updateNotification.message}`
    );
  }

  // Broadcast alert suppression to all alert subscribers
  public broadcastAlertSuppression(suppression: BroadcastPayload) {
    this.broadcast("alerts", {
      type: "alert_suppression",
      data: suppression,
      timestamp: new Date().toISOString(),
    });
    log(`Broadcasted alert suppression`);
  }

  // Broadcast work order created for auto-generated orders
  public broadcastWorkOrderCreated(workOrder: BroadcastPayload) {
    this.broadcastDataChange("work_orders", "create", workOrder);
  }

  public broadcastScheduleSimulation(
    eventType: "preview_created" | "committed" | "discarded" | "expired",
    data: BroadcastPayload
  ) {
    this.broadcast("schedule_simulation", {
      type: `simulation_${eventType}`,
      data,
      timestamp: new Date().toISOString(),
    });
    log(`Broadcasted schedule simulation event: ${eventType}`);
  }

  public broadcastSchedulePlannerUpdate(
    updateType: "refresh" | "assignment_changed" | "violation_detected",
    data: BroadcastPayload
  ) {
    this.broadcast("schedule_planner", {
      type: `planner_${updateType}`,
      data,
      timestamp: new Date().toISOString(),
    });
    log(`Broadcasted schedule planner update: ${updateType}`);
  }

  /**
   * PERFORMANCE: Queue telemetry for throttled broadcast
   * Use this for high-frequency telemetry updates to prevent frontend overload
   * Updates are batched and sent every 250ms
   */
  public queueTelemetryUpdate(equipmentId: string, telemetryData: BroadcastPayload): void {
    this.telemetryThrottler.queue(equipmentId, telemetryData);
  }

  /**
   * PERFORMANCE: Broadcast telemetry immediately (bypass throttler)
   * Use sparingly - only for critical/urgent telemetry updates
   */
  public broadcastTelemetryImmediate(data: BroadcastPayload): void {
    this.broadcast("telemetry", {
      type: "telemetry",
      data,
      timestamp: new Date().toISOString(),
    });
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public destroy() {
    // PERFORMANCE: Stop throttler before closing connections
    this.telemetryThrottler.stop();

    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();

    this.wss.close();
  }
}

export { TelemetryWebSocketServer };

// Proxy export so callers can do `const { wsServer } = await import("./websocket")`.
// Delegates to the singleton in ./websocket-server. Methods are no-ops if the
// server isn't initialized yet, so callers never crash during early boot.
import { getWebSocketServer as _getWebSocketServer } from "./websocket-server";
export const wsServer: TelemetryWebSocketServer = new Proxy(
  {} as TelemetryWebSocketServer,
  {
    get(_target, prop: string | symbol) {
      const instance = _getWebSocketServer();
      if (!instance) {
        // Return a no-op function for any method access to keep runtime safe.
        return () => undefined;
      }
      const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  },
);
