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
import {
  FanoutBus,
  FanoutEvent,
  SYSTEM_ORG_ID,
  compareEventIds,
  getFanoutBus,
} from "./websocket-fanout";

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

interface ChannelDeliveryState {
  /** While replaying, live events go into `buffer` instead of the
   *  socket. After replay finishes we drain the buffer, deduping any
   *  event whose id was already replayed. This is what guarantees the
   *  "zero duplicate, zero missed" reconnect-with-replay contract. */
  replaying: boolean;
  buffer: FanoutEvent[];
  /** Highest eventId delivered to the client on this channel — used
   *  to dedupe buffered live events that overlap the replay window. */
  deliveredUpTo: string | null;
}

interface WebSocketClient {
  ws: WebSocket;
  id: string;
  /** Channels this client wants to receive; each maps to a fan-out
   *  unsubscribe handle so we can release the upstream subscription
   *  when the local subscriber set for the channel becomes empty. */
  subscriptions: Set<string>;
  /** Push B1 contract: orgId pinned at handshake when sessions are
   *  wired in. Until then, system-org default keeps the old behaviour. */
  orgId: string;
  /** Per-channel replay/live state for the reconnect-with-replay
   *  ordering guarantee. */
  delivery: Map<string, ChannelDeliveryState>;
}

class TelemetryWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private telemetryThrottler: TelemetryThrottler;
  private readonly fanout: FanoutBus;
  /** Reference-counted fan-out subscriptions keyed by `${orgId}::${channel}`.
   *  We only `bus.subscribe` once per channel per node — local dispatch
   *  to interested clients happens in `onFanoutEvent`. */
  private readonly fanoutSubs = new Map<string, { count: number; unsubscribe: () => void }>();

  constructor(server: Server, fanout: FanoutBus = getFanoutBus()) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.fanout = fanout;

    // PERFORMANCE: Initialize throttled telemetry broadcasting (250ms batches)
    this.telemetryThrottler = new TelemetryThrottler(250);
    this.telemetryThrottler.start((channel, data) => this.broadcast(channel, data));

    this.wss.on("connection", (ws, _req) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        ws,
        id: clientId,
        subscriptions: new Set(),
        // Push B2 follow-up: orgId resolution at handshake is gated on
        // the B1.1 session middleware landing. Until then every client
        // shares the system-org namespace — see ADR 002 "Consequences".
        orgId: SYSTEM_ORG_ID,
        delivery: new Map(),
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
          (incrementWebSocketMessage as any)(message.type || "unknown");

          this.handleMessage(client, message);
        } catch (parseError) {
          log(`WebSocket parse error: ${parseError}`);
          (incrementWebSocketMessage as any)("parse_error");
        }
      });

      ws.on("close", () => {
        this.releaseClientFanoutSubs(client);
        this.clients.delete(clientId);
        log(`WebSocket client disconnected: ${clientId}`);

        // Update connection metrics (enhanced observability)
        setWebSocketConnections(this.clients.size);
      });

      ws.on("error", (error) => {
        log(`WebSocket error for client ${clientId}: ${error}`);
        this.releaseClientFanoutSubs(client);
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

  private handleMessage(
    client: WebSocketClient,
    message: { type?: string; channel?: string; lastEventId?: string | null },
  ) {
    const messageHandlers: Record<string, () => void> = {
      subscribe: () => {
        if (!message.channel) return;
        const channel = message.channel;
        const wantsReplay =
          message.lastEventId !== undefined && message.lastEventId !== null;

        if (!client.subscriptions.has(channel)) {
          client.subscriptions.add(channel);
          // Initialise per-client delivery state BEFORE we attach the
          // fan-out subscription. If replay is requested we mark the
          // channel `replaying` so onFanoutEvent buffers live events
          // instead of racing the replay frames onto the socket. This
          // is what guarantees the "no duplicate, no missed" contract.
          client.delivery.set(channel, {
            replaying: wantsReplay,
            buffer: [],
            deliveredUpTo: wantsReplay ? message.lastEventId ?? null : null,
          });
          this.acquireFanoutSub(client.orgId, channel);
        } else if (wantsReplay) {
          // Re-subscribe of an existing channel with a fresh cursor —
          // re-enter replay mode and buffer live frames again.
          const state = client.delivery.get(channel);
          if (state) {
            state.replaying = true;
            state.buffer = [];
            state.deliveredUpTo = message.lastEventId ?? null;
          }
        }
        log(`Client ${client.id} subscribed to ${channel}`);

        if (wantsReplay) {
          this.replayToClient(client, channel, message.lastEventId as string).catch((err) => {
            log(`Replay failed for ${client.id}:${channel}: ${err}`);
            // On replay failure flip back to live so the client isn't
            // left with a permanently-buffering channel.
            const state = client.delivery.get(channel);
            if (state) {
              state.replaying = false;
              this.drainBuffer(client, channel);
            }
          });
        }
        if (channel === "alerts") {
          this.sendLatestAlerts(client);
        }
      },
      unsubscribe: () => {
        if (!message.channel) return;
        if (client.subscriptions.delete(message.channel)) {
          client.delivery.delete(message.channel);
          this.releaseFanoutSub(client.orgId, message.channel);
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

  /** Reference-counted upstream subscription. The first local client
   *  to subscribe to `(orgId, channel)` opens the bus subscription;
   *  the last one to unsubscribe (or disconnect) closes it. */
  private acquireFanoutSub(orgId: string, channel: string): void {
    const key = `${orgId}::${channel}`;
    const existing = this.fanoutSubs.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    const unsubscribe = this.fanout.subscribe(channel, orgId, (event) => {
      this.onFanoutEvent(event);
    });
    this.fanoutSubs.set(key, { count: 1, unsubscribe });
  }

  private releaseFanoutSub(orgId: string, channel: string): void {
    const key = `${orgId}::${channel}`;
    const existing = this.fanoutSubs.get(key);
    if (!existing) return;
    existing.count -= 1;
    if (existing.count <= 0) {
      existing.unsubscribe();
      this.fanoutSubs.delete(key);
    }
  }

  private releaseClientFanoutSubs(client: WebSocketClient): void {
    for (const channel of client.subscriptions) {
      this.releaseFanoutSub(client.orgId, channel);
    }
    client.subscriptions.clear();
    client.delivery.clear();
  }

  /** Dispatch a fan-out event (local or peer) to every local client
   *  subscribed to the event's (orgId, channel). The frame the client
   *  receives is the same JSON it would have received pre-B2, with an
   *  added `eventId` so it can advance its replay cursor.
   *
   *  If the client is mid-replay on this channel, the live event is
   *  buffered and drained after replay (deduped by eventId). This is
   *  the "no double delivery" half of the reconnect-with-replay
   *  contract — without it, a live event published during replay would
   *  arrive twice (once live, once via replay). */
  private onFanoutEvent(event: FanoutEvent): void {
    this.clients.forEach((client) => {
      if (client.orgId !== event.orgId) return;
      if (!client.subscriptions.has(event.channel)) return;
      if (client.ws.readyState !== WebSocket.OPEN) return;

      const state = client.delivery.get(event.channel);
      if (state?.replaying) {
        state.buffer.push(event);
        return;
      }
      this.sendEvent(client, event);
    });
  }

  private sendEvent(client: WebSocketClient, event: FanoutEvent): boolean {
    const state = client.delivery.get(event.channel);
    if (state?.deliveredUpTo && compareEventIds(event.eventId, state.deliveredUpTo) <= 0) {
      // Already delivered (either via replay or an earlier live frame)
      // — drop silently to keep client-side dedup unnecessary.
      return false;
    }
    const frame = JSON.stringify(
      this.envelope(event.payload as BroadcastPayload, event.channel, event.eventId),
    );
    try {
      client.ws.send(frame);
      if (state) state.deliveredUpTo = event.eventId;
      return true;
    } catch (error) {
      log(`Failed to send to client ${client.id}: ${error}`);
      return false;
    }
  }

  private drainBuffer(client: WebSocketClient, channel: string): void {
    const state = client.delivery.get(channel);
    if (!state) return;
    const pending = state.buffer;
    state.buffer = [];
    // Buffer is FIFO from arrival order, but the buffered events are
    // sorted by eventId for sanity in case a peer message arrived out
    // of order during replay.
    pending.sort((a, b) => compareEventIds(a.eventId, b.eventId));
    for (const event of pending) {
      this.sendEvent(client, event);
    }
  }

  /** Merge the canonical broadcast payload with the substrate-assigned
   *  ids so the client can dedupe on `eventId` regardless of whether
   *  the event arrived live or via replay. */
  private envelope(
    payload: BroadcastPayload,
    channel: string,
    eventId: string,
  ): Record<string, unknown> {
    const base =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : { data: payload };
    return { ...base, eventId, channel };
  }

  private async replayToClient(
    client: WebSocketClient,
    channel: string,
    lastEventId: string,
  ): Promise<void> {
    try {
      const events = await this.fanout.replaySince(channel, client.orgId, lastEventId);
      if (events.length > 0) {
        log(`Replaying ${events.length} event(s) to ${client.id} on ${channel}`);
        for (const event of events) {
          if (client.ws.readyState !== WebSocket.OPEN) return;
          // sendEvent dedupes against state.deliveredUpTo and advances
          // it, so a later live frame with the same id is a no-op.
          this.sendEvent(client, event);
        }
      }
    } finally {
      // Flip out of replay mode and flush any live events that landed
      // while replay was in flight. The buffer is deduped by eventId
      // inside sendEvent, so any event already covered by the replay
      // window is dropped silently.
      const state = client.delivery.get(channel);
      if (state) {
        state.replaying = false;
        this.drainBuffer(client, channel);
      }
    }
  }

  public broadcast(channel: string, data: BroadcastPayload) {
    // Publish via fan-out — for in-process this is sub-ms and dispatches
    // straight back into `onFanoutEvent` for local delivery; for Redis
    // it also reaches sibling Node instances. Either way the client-
    // visible frame is the same, only with an added `eventId`.
    void this.fanout.publish(channel, data, SYSTEM_ORG_ID).catch((err) => {
      log(`fanout publish failed: ${err}`);
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

    // Release all fan-out subscriptions so the bus can free upstream
    // (Redis) resources promptly on shutdown.
    for (const { unsubscribe } of this.fanoutSubs.values()) {
      try {
        unsubscribe();
      } catch {}
    }
    this.fanoutSubs.clear();

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
