import type { WebSocket } from "ws";
import type { FanoutEvent } from "./websocket-fanout";

export type BroadcastPayload = Record<string, unknown> | unknown[];

export interface ChannelDeliveryState {
  replaying: boolean;
  buffer: FanoutEvent[];
  deliveredUpTo: string | null;
}

export function deliveryKey(orgId: string, channel: string): string {
  return `${orgId}::${channel}`;
}

export interface WebSocketClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  orgId: string;
  delivery: Map<string, ChannelDeliveryState>;
}

export interface WebSocketClientMessage {
  type?: string;
  channel?: string;
  lastEventId?: string | null;
  lastEventIds?: Record<string, string> | null;
}
