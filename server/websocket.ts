import { createLogger } from "./lib/structured-logger";
const logger = createLogger("Websocket");
import { WebSocketServer, WebSocket } from "ws";
import { Server } from "node:http";
import crypto from "node:crypto";
import {
  setWebSocketConnections,
  incrementWebSocketMessage,
  incrementWebSocketReconnection,
} from "./observability";
import {
  recordWsConnectionRejected,
  recordWsOrgConnectionCount,
} from "./observability/websocket-metrics";
import {
  FanoutBus,
  SYSTEM_ORG_ID,
  getFanoutBus,
  isTenantStrictModeEnabled,
} from "./websocket-fanout";
import { parseOrgConnectionLimit, resolveUpgradeOrg } from "./websocket-auth";
import { WebSocketBroadcasts } from "./websocket-broadcasts";
import { WebSocketFanoutCoordinator } from "./websocket-fanout-coordinator";
import { TelemetryThrottler } from "./websocket-telemetry-throttler";
import {
  BroadcastPayload,
  WebSocketClient,
  WebSocketClientMessage,
  deliveryKey,
} from "./websocket-types";

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

class TelemetryWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private telemetryThrottler: TelemetryThrottler;
  private readonly fanoutCoordinator: WebSocketFanoutCoordinator;
  private readonly broadcasts: WebSocketBroadcasts;
  /** LR-3 — Per-org live connection counts. Used to enforce the
   *  `WS_ORG_CONNECTION_LIMIT` cap and to publish the
   *  `arus_websocket_connections_active_per_org{org_id}` gauge. */
  private readonly orgConnectionCounts = new Map<string, number>();

  private decrementOrgCount(orgId: string): void {
    const current = this.orgConnectionCounts.get(orgId) ?? 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      this.orgConnectionCounts.delete(orgId);
    } else {
      this.orgConnectionCounts.set(orgId, next);
    }
    recordWsOrgConnectionCount(orgId, next);
  }

  constructor(server: Server, fanout: FanoutBus = getFanoutBus()) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.fanoutCoordinator = new WebSocketFanoutCoordinator(fanout, this.clients, log);
    this.broadcasts = new WebSocketBroadcasts(
      (channel, data, orgId) => this.broadcast(channel, data, orgId),
      log
    );

    // PERFORMANCE: Initialize throttled telemetry broadcasting (250ms batches)
    this.telemetryThrottler = new TelemetryThrottler(250);
    this.telemetryThrottler.start((channel, data) => this.broadcast(channel, data));

    this.wss.on("connection", async (ws, req) => {
      const clientId = this.generateClientId();
      // Resolve the tenant at handshake. In tenant-auth mode we hard-
      // reject anonymous upgrades (1008 = policy violation); in legacy
      // single-tenant mode we land in DEFAULT_ORG_ID. System-wide
      // broadcasts (the existing `broadcast()` API) continue to publish
      // under SYSTEM_ORG_ID — every client also subscribes to that
      // namespace so legacy call sites keep reaching their audience
      // while the per-tenant addressing is layered on top.
      const auth = await resolveUpgradeOrg(req);
      if (!auth.ok) {
        log(`WebSocket upgrade rejected (${auth.reason}) for ${clientId}`);
        recordWsConnectionRejected("unknown", "auth_failed");
        try {
          ws.close(1008, auth.reason);
        } catch {
          /* socket already closed */
        }
        return;
      }

      // LR-3 — Per-org connection cap. Reads `WS_ORG_CONNECTION_LIMIT`
      // at handshake time so ops can tune without a restart. A value
      // of 0 or unset means "no cap" (legacy behaviour). When the
      // cap is exceeded we count it, log a structured warning, and
      // close with 4290 (custom mapping of HTTP 429) so the client
      // can distinguish "cap" from "auth" (1008) or "server shutdown"
      // (1001) and apply a longer backoff before reconnecting.
      const cap = parseOrgConnectionLimit();
      if (cap > 0) {
        const current = this.orgConnectionCounts.get(auth.orgId) ?? 0;
        if (current >= cap) {
          log(
            `WebSocket upgrade rejected (org_cap_exceeded org=${auth.orgId} ` +
              `current=${current} cap=${cap}) for ${clientId}`
          );
          recordWsConnectionRejected(auth.orgId, "cap_exceeded");
          try {
            ws.close(4290, "ORG_CONNECTION_LIMIT_EXCEEDED");
          } catch {
            /* socket already closed */
          }
          return;
        }
      }

      const client: WebSocketClient = {
        ws,
        id: clientId,
        subscriptions: new Set(),
        orgId: auth.orgId,
        delivery: new Map(),
      };

      this.clients.set(clientId, client);
      const nextOrgCount = (this.orgConnectionCounts.get(auth.orgId) ?? 0) + 1;
      this.orgConnectionCounts.set(auth.orgId, nextOrgCount);
      recordWsOrgConnectionCount(auth.orgId, nextOrgCount);
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
          incrementWebSocketMessage(message.type || "unknown", "client");

          this.handleMessage(client, message);
        } catch (parseError) {
          log(`WebSocket parse error: ${parseError}`);
          incrementWebSocketMessage("parse_error", "client");
        }
      });

      ws.on("close", () => {
        this.fanoutCoordinator.releaseAllClientFanoutSubs(client);
        this.clients.delete(clientId);
        this.decrementOrgCount(auth.orgId);
        log(`WebSocket client disconnected: ${clientId}`);

        // Update connection metrics (enhanced observability)
        setWebSocketConnections(this.clients.size);
      });

      ws.on("error", (error) => {
        log(`WebSocket error for client ${clientId}: ${error}`);
        this.fanoutCoordinator.releaseAllClientFanoutSubs(client);
        if (this.clients.delete(clientId)) {
          this.decrementOrgCount(auth.orgId);
        }

        // Update connection metrics and track reconnection (enhanced observability)
        setWebSocketConnections(this.clients.size);
        incrementWebSocketReconnection("error");
      });
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;
  }

  private handleMessage(client: WebSocketClient, message: WebSocketClientMessage) {
    const messageHandlers: Record<string, () => void> = {
      subscribe: () => {
        if (!message.channel) {
          return;
        }
        const channel = message.channel;
        // Per-namespace cursor map: `{ [orgId]: lastEventId }`. The
        // client tracks (orgId, channel) cursors because legacy
        // broadcasts arrive on SYSTEM_ORG_ID while tenant-scoped
        // publishes arrive on `client.orgId`, and the two streams
        // are not directly comparable. We also accept the legacy
        // single `lastEventId` form for backward compatibility with
        // older clients — in that case the cursor is applied to the
        // client's own tenant namespace only (the conservative
        // default that does not over-replay SYSTEM_ORG_ID).
        const cursors: Record<string, string> = {};
        if (message.lastEventIds && typeof message.lastEventIds === "object") {
          for (const [orgId, id] of Object.entries(message.lastEventIds)) {
            if (typeof id === "string" && id.length > 0) {
              cursors[orgId] = id;
            }
          }
        } else if (typeof message.lastEventId === "string" && message.lastEventId.length > 0) {
          cursors[client.orgId] = message.lastEventId;
        }
        // Task 91: in strict mode we never wire the SYSTEM_ORG_ID
        // bypass for tenant clients — replay cursors follow suit.
        const strict = isTenantStrictModeEnabled();
        const namespaces =
          client.orgId === SYSTEM_ORG_ID
            ? [SYSTEM_ORG_ID]
            : strict
              ? [client.orgId]
              : [client.orgId, SYSTEM_ORG_ID];

        const isFreshSubscription = !client.subscriptions.has(channel);
        if (isFreshSubscription) {
          client.subscriptions.add(channel);
          this.fanoutCoordinator.acquireClientFanoutSubs(client, channel);
        }
        // Initialise/refresh a delivery state per namespace BEFORE
        // dispatching replay. While `replaying=true` the live path
        // (onFanoutEvent) buffers events for that (orgId, channel)
        // rather than racing them onto the socket.
        for (const orgId of namespaces) {
          const key = deliveryKey(orgId, channel);
          const cursor = cursors[orgId] ?? null;
          const wantsReplayForOrg = cursor !== null;
          client.delivery.set(key, {
            replaying: wantsReplayForOrg,
            buffer: [],
            deliveredUpTo: cursor,
          });
        }
        log(`Client ${client.id} subscribed to ${channel}`);

        for (const orgId of namespaces) {
          const cursor = cursors[orgId];
          if (!cursor) {
            continue;
          }
          this.fanoutCoordinator.replayToClient(client, orgId, channel, cursor).catch((err) => {
            log(`Replay failed for ${client.id}:${orgId}:${channel}: ${err}`);
            const state = client.delivery.get(deliveryKey(orgId, channel));
            if (state) {
              state.replaying = false;
              this.fanoutCoordinator.drainBuffer(client, orgId, channel);
            }
          });
        }
        if (channel === "alerts") {
          void this.broadcasts.sendLatestAlerts(client);
        }
      },
      unsubscribe: () => {
        if (!message.channel) {
          return;
        }
        if (client.subscriptions.delete(message.channel)) {
          const channel = message.channel;
          client.delivery.delete(deliveryKey(client.orgId, channel));
          client.delivery.delete(deliveryKey(SYSTEM_ORG_ID, channel));
          this.fanoutCoordinator.releaseClientFanoutSubs(client, channel);
        }
        log(`Client ${client.id} unsubscribed from ${message.channel}`);
      },
      ping: () => {
        client.ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
      },
    };
    if (message.type) {
      messageHandlers[message.type]?.();
    }
  }

  public broadcast(channel: string, data: BroadcastPayload, orgId?: string) {
    this.fanoutCoordinator.broadcast(channel, data, orgId);
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

  public broadcastAlert(alert: BroadcastPayload & { message?: string }) {
    this.broadcasts.broadcastAlert(alert);
  }

  public broadcastAlertAcknowledged(alertId: string, acknowledgedBy: string) {
    this.broadcasts.broadcastAlertAcknowledged(alertId, acknowledgedBy);
  }

  public broadcastDashboardUpdate(updateType: string, data: BroadcastPayload) {
    this.broadcasts.broadcastDashboardUpdate(updateType, data);
  }

  public broadcastDataChange(
    entity: string,
    operation: "create" | "update" | "delete",
    data: BroadcastPayload & { id?: string }
  ) {
    this.broadcasts.broadcastDataChange(entity, operation, data);
  }

  public broadcastWorkOrderChange(
    operation: "create" | "update" | "delete",
    workOrder: BroadcastPayload
  ) {
    this.broadcasts.broadcastWorkOrderChange(operation, workOrder);
  }

  public broadcastEquipmentChange(
    operation: "create" | "update" | "delete",
    equipment: BroadcastPayload
  ) {
    this.broadcasts.broadcastEquipmentChange(operation, equipment);
  }

  public broadcastVesselChange(
    operation: "create" | "update" | "delete",
    vessel: BroadcastPayload
  ) {
    this.broadcasts.broadcastVesselChange(operation, vessel);
  }

  public broadcastCrewChange(operation: "create" | "update" | "delete", crew: BroadcastPayload) {
    this.broadcasts.broadcastCrewChange(operation, crew);
  }

  public broadcastMaintenanceScheduleChange(
    operation: "create" | "update" | "delete",
    schedule: BroadcastPayload
  ) {
    this.broadcasts.broadcastMaintenanceScheduleChange(operation, schedule);
  }

  public broadcastCrewAssignmentChange(
    operation: "create" | "update" | "delete",
    assignment: BroadcastPayload
  ) {
    this.broadcasts.broadcastCrewAssignmentChange(operation, assignment);
  }

  public broadcastPartsChange(operation: "create" | "update" | "delete", part: BroadcastPayload) {
    this.broadcasts.broadcastPartsChange(operation, part);
  }

  public broadcastStockChange(operation: "create" | "update" | "delete", stock: BroadcastPayload) {
    this.broadcasts.broadcastStockChange(operation, stock);
  }

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
    this.broadcasts.broadcastUpdateNotification(updateNotification);
  }

  public broadcastAlertSuppression(suppression: BroadcastPayload) {
    this.broadcasts.broadcastAlertSuppression(suppression);
  }

  public broadcastWorkOrderCreated(workOrder: BroadcastPayload) {
    this.broadcasts.broadcastWorkOrderCreated(workOrder);
  }

  public broadcastScheduleSimulation(
    eventType: "preview_created" | "committed" | "discarded" | "expired",
    data: BroadcastPayload
  ) {
    this.broadcasts.broadcastScheduleSimulation(eventType, data);
  }

  public broadcastSchedulePlannerUpdate(
    updateType: "refresh" | "assignment_changed" | "violation_detected",
    data: BroadcastPayload
  ) {
    this.broadcasts.broadcastSchedulePlannerUpdate(updateType, data);
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
    this.broadcasts.broadcastTelemetryImmediate(data);
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public destroy() {
    // PERFORMANCE: Stop throttler before closing connections
    this.telemetryThrottler.stop();
    this.fanoutCoordinator.releaseSubscriptions();

    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();

    this.wss.close();
    this.fanoutCoordinator.closeFanout();
  }
}

export { TelemetryWebSocketServer };

// Proxy export so callers can do `const { wsServer } = await import("./websocket")`.
// Delegates to the singleton in ./websocket-server. Methods are no-ops if the
// server isn't initialized yet, so callers never crash during early boot.
import { getWebSocketServer as _getWebSocketServer } from "./websocket-server";
export const wsServer: TelemetryWebSocketServer = new Proxy({} as TelemetryWebSocketServer, {
  get(_target, prop: string | symbol) {
    const instance = _getWebSocketServer();
    if (!instance) {
      // Return a no-op function for any method access to keep runtime safe.
      return () => undefined;
    }
    const value = (instance as object as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
