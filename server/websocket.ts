import { createLogger } from "./lib/structured-logger";
const logger = createLogger("Websocket");
import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "node:http";
import crypto from "node:crypto";
import { dbAlertStorage, dbSystemAdminStorage, dbUserStorage } from "./repositories";
import { DEFAULT_ORG_ID, requireTenantAuth } from "@shared/config/tenant";
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
  isTenantStrictModeEnabled,
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
  /** Highest eventId delivered to the client on this (orgId, channel)
   *  stream — used to dedupe buffered live events that overlap the
   *  replay window. Cursors are stream-local; eventIds from different
   *  namespaces are not directly comparable. */
  deliveredUpTo: string | null;
}

/** Delivery state is keyed by `${orgId}::${channel}` because a client
 *  may receive events on the same channel from two distinct fan-out
 *  namespaces (its own tenant + the global SYSTEM_ORG_ID for legacy
 *  broadcasts). The two streams have independent monotonic eventId
 *  sequences, so each needs its own cursor + replay buffer. */
function deliveryKey(orgId: string, channel: string): string {
  return `${orgId}::${channel}`;
}

interface WebSocketClient {
  ws: WebSocket;
  id: string;
  /** Channels this client wants to receive; each maps to a fan-out
   *  unsubscribe handle so we can release the upstream subscription
   *  when the local subscriber set for the channel becomes empty. */
  subscriptions: Set<string>;
  /** Resolved at the WebSocket upgrade from the authenticated session.
   *  In legacy single-tenant mode this is `DEFAULT_ORG_ID`. */
  orgId: string;
  /** Per-(orgId, channel) replay/live state. See `deliveryKey`. */
  delivery: Map<string, ChannelDeliveryState>;
}

/** Hash a raw session/bearer token the same way the HTTP auth path does
 *  (`server/security/authentication.ts`). The two paths must agree on
 *  the on-disk shape or upgrade-time auth will silently fail. */
function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface UpgradeAuthResult {
  ok: true;
  orgId: string;
  userId?: string;
}
interface UpgradeAuthRejection {
  ok: false;
  reason: string;
}

/** Resolve the tenant of a WebSocket upgrade.
 *
 *  Tokens may arrive on `?token=` (browsers can't set Authorization
 *  on the native WebSocket constructor) or, in server-to-server cases,
 *  on the `Authorization: Bearer …` header. In dev we mirror the HTTP
 *  middleware's dev-mock behaviour and land in `DEFAULT_ORG_ID`. In
 *  `REQUIRE_TENANT_AUTH=true` mode anonymous upgrades are rejected. */
async function resolveUpgradeOrg(
  req: IncomingMessage,
): Promise<UpgradeAuthResult | UpgradeAuthRejection> {
  const tenantAuth = requireTenantAuth();

  if (process.env['NODE_ENV'] === "development" && !tenantAuth) {
    return { ok: true, orgId: DEFAULT_ORG_ID, userId: "dev-admin-user" };
  }

  let token: string | undefined;
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim() || undefined;
  }
  if (!token && req.url) {
    try {
      const u = new URL(req.url, "http://x");
      const t = u.searchParams.get("token");
      if (t) token = t;
    } catch {
      /* malformed url — fall through to no-token path */
    }
  }

  if (!token) {
    if (tenantAuth) return { ok: false, reason: "UNAUTHENTICATED" };
    // Legacy single-tenant deployments: same posture as the HTTP path's
    // dev mock — land in the default org so existing single-instance
    // boots keep working when fan-out is off.
    return { ok: true, orgId: DEFAULT_ORG_ID };
  }

  try {
    const session = await dbSystemAdminStorage.getAdminSessionByToken(hashSessionToken(token));
    if (!session) return { ok: false, reason: "INVALID_TOKEN" };
    if (new Date(session.expiresAt) < new Date()) {
      return { ok: false, reason: "SESSION_EXPIRED" };
    }
    const user = session.userId ? await dbUserStorage.getUser(session.userId) : null;
    if (!user || !user.isActive) {
      return { ok: false, reason: tenantAuth ? "SESSION_USER_MISSING" : "USER_INACTIVE" };
    }
    if (tenantAuth && (!user.orgId || user.orgId.trim() === "")) {
      return { ok: false, reason: "TENANT_CLAIM_MISSING" };
    }
    return { ok: true, orgId: user.orgId || DEFAULT_ORG_ID, userId: user.id };
  } catch (err) {
    logger.error("ws upgrade auth lookup failed", undefined, err as Error);
    return { ok: false, reason: "AUTH_LOOKUP_FAILED" };
  }
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
        try {
          ws.close(1008, auth.reason);
        } catch {
          /* socket already closed */
        }
        return;
      }
      const client: WebSocketClient = {
        ws,
        id: clientId,
        subscriptions: new Set(),
        orgId: auth.orgId,
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
          incrementWebSocketMessage(message.type || "unknown", "client");

          this.handleMessage(client, message);
        } catch (parseError) {
          log(`WebSocket parse error: ${parseError}`);
          incrementWebSocketMessage("parse_error", "client");
        }
      });

      ws.on("close", () => {
        this.releaseAllClientFanoutSubs(client);
        this.clients.delete(clientId);
        log(`WebSocket client disconnected: ${clientId}`);

        // Update connection metrics (enhanced observability)
        setWebSocketConnections(this.clients.size);
      });

      ws.on("error", (error) => {
        log(`WebSocket error for client ${clientId}: ${error}`);
        this.releaseAllClientFanoutSubs(client);
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
    message: {
      type?: string;
      channel?: string;
      lastEventId?: string | null;
      lastEventIds?: Record<string, string> | null;
    },
  ) {
    const messageHandlers: Record<string, () => void> = {
      subscribe: () => {
        if (!message.channel) return;
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
            if (typeof id === "string" && id.length > 0) cursors[orgId] = id;
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
          this.acquireClientFanoutSubs(client, channel);
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
          if (!cursor) continue;
          this.replayToClient(client, orgId, channel, cursor).catch((err) => {
            log(`Replay failed for ${client.id}:${orgId}:${channel}: ${err}`);
            const state = client.delivery.get(deliveryKey(orgId, channel));
            if (state) {
              state.replaying = false;
              this.drainBuffer(client, orgId, channel);
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
          const channel = message.channel;
          client.delivery.delete(deliveryKey(client.orgId, channel));
          client.delivery.delete(deliveryKey(SYSTEM_ORG_ID, channel));
          this.releaseClientFanoutSubs(client, channel);
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

  /** Dual-subscribe: every client listens to its own tenant namespace
   *  AND to the legacy `SYSTEM_ORG_ID` namespace where un-migrated
   *  `broadcast()` call sites still publish. When call sites are
   *  migrated to publish per-tenant, removing the SYSTEM_ORG_ID sub
   *  here will enforce strict tenant isolation at the WS substrate. */
  private acquireClientFanoutSubs(client: WebSocketClient, channel: string): void {
    this.acquireFanoutSub(client.orgId, channel);
    // Task 91: in strict mode the legacy SYSTEM_ORG_ID bypass is
    // disabled — clients only ever subscribe to their own tenant
    // namespace, so cross-tenant leakage is impossible at the
    // substrate layer regardless of what callers try to publish.
    if (client.orgId !== SYSTEM_ORG_ID && !isTenantStrictModeEnabled()) {
      this.acquireFanoutSub(SYSTEM_ORG_ID, channel);
    }
  }

  private releaseClientFanoutSubs(client: WebSocketClient, channel: string): void {
    this.releaseFanoutSub(client.orgId, channel);
    if (client.orgId !== SYSTEM_ORG_ID && !isTenantStrictModeEnabled()) {
      this.releaseFanoutSub(SYSTEM_ORG_ID, channel);
    }
  }

  private releaseAllClientFanoutSubs(client: WebSocketClient): void {
    for (const channel of client.subscriptions) {
      this.releaseClientFanoutSubs(client, channel);
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
    // Task 91: defence-in-depth — in strict mode no client socket
    // ever receives a SYSTEM_ORG_ID event, even if a stray publisher
    // or a peer node managed to put one onto the bus. The subscribe
    // path already avoids wiring the legacy namespace; this is the
    // belt-and-braces drop at delivery time.
    if (event.orgId === SYSTEM_ORG_ID && isTenantStrictModeEnabled()) {
      return;
    }
    this.clients.forEach((client) => {
      // A client receives events for its own tenant AND for the global
      // SYSTEM_ORG_ID namespace (where legacy broadcasts still land).
      // This keeps existing `broadcast()` call sites working while
      // future tenant-scoped publishers reach only their own clients.
      if (event.orgId !== client.orgId && event.orgId !== SYSTEM_ORG_ID) return;
      if (!client.subscriptions.has(event.channel)) return;
      if (client.ws.readyState !== WebSocket.OPEN) return;

      const state = client.delivery.get(deliveryKey(event.orgId, event.channel));
      if (state?.replaying) {
        state.buffer.push(event);
        return;
      }
      this.sendEvent(client, event);
    });
  }

  private sendEvent(client: WebSocketClient, event: FanoutEvent): boolean {
    const state = client.delivery.get(deliveryKey(event.orgId, event.channel));
    if (state?.deliveredUpTo && compareEventIds(event.eventId, state.deliveredUpTo) <= 0) {
      // Already delivered on this (orgId, channel) stream — drop
      // silently. Cursor is stream-local, so this never compares
      // against an unrelated namespace's eventId.
      return false;
    }
    const frame = JSON.stringify(
      this.envelope(event.payload as BroadcastPayload, event.channel, event.eventId, event.orgId),
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

  private drainBuffer(client: WebSocketClient, orgId: string, channel: string): void {
    const state = client.delivery.get(deliveryKey(orgId, channel));
    if (!state) return;
    const pending = state.buffer;
    state.buffer = [];
    // Buffer is FIFO from arrival order, but the buffered events are
    // sorted by eventId for sanity in case a peer message arrived out
    // of order during replay. Within a single (orgId, channel) stream
    // eventIds ARE comparable, so this sort is well-defined.
    pending.sort((a, b) => compareEventIds(a.eventId, b.eventId));
    for (const event of pending) {
      this.sendEvent(client, event);
    }
  }

  /** Merge the canonical broadcast payload with the substrate-assigned
   *  ids so the client can dedupe on `(orgId, eventId)` regardless of
   *  whether the event arrived live or via replay. `orgId` is included
   *  because the client tracks per-(orgId, channel) cursors. */
  private envelope(
    payload: BroadcastPayload,
    channel: string,
    eventId: string,
    orgId: string,
  ): Record<string, unknown> {
    const base =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : { data: payload };
    return { ...base, eventId, channel, orgId };
  }

  private async replayToClient(
    client: WebSocketClient,
    orgId: string,
    channel: string,
    lastEventId: string,
  ): Promise<void> {
    try {
      const events = await this.fanout.replaySince(channel, orgId, lastEventId);
      if (events.length > 0) {
        log(`Replaying ${events.length} event(s) to ${client.id} on ${orgId}:${channel}`);
        for (const event of events) {
          if (client.ws.readyState !== WebSocket.OPEN) return;
          // sendEvent dedupes against state.deliveredUpTo and advances
          // it, so a later live frame with the same id is a no-op.
          this.sendEvent(client, event);
        }
      }
    } finally {
      // Flip out of replay mode for this namespace and flush any live
      // events that landed while replay was in flight. Buffer dedup is
      // by (orgId, eventId) so events already covered by the replay
      // window are dropped silently.
      const state = client.delivery.get(deliveryKey(orgId, channel));
      if (state) {
        state.replaying = false;
        this.drainBuffer(client, orgId, channel);
      }
    }
  }

  public broadcast(channel: string, data: BroadcastPayload, orgId?: string) {
    // Publish via fan-out — for in-process this is sub-ms and dispatches
    // straight back into `onFanoutEvent` for local delivery; for Redis
    // it also reaches sibling Node instances. Either way the client-
    // visible frame is the same, only with an added `eventId`.
    //
    // Task 91: legacy `broadcast(channel, data)` call sites default to
    // SYSTEM_ORG_ID. In strict mode that bypass is disabled: we log a
    // warning with a stack reference so the offending site can be
    // re-targeted to a real tenant org, and drop the event rather than
    // leak it across tenants. Pass an explicit `orgId` to address a
    // specific tenant — those publishes are unaffected by strict mode.
    const resolvedOrgId = orgId ?? SYSTEM_ORG_ID;
    if (resolvedOrgId === SYSTEM_ORG_ID && isTenantStrictModeEnabled()) {
      const stack = new Error("broadcast dropped").stack ?? "(no stack)";
      logger.warn("WS_TENANT_STRICT_MODE dropped SYSTEM_ORG_ID broadcast", {
        channel,
        stack,
      });
      return;
    }
    void this.fanout.publish(channel, data, resolvedOrgId).catch((err) => {
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

    // Push B2 — release the fan-out substrate itself so the Redis
    // subscriber connection + interval timers are closed for long-
    // lived processes / hot reloads. Best-effort fire-and-forget;
    // destroy() is sync by contract and any leftover I/O is bounded
    // by the substrate's own quit timeout.
    void this.fanout.close().catch((err) => {
      log(`fanout close failed: ${err}`);
    });
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
      const value = (instance as object as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  },
);
