import { useEffect, useRef, useState, useCallback } from "react";
import { getApiSessionToken, subscribeToApiSessionToken } from "@/lib/sessionToken";

/** Push B2 — eventIds are `<unix-ms>-<seq>` (Redis Streams format).
 *  Lexicographic ordering matches numeric ordering for same-length
 *  millisecond strings only, so parse before compare. */
function compareEventIds(a: string, b: string): number {
  const [aMs = 0, aSeq = 0] = a.split("-").map((n) => Number.parseInt(n, 10));
  const [bMs = 0, bSeq = 0] = b.split("-").map((n) => Number.parseInt(n, 10));
  if (aMs !== bMs) {
    return aMs - bMs;
  }
  return aSeq - bSeq;
}

interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  clientId?: string;
  /** Push B2 — every fan-out event carries a monotonic eventId so the
   *  client can resume from `lastEventId` on reconnect. Connection
   *  frames (welcome / pong) omit it. */
  eventId?: string;
  /** Which logical channel the event belongs to. Used to advance the
   *  per-(orgId, channel) replay cursor without parsing the message type. */
  channel?: string;
  /** The fan-out namespace the event was published into. The client
   *  may receive events on the same channel from two namespaces (its
   *  own tenant + the legacy SYSTEM_ORG_ID), each with an independent
   *  monotonic eventId sequence — cursors MUST be tracked per
   *  (orgId, channel) pair. Connection / pong frames omit it. */
  orgId?: string;
}

interface TelemetryData {
  equipmentId: string;
  sensorType: string;
  value: number;
  unit: string;
  threshold: number;
  status: string;
  timestamp: string;
}

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface AlertData {
  id: string;
  equipmentId: string;
  sensorType: string;
  alertType: string;
  message: string;
  value: number;
  threshold: number;
  acknowledged?: boolean | undefined;
  acknowledgedBy?: string | undefined;
  acknowledgedAt?: string | undefined;
  createdAt: string;
}

interface UpdateNotificationData {
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
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: WebSocketMessage | null;
  latestTelemetry: TelemetryData | null;
  latestAlert: AlertData | null;
  latestUpdate: UpdateNotificationData | null;
  initialAlerts: AlertData[];
  send: (message: Record<string, unknown>) => void;
  connect: () => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  connectionCount: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  const {
    url = `${protocol}//${globalThis.location.host}/ws`,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryData | null>(null);
  const [latestAlert, setLatestAlert] = useState<AlertData | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<UpdateNotificationData | null>(null);
  const [initialAlerts, setInitialAlerts] = useState<AlertData[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  /** Push B2 — per-(orgId, channel) replay cursor, keyed as
   *  `${orgId}::${channel}`. A client can receive events on the same
   *  channel from its own tenant namespace AND from the legacy
   *  SYSTEM_ORG_ID namespace; the two streams have independent
   *  monotonic eventId sequences, so a single per-channel cursor
   *  would either over-replay or false-dedupe across namespaces. On
   *  re-subscribe we send `lastEventIds: { [orgId]: id }` so the
   *  server can replay each namespace independently (5-min window
   *  per ADR 002). */
  const lastEventIdRef = useRef<Map<string, string>>(new Map());
  const channelCursorKey = useCallback(
    (orgId: string, channel: string) => `${orgId}::${channel}`,
    []
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    try {
      // Push B2 — propagate the session token on the upgrade URL so the
      // server can resolve the tenant at handshake time. Browsers can't
      // set Authorization headers on the native WebSocket constructor,
      // so a query parameter is the standard channel for this.
      let connectUrl = url;
      try {
        // Auth tokens live in-memory (client/src/lib/sessionToken.ts) and are
        // intentionally kept out of localStorage to reduce XSS blast radius, so
        // read the live token here — a localStorage read would always be empty
        // and the upgrade would resolve to the wrong tenant (or be rejected).
        const sessionToken = getApiSessionToken();
        if (sessionToken) {
          const u = new URL(url);
          u.searchParams.set("token", sessionToken);
          connectUrl = u.toString();
        }
      } catch {
        /* token registry unavailable — fall back to anonymous upgrade */
      }
      const ws = new WebSocket(connectUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCountRef.current = 0;
        setConnectionCount((prev) => prev + 1);

        // Re-subscribe to channels after reconnection. Push B2 — if we
        // have seen events on this channel before, ask the server to
        // replay anything published since the cursor. The server uses
        // a 5-min window (Redis stream MINID trim).
        subscriptionsRef.current.forEach((channel) => {
          // Collect every per-namespace cursor we have for this
          // channel and send them as `lastEventIds: { [orgId]: id }`.
          // The server replays each namespace independently. If we've
          // never seen this channel before, both maps are empty and
          // the server treats it as a fresh subscription.
          const lastEventIds: Record<string, string> = {};
          const suffix = `::${channel}`;
          lastEventIdRef.current.forEach((id, key) => {
            if (key.endsWith(suffix)) {
              const orgId = key.slice(0, key.length - suffix.length);
              if (orgId) {
                lastEventIds[orgId] = id;
              }
            }
          });
          ws.send(
            JSON.stringify({
              type: "subscribe",
              channel,
              ...(Object.keys(lastEventIds).length > 0 ? { lastEventIds } : {}),
            })
          );
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          // Push B2 — advance the per-(orgId, channel) replay cursor.
          // Idempotent by `eventId` within the namespace so a message
          // arriving both live and via replay doesn't poison the
          // cursor. eventIds are NOT comparable across namespaces, so
          // we never compare an SYSTEM_ORG_ID id against a tenant id.
          if (message.eventId && message.channel && message.orgId) {
            const key = channelCursorKey(message.orgId, message.channel);
            const prior = lastEventIdRef.current.get(key);
            if (!prior || compareEventIds(message.eventId, prior) > 0) {
              lastEventIdRef.current.set(key, message.eventId);
            }
          }
          setLastMessage(message);

          if (message.type === "telemetry" && message.data) {
            setLatestTelemetry(message.data as object as TelemetryData);
          } else if (message.type === "telemetry_batch" && Array.isArray(message.data)) {
            // The server's TelemetryThrottler coalesces per-equipment pushes
            // into one "telemetry_batch" every 250ms (one entry per
            // equipment). Surface the newest entry for single-value
            // consumers; batch-aware consumers read `lastMessage`.
            const batch = message.data as unknown[];
            const newest = batch[batch.length - 1];
            if (newest) {
              setLatestTelemetry(newest as TelemetryData);
            }
          } else if (message.type === "alert_new" && message.data) {
            setLatestAlert(message.data as object as AlertData);
          } else if (message.type === "alerts_initial" && message.data) {
            // Handle initial alerts backlog from server
            setInitialAlerts(Array.isArray(message.data) ? (message.data as AlertData[]) : []);
          } else if (message.type === "alert_acknowledged" && message.data) {
            // Update the latest alert if it's the same one being acknowledged
            const ack = message.data as { alertId?: string; acknowledgedBy?: string };
            setLatestAlert((prevAlert) => {
              if (prevAlert && prevAlert.id === ack.alertId) {
                return {
                  ...prevAlert,
                  acknowledged: true,
                  acknowledgedBy: ack.acknowledgedBy,
                  acknowledgedAt: message.timestamp,
                };
              }
              return prevAlert;
            });
          } else if (message.type === "update_notification" && message.data) {
            // Handle software update notifications
            setLatestUpdate(message.data as object as UpdateNotificationData);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);

        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = () => {
        setIsConnecting(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnecting(false);
    }
  }, [url, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback(
    (channel: string) => {
      subscriptionsRef.current.add(channel);
      send({ type: "subscribe", channel });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      subscriptionsRef.current.delete(channel);
      send({ type: "unsubscribe", channel });
    },
    [send]
  );

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // When the in-memory auth token changes (login / logout / tenant switch), the
  // current socket is bound to the old tenant (or anonymous). Tear it down and
  // reconnect so the upgrade carries the new token and resolves the right org.
  useEffect(() => {
    return subscribeToApiSessionToken(() => {
      if (!autoConnect) {
        return;
      }
      disconnect();
      connect();
    });
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    lastMessage,
    latestTelemetry,
    latestAlert,
    latestUpdate,
    initialAlerts,
    send,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    connectionCount,
  };
}
