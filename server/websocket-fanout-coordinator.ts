import { WebSocket } from "ws";
import { createLogger } from "./lib/structured-logger";
import {
  FanoutBus,
  FanoutEvent,
  SYSTEM_ORG_ID,
  compareEventIds,
  isTenantStrictModeEnabled,
} from "./websocket-fanout";
import {
  BroadcastPayload,
  WebSocketClient,
  deliveryKey,
} from "./websocket-types";

type LogFn = (message: string) => void;

const logger = createLogger("Websocket");

export class WebSocketFanoutCoordinator {
  private readonly fanoutSubs = new Map<string, { count: number; unsubscribe: () => void }>();

  constructor(
    private readonly fanout: FanoutBus,
    private readonly clients: Map<string, WebSocketClient>,
    private readonly log: LogFn
  ) {}

  acquireClientFanoutSubs(client: WebSocketClient, channel: string): void {
    this.acquireFanoutSub(client.orgId, channel);
    if (client.orgId !== SYSTEM_ORG_ID && !isTenantStrictModeEnabled()) {
      this.acquireFanoutSub(SYSTEM_ORG_ID, channel);
    }
  }

  releaseClientFanoutSubs(client: WebSocketClient, channel: string): void {
    this.releaseFanoutSub(client.orgId, channel);
    if (client.orgId !== SYSTEM_ORG_ID && !isTenantStrictModeEnabled()) {
      this.releaseFanoutSub(SYSTEM_ORG_ID, channel);
    }
  }

  releaseAllClientFanoutSubs(client: WebSocketClient): void {
    for (const channel of client.subscriptions) {
      this.releaseClientFanoutSubs(client, channel);
    }
    client.subscriptions.clear();
    client.delivery.clear();
  }

  drainBuffer(client: WebSocketClient, orgId: string, channel: string): void {
    const state = client.delivery.get(deliveryKey(orgId, channel));
    if (!state) {
      return;
    }
    const pending = state.buffer;
    state.buffer = [];
    pending.sort((a, b) => compareEventIds(a.eventId, b.eventId));
    for (const event of pending) {
      this.sendEvent(client, event);
    }
  }

  async replayToClient(
    client: WebSocketClient,
    orgId: string,
    channel: string,
    lastEventId: string
  ): Promise<void> {
    try {
      const events = await this.fanout.replaySince(channel, orgId, lastEventId);
      if (events.length > 0) {
        this.log(`Replaying ${events.length} event(s) to ${client.id} on ${orgId}:${channel}`);
        for (const event of events) {
          if (client.ws.readyState !== WebSocket.OPEN) {
            return;
          }
          this.sendEvent(client, event);
        }
      }
    } finally {
      const state = client.delivery.get(deliveryKey(orgId, channel));
      if (state) {
        state.replaying = false;
        this.drainBuffer(client, orgId, channel);
      }
    }
  }

  broadcast(channel: string, data: BroadcastPayload, orgId?: string): void {
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
      this.log(`fanout publish failed: ${err}`);
    });
  }

  close(): void {
    this.releaseSubscriptions();
    this.closeFanout();
  }

  releaseSubscriptions(): void {
    for (const { unsubscribe } of this.fanoutSubs.values()) {
      try {
        unsubscribe();
      } catch {
        /* best effort */
      }
    }
    this.fanoutSubs.clear();
  }

  closeFanout(): void {
    void this.fanout.close().catch((err) => {
      this.log(`fanout close failed: ${err}`);
    });
  }

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
    if (!existing) {
      return;
    }
    existing.count -= 1;
    if (existing.count <= 0) {
      existing.unsubscribe();
      this.fanoutSubs.delete(key);
    }
  }

  private onFanoutEvent(event: FanoutEvent): void {
    if (event.orgId === SYSTEM_ORG_ID && isTenantStrictModeEnabled()) {
      return;
    }
    this.clients.forEach((client) => {
      if (event.orgId !== client.orgId && event.orgId !== SYSTEM_ORG_ID) {
        return;
      }
      if (!client.subscriptions.has(event.channel)) {
        return;
      }
      if (client.ws.readyState !== WebSocket.OPEN) {
        return;
      }

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
      return false;
    }
    const frame = JSON.stringify(
      this.envelope(event.payload as BroadcastPayload, event.channel, event.eventId, event.orgId)
    );
    try {
      client.ws.send(frame);
      if (state) {
        state.deliveredUpTo = event.eventId;
      }
      return true;
    } catch (error) {
      this.log(`Failed to send to client ${client.id}: ${error}`);
      return false;
    }
  }

  private envelope(
    payload: BroadcastPayload,
    channel: string,
    eventId: string,
    orgId: string
  ): Record<string, unknown> {
    const base =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : { data: payload };
    return { ...base, eventId, channel, orgId };
  }
}
