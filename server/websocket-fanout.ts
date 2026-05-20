/**
 * Push B2 — WebSocket fan-out abstraction.
 *
 * Wraps the "publish event, dispatch to clients, allow replay on
 * reconnect" surface so the WebSocket server does not care whether
 * delivery is single-instance (default) or multi-instance via Redis.
 *
 * See `docs/architecture/adr/002-websocket-fanout.md` for the why.
 *
 * Contract:
 *   - publish(channel, payload, orgId?) — emits an event with a
 *     monotonic `eventId`. Returns the event so the caller can stash
 *     the id (used by tests).
 *   - subscribe(channel, orgId?, handler) — handler fires for every
 *     event delivered to this node on that (orgId, channel) tuple,
 *     whether emitted locally or by a peer.
 *   - replaySince(channel, orgId, lastEventId) — returns events newer
 *     than `lastEventId` that are still inside the replay window.
 *   - close() — drops subscriptions and stops the trim timer.
 *
 * Two implementations live in this file:
 *   - InProcessFanoutBus (default) — single-process loopback with an
 *     in-memory ring buffer per (orgId, channel). The fallback when
 *     Redis is disabled or circuit-open.
 *   - The Redis-backed implementation lives in
 *     `./websocket-fanout-redis.ts` and is composed on top of this
 *     interface so callers never see two shapes.
 */

import { createLogger } from "./lib/structured-logger";

const logger = createLogger("WebsocketFanout");

/**
 * Sentinel orgId for genuinely system-wide broadcasts (e.g. software-
 * update notifications). Per-tenant fan-out resolves to the tenant's
 * own org id; this constant exists so the rare cross-tenant broadcasts
 * have a single, explicit address.
 */
export const SYSTEM_ORG_ID = "__system__";

/** 5-minute replay window — explicit per ADR 002. */
export const REPLAY_WINDOW_MS = 5 * 60 * 1000;

/** Task 91 — multi-tenant WebSocket isolation across multiple servers.
 *
 *  When strict mode is on, the WS substrate refuses to deliver any
 *  event with `orgId === SYSTEM_ORG_ID` to client sockets. Callers
 *  that try to publish on the SYSTEM namespace get a warning + stack
 *  reference instead of a silent cross-tenant broadcast.
 *
 *  Default off (so legacy single-tenant + dev deploys keep working);
 *  set `WS_TENANT_STRICT_MODE=true` in production multi-server deploys
 *  to enforce per-tenant addressing. The env var is read at call time
 *  rather than module load so tests can toggle it. */
export function isTenantStrictModeEnabled(): boolean {
  const raw = process.env.WS_TENANT_STRICT_MODE;
  if (!raw) return false;
  const normalised = raw.trim().toLowerCase();
  return normalised === "1" || normalised === "true" || normalised === "yes" || normalised === "on";
}

export interface FanoutEvent {
  /** Monotonic across (orgId, channel). Format mirrors Redis Streams
   *  IDs: `<unix-ms>-<seq>` so they sort lexicographically and round-
   *  trip cleanly between the in-process and Redis implementations. */
  eventId: string;
  orgId: string;
  channel: string;
  payload: unknown;
  /** Wall-clock at publish time; used for window trimming. */
  timestampMs: number;
}

export type FanoutHandler = (event: FanoutEvent) => void;

export interface FanoutBus {
  publish(channel: string, payload: unknown, orgId?: string): Promise<FanoutEvent>;
  subscribe(channel: string, orgId: string, handler: FanoutHandler): () => void;
  replaySince(channel: string, orgId: string, lastEventId: string | null): Promise<FanoutEvent[]>;
  close(): Promise<void>;
}

/** Build an event id that sorts lexicographically and matches the
 *  Redis Streams `<ms>-<seq>` format so the two bus implementations
 *  hand out compatible cursors. */
export function makeEventId(timestampMs: number, seq: number): string {
  return `${timestampMs}-${seq}`;
}

export function compareEventIds(a: string, b: string): number {
  const [aMs, aSeq] = a.split("-").map((n) => Number.parseInt(n, 10));
  const [bMs, bSeq] = b.split("-").map((n) => Number.parseInt(n, 10));
  if (aMs !== bMs) return aMs - bMs;
  return aSeq - bSeq;
}

/** Bounded ring buffer keyed by (orgId, channel). Drops events older
 *  than the configured window on every read so memory cannot grow
 *  unboundedly in long-lived processes. */
class ReplayRing {
  private readonly buckets = new Map<string, FanoutEvent[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxPerBucket: number = 10_000,
  ) {}

  private key(orgId: string, channel: string): string {
    return `${orgId}::${channel}`;
  }

  append(event: FanoutEvent): void {
    const key = this.key(event.orgId, event.channel);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(event);
    if (bucket.length > this.maxPerBucket) {
      bucket.splice(0, bucket.length - this.maxPerBucket);
    }
  }

  /** Returns events newer than `lastEventId` (exclusive). Null means
   *  "everything still in the window". Trims expired entries on read. */
  since(orgId: string, channel: string, lastEventId: string | null): FanoutEvent[] {
    const key = this.key(orgId, channel);
    const bucket = this.buckets.get(key);
    if (!bucket) return [];

    const cutoff = Date.now() - this.windowMs;
    while (bucket.length > 0 && bucket[0].timestampMs < cutoff) {
      bucket.shift();
    }
    if (bucket.length === 0) {
      this.buckets.delete(key);
      return [];
    }

    if (!lastEventId) return bucket.slice();
    return bucket.filter((e) => compareEventIds(e.eventId, lastEventId) > 0);
  }

  trimAll(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      while (bucket.length > 0 && bucket[0].timestampMs < cutoff) {
        bucket.shift();
      }
      if (bucket.length === 0) this.buckets.delete(key);
    }
  }
}

/** Sequence-number generator scoped per (orgId, channel) per
 *  millisecond so two publishes in the same ms still get distinct
 *  monotonic ids. */
class SeqGen {
  private lastMs = 0;
  private seq = 0;

  next(nowMs: number): number {
    if (nowMs === this.lastMs) {
      this.seq += 1;
    } else {
      this.lastMs = nowMs;
      this.seq = 0;
    }
    return this.seq;
  }
}

/** Default fan-out bus: single-process loopback. Honours the same
 *  interface as the Redis bus so the WS server is substrate-agnostic. */
export class InProcessFanoutBus implements FanoutBus {
  protected readonly ring: ReplayRing;
  protected readonly seqs = new Map<string, SeqGen>();
  protected readonly handlers = new Map<string, Set<FanoutHandler>>();
  private trimTimer: NodeJS.Timeout | null = null;

  constructor(windowMs: number = REPLAY_WINDOW_MS) {
    this.ring = new ReplayRing(windowMs);
    // Trim the buckets periodically so memory tracks the window even
    // when readers never query (e.g. orphaned channels).
    this.trimTimer = setInterval(() => this.ring.trimAll(), Math.min(windowMs, 60_000));
    if (typeof this.trimTimer.unref === "function") this.trimTimer.unref();
  }

  protected handlerKey(orgId: string, channel: string): string {
    return `${orgId}::${channel}`;
  }

  protected nextEventId(orgId: string, channel: string): string {
    const key = this.handlerKey(orgId, channel);
    let gen = this.seqs.get(key);
    if (!gen) {
      gen = new SeqGen();
      this.seqs.set(key, gen);
    }
    const now = Date.now();
    return makeEventId(now, gen.next(now));
  }

  async publish(channel: string, payload: unknown, orgId: string = SYSTEM_ORG_ID): Promise<FanoutEvent> {
    const event: FanoutEvent = {
      eventId: this.nextEventId(orgId, channel),
      orgId,
      channel,
      payload,
      timestampMs: Date.now(),
    };
    this.ring.append(event);
    this.dispatch(event);
    return event;
  }

  /** Hook for the Redis subclass to dispatch incoming peer events
   *  through the same local handler set as locally-published events. */
  protected dispatch(event: FanoutEvent): void {
    const handlers = this.handlers.get(this.handlerKey(event.orgId, event.channel));
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        logger.warn("fanout handler threw", { err: String(err), channel: event.channel });
      }
    }
  }

  subscribe(channel: string, orgId: string, handler: FanoutHandler): () => void {
    const key = this.handlerKey(orgId, channel);
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(handler);
    return () => {
      const s = this.handlers.get(key);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) this.handlers.delete(key);
    };
  }

  async replaySince(
    channel: string,
    orgId: string,
    lastEventId: string | null,
  ): Promise<FanoutEvent[]> {
    return this.ring.since(orgId, channel, lastEventId);
  }

  async close(): Promise<void> {
    if (this.trimTimer) {
      clearInterval(this.trimTimer);
      this.trimTimer = null;
    }
    this.handlers.clear();
    this.seqs.clear();
  }
}

let activeBus: FanoutBus | null = null;

/** Singleton accessor — boot wires the Redis-backed bus when
 *  `WS_REDIS_FANOUT=true`, else returns the in-process default. */
export function getFanoutBus(): FanoutBus {
  if (!activeBus) {
    activeBus = new InProcessFanoutBus();
  }
  return activeBus;
}

export function setFanoutBus(bus: FanoutBus | null): void {
  activeBus = bus;
}
