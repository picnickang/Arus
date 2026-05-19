/**
 * Push B2 — Redis-backed fan-out bus.
 *
 * Composes on top of `InProcessFanoutBus` so locally-published events
 * still dispatch to local handlers synchronously (sub-ms latency), and
 * peer publishes arrive via Redis Pub/Sub on a dedicated subscriber
 * connection.
 *
 * Replay buffer is a Redis Stream per (orgId, channel) trimmed by
 * approximate MAXLEN + a MINID timestamp trim that runs whenever a
 * publish happens (sampled, not every call, to keep `XADD` O(1)).
 *
 * Degrades to in-process behaviour when the shared Redis client is
 * circuit-open — same pattern as `server/lib/cache.ts`.
 */

import type Redis from "ioredis";
import { createLogger } from "./lib/structured-logger";
import { getSharedRedisClient } from "./lib/redis-client";
import {
  FanoutBus,
  FanoutEvent,
  FanoutHandler,
  InProcessFanoutBus,
  REPLAY_WINDOW_MS,
  SYSTEM_ORG_ID,
  compareEventIds,
} from "./websocket-fanout";

const logger = createLogger("WebsocketFanoutRedis");

const PUBSUB_PREFIX = "arus:ws:";
const STREAM_PREFIX = "arus:wsstream:";
/** Approximate cap so XADD stays O(1). Real eviction is MINID. */
const STREAM_MAXLEN = 10_000;
/** How often (in publishes per channel) we re-issue the MINID trim.
 *  Trimming on every publish is correct but wasteful; once every 50
 *  publishes is enough at our throughput. */
const TRIM_EVERY = 50;

function pubSubChannel(orgId: string, channel: string): string {
  return `${PUBSUB_PREFIX}${orgId}:${channel}`;
}

function streamKey(orgId: string, channel: string): string {
  return `${STREAM_PREFIX}${orgId}:${channel}`;
}

interface ParsedChannel {
  orgId: string;
  channel: string;
}

function parsePubSubChannel(raw: string): ParsedChannel | null {
  if (!raw.startsWith(PUBSUB_PREFIX)) return null;
  const tail = raw.slice(PUBSUB_PREFIX.length);
  const idx = tail.indexOf(":");
  if (idx <= 0) return null;
  return { orgId: tail.slice(0, idx), channel: tail.slice(idx + 1) };
}

export class RedisFanoutBus extends InProcessFanoutBus implements FanoutBus {
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private readonly subscribedChannels = new Map<string, number>();
  private readonly publishCounts = new Map<string, number>();
  private readonly windowMs: number;

  constructor(windowMs: number = REPLAY_WINDOW_MS) {
    super(windowMs);
    this.windowMs = windowMs;
  }

  /** Establish (or reuse) a duplicated connection for SUBSCRIBE so
   *  publish-side commands aren't blocked by the subscriber. */
  private async ensureClients(): Promise<{ publisher: Redis; subscriber: Redis } | null> {
    if (this.publisher && this.subscriber) {
      return { publisher: this.publisher, subscriber: this.subscriber };
    }
    const shared = await getSharedRedisClient();
    if (!shared) return null;

    this.publisher = shared;

    if (!this.subscriber) {
      try {
        // ioredis: `.duplicate()` is the canonical way to obtain a
        // connection that can be in subscriber mode without blocking
        // the publisher's request queue.
        const sub = shared.duplicate({ lazyConnect: true });
        await sub.connect();
        sub.on("error", (err) => {
          logger.warn("redis subscriber error", { err: String(err) });
        });
        sub.on("messageBuffer", (channelBuf: Buffer, messageBuf: Buffer) => {
          this.onPeerMessage(channelBuf.toString("utf8"), messageBuf.toString("utf8"));
        });
        this.subscriber = sub;
      } catch (err) {
        logger.warn("failed to open redis subscriber, degrading to in-process", {
          err: String(err),
        });
        return null;
      }
    }

    return { publisher: this.publisher, subscriber: this.subscriber };
  }

  private onPeerMessage(rawChannel: string, raw: string): void {
    const parsed = parsePubSubChannel(rawChannel);
    if (!parsed) return;
    let event: FanoutEvent;
    try {
      event = JSON.parse(raw) as FanoutEvent;
    } catch {
      logger.warn("malformed peer message", { rawChannel });
      return;
    }
    // The publishing node also dispatches locally (super.publish does
    // it via `dispatch` immediately) so we suppress the loopback to
    // avoid double-delivery. Loopback is detected by checking whether
    // the eventId is the last one *this* node published on that
    // (orgId, channel). Simpler: tag every published event with a
    // process-unique origin id and ignore matches.
    if ((event as FanoutEvent & { _origin?: string })._origin === this.originId) {
      return;
    }
    super["dispatch"](event);
  }

  private readonly originId = `node-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  async publish(
    channel: string,
    payload: unknown,
    orgId: string = SYSTEM_ORG_ID,
  ): Promise<FanoutEvent> {
    const clients = await this.ensureClients();
    if (!clients) {
      // Graceful degradation: Redis unavailable, fall back to the
      // single-node in-process path. Cross-node delivery stops; local
      // delivery and the in-memory replay ring keep working.
      return super.publish(channel, payload, orgId);
    }

    const wireChannel = pubSubChannel(orgId, channel);
    const wireStream = streamKey(orgId, channel);
    const now = Date.now();
    // Build the event WITHOUT a final id; the Redis Stream assigns the
    // canonical monotonic id (server-side, immune to clock skew across
    // Node instances). We use that id for the in-process ring + local
    // dispatch + the published pub/sub payload, so a client sees the
    // same eventId regardless of which node delivered it.
    const baseEvent: Omit<FanoutEvent, "eventId"> = {
      orgId,
      channel,
      payload,
      timestampMs: now,
    };

    let streamId: string;
    try {
      // XADD * — Redis assigns `<ms>-<seq>` atomically and guarantees
      // strict monotonicity per stream. This is the canonical id.
      const result = await clients.publisher.xadd(
        wireStream,
        "MAXLEN",
        "~",
        STREAM_MAXLEN,
        "*",
        "p",
        JSON.stringify(baseEvent),
      );
      if (!result) throw new Error("xadd returned null");
      streamId = result;
    } catch (err) {
      // Stream write failed — we must not let publish silently lose
      // the event from the replay window. Fall back to in-process so
      // local clients still see it and the in-memory ring still holds
      // it; cross-node peers will not see this one.
      logger.warn("redis xadd failed, falling back to in-process publish", {
        err: String(err),
        channel,
      });
      return super.publish(channel, payload, orgId);
    }

    const event: FanoutEvent = { ...baseEvent, eventId: streamId };
    // Mirror to the in-process ring so a quick reconnect to the same
    // node can answer replay without a Redis round-trip.
    (this as unknown as { ring: { append: (e: FanoutEvent) => void } }).ring.append(event);
    // Dispatch locally — synchronous, sub-ms.
    (this as unknown as { dispatch: (e: FanoutEvent) => void }).dispatch(event);

    // Fan out to peer nodes. The `_origin` tag suppresses the loopback
    // on peers that already dispatched locally above.
    const tagged: FanoutEvent & { _origin: string } = { ...event, _origin: this.originId };
    try {
      await clients.publisher.publish(wireChannel, JSON.stringify(tagged));
      this.bumpPublishCount(wireStream, clients.publisher);
    } catch (err) {
      // Peer publish failed but the event is durably in the stream;
      // peers will catch up via replay on their next subscribe or via
      // a future caught-up sweep. Local clients already got it.
      logger.warn("redis pub/sub publish failed (stream write succeeded)", {
        err: String(err),
        channel,
      });
    }
    return event;
  }

  private bumpPublishCount(streamName: string, publisher: Redis): void {
    const next = (this.publishCounts.get(streamName) ?? 0) + 1;
    if (next < TRIM_EVERY) {
      this.publishCounts.set(streamName, next);
      return;
    }
    this.publishCounts.set(streamName, 0);
    const minId = `${Date.now() - this.windowMs}-0`;
    // Fire-and-forget MINID trim — best-effort window enforcement.
    publisher.xadd(streamName, "MINID", "~", minId, "*", "trim", "1").catch(() => {});
  }

  subscribe(channel: string, orgId: string, handler: FanoutHandler): () => void {
    const localUnsub = super.subscribe(channel, orgId, handler);
    const wireChannel = pubSubChannel(orgId, channel);
    const count = (this.subscribedChannels.get(wireChannel) ?? 0) + 1;
    this.subscribedChannels.set(wireChannel, count);

    if (count === 1) {
      this.ensureClients()
        .then((clients) => {
          if (!clients) return;
          clients.subscriber.subscribe(wireChannel).catch((err) => {
            logger.warn("redis subscribe failed", { err: String(err), wireChannel });
          });
        })
        .catch(() => {});
    }

    return () => {
      localUnsub();
      const remaining = (this.subscribedChannels.get(wireChannel) ?? 1) - 1;
      if (remaining <= 0) {
        this.subscribedChannels.delete(wireChannel);
        if (this.subscriber) {
          this.subscriber.unsubscribe(wireChannel).catch(() => {});
        }
      } else {
        this.subscribedChannels.set(wireChannel, remaining);
      }
    };
  }

  async replaySince(
    channel: string,
    orgId: string,
    lastEventId: string | null,
  ): Promise<FanoutEvent[]> {
    const clients = await this.ensureClients();
    if (!clients) {
      // No Redis — answer from the in-process ring buffer.
      return super.replaySince(channel, orgId, lastEventId);
    }
    const key = streamKey(orgId, channel);
    const startInclusive = lastEventId ? `(${lastEventId}` : "-";
    try {
      const raw = (await clients.publisher.xrange(key, startInclusive, "+")) as Array<
        [string, string[]]
      >;
      const cutoff = Date.now() - this.windowMs;
      const events: FanoutEvent[] = [];
      for (const [id, fields] of raw) {
        const idx = fields.indexOf("p");
        if (idx === -1) continue;
        const serialised = fields[idx + 1];
        try {
          const event = JSON.parse(serialised) as FanoutEvent;
          if (event.timestampMs < cutoff) continue;
          // Defensive: id from the stream wins over the embedded one.
          event.eventId = id;
          events.push(event);
        } catch {
          // Skip malformed entries; don't poison the replay.
        }
      }
      // In-process ring may have events the stream missed if a publish
      // failed mid-flight; merge and de-dupe by eventId.
      const local = await super.replaySince(channel, orgId, lastEventId);
      if (local.length === 0) return events;
      const seen = new Set(events.map((e) => e.eventId));
      for (const e of local) if (!seen.has(e.eventId)) events.push(e);
      events.sort((a, b) => compareEventIds(a.eventId, b.eventId));
      return events;
    } catch (err) {
      logger.warn("redis replay failed, falling back to in-process ring", {
        err: String(err),
        channel,
      });
      return super.replaySince(channel, orgId, lastEventId);
    }
  }

  async close(): Promise<void> {
    await super.close();
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch {
        this.subscriber.disconnect();
      }
      this.subscriber = null;
    }
    // We do NOT close the shared publisher — it is owned by the
    // shared Redis client factory and reused across the process.
    this.publisher = null;
    this.subscribedChannels.clear();
    this.publishCounts.clear();
  }
}
