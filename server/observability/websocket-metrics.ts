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

export function incrementWebSocketMessage(type: string, channel: string) {
  websocketMessagesTotal.inc({ type, channel });
}

export function incrementWebSocketReconnection(reason: string) {
  websocketReconnectionsTotal.inc({ reason });
}
