import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  clientId?: string;
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
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectCountRef.current = 0;
        setConnectionCount((prev) => prev + 1);

        // Re-subscribe to channels after reconnection
        subscriptionsRef.current.forEach((channel) => {
          ws.send(JSON.stringify({ type: "subscribe", channel }));
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.type === "telemetry" && message.data) {
            setLatestTelemetry(message.data as unknown as TelemetryData);
          } else if (message.type === "alert_new" && message.data) {
            setLatestAlert(message.data as unknown as AlertData);
          } else if (message.type === "alerts_initial" && message.data) {
            // Handle initial alerts backlog from server
            setInitialAlerts(Array.isArray(message.data) ? (message.data as AlertData[]) : []);
          } else if (message.type === "alert_acknowledged" && message.data) {
            // Update the latest alert if it's the same one being acknowledged
            setLatestAlert((prevAlert) => {
              if (prevAlert?.id === (message.data as any).alertId) {
                return {
                  ...prevAlert,
                  acknowledged: true,
                  acknowledgedBy: (message.data as any).acknowledgedBy,
                  acknowledgedAt: message.timestamp,
                } as any;
              }
              return prevAlert;
            });
          } else if (message.type === "update_notification" && message.data) {
            // Handle software update notifications
            setLatestUpdate(message.data as unknown as UpdateNotificationData);
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
