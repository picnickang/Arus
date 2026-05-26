import client from "prom-client";

// ===== WEBSOCKET METRICS =====
export const websocketConnectionsTotal = new client.Gauge({
  name: "arus_websocket_connections_active",
  help: "Number of active WebSocket connections",
});

export const websocketMessagesTotal = new client.Counter({
  name: "arus_websocket_messages_total",
  help: "Total WebSocket messages processed",
  labelNames: ["type", "channel"],
});

export const websocketReconnectionsTotal = new client.Counter({
  name: "arus_websocket_reconnections_total",
  help: "Total WebSocket reconnection attempts",
  labelNames: ["reason"],
});

// Helper functions
export function recordWebsocketConnection(delta: number = 1) {
  if (delta > 0) {
    websocketConnectionsTotal.inc(delta);
  } else {
    websocketConnectionsTotal.dec(Math.abs(delta));
  }
}

export function recordWebsocketMessage(type: string, channel: string) {
  websocketMessagesTotal.inc({ type, channel });
}

export function recordWebsocketReconnection(reason: string) {
  websocketReconnectionsTotal.inc({ reason });
}

// Backward-compatible aliases
export function setWebSocketConnections(count: number) {
  websocketConnectionsTotal.set(count);
}

// ===== LR-3: PER-ORG WS CAP METRICS =====
//
// Two metrics support the per-org connection cap added in LR-3:
//
//   1. `arus_websocket_connections_active_per_org{org_id}` — gauge of
//      currently-held WS connections per tenant. Cardinality is bounded
//      by the number of distinct tenants connecting in a process
//      lifetime; orgs that disconnect drop to 0 but the label persists
//      until process restart (acceptable for typical fleet operator
//      tenancy of O(100s)).
//
//   2. `arus_websocket_connections_rejected_total{org_id,reason}` —
//      counter of refused upgrades. The `reason` label is a closed set
//      (`cap_exceeded`, `auth_failed`, `tenant_strict`) so cardinality
//      stays bounded.
//
// Neither metric replaces the existing process-wide
// `arus_websocket_connections_active` gauge; both are layered on top
// so existing dashboards keep working.
export const websocketConnectionsActivePerOrg = new client.Gauge({
  name: "arus_websocket_connections_active_per_org",
  help: "Currently-held WebSocket connections, labelled by tenant orgId.",
  labelNames: ["org_id"],
});

export const websocketConnectionsRejectedTotal = new client.Counter({
  name: "arus_websocket_connections_rejected_total",
  help: "WebSocket upgrades refused by the server, labelled by tenant and reason.",
  labelNames: ["org_id", "reason"],
});

/** Closed set of rejection reasons for the per-org counter. */
export type WsRejectionReason =
  | "cap_exceeded"
  | "auth_failed"
  | "tenant_strict"
  | "server_shutdown";

export function recordWsOrgConnectionCount(orgId: string, count: number): void {
  websocketConnectionsActivePerOrg.set({ org_id: orgId }, count);
}

export function recordWsConnectionRejected(orgId: string, reason: WsRejectionReason): void {
  websocketConnectionsRejectedTotal.inc({ org_id: orgId, reason });
}

export function incrementWebSocketMessage(type: string, channel: string) {
  websocketMessagesTotal.inc({ type, channel });
}

export function incrementWebSocketReconnection(reason: string) {
  websocketReconnectionsTotal.inc({ reason });
}
