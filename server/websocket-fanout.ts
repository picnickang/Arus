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
 *  Defaults: ON in production (`NODE_ENV === "production"`) so multi-
 *  tenant production deployments are safe by default; OFF in
 *  development/test so single-tenant dev flows keep working. Operators
 *  can always force the value explicitly via `WS_TENANT_STRICT_MODE`
 *  (`true`/`false`). The env var is read at call time rather than at
 *  module load so tests can toggle it. */
export function isTenantStrictModeEnabled(): boolean {
  const raw = process.env['WS_TENANT_STRICT_MODE'];
  if (raw && raw.trim().length > 0) {
    const normalised = raw.trim().toLowerCase();
    if (normalised === "1" || normalised === "true" || normalised === "yes" || normalised === "on") {
      return true;
    }
    if (normalised === "0" || normalised === "false" || normalised === "no" || normalised === "off") {
      return false;
    }
  }
  // Production-safe default: tenant-isolated fan-out unless explicitly
  // disabled. Dev/test keep historical behaviour.
  return process.env['NODE_ENV'] === "production";
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
  /**
   * P2 #30 — Correlation ID threaded through the event spine so
   * downstream subscribers (audit, tool-call traces, log
   * aggregation) can stitch a single user action across services.
   * Optional because legacy publishers may not yet pass it; when
   * absent the event is still valid. Producers that already build
   * `DomainEventEnvelope` should forward `envelope.correlationId`.
   */
  correlationId?: string | undefined;
}

export type FanoutHandler = (event: FanoutEvent) => void;

/** Optional metadata for `publish`. Producers can omit it entirely
 *  for backwards compatibility; populating `correlationId` lets the
 *  receiver join the event back to the originating request. */
export interface FanoutPublishOptions {
  correlationId?: string | undefined;
}

export interface FanoutBus {
  publish(
    channel: string,
    payload: unknown,
    orgId?: string,
    options?: FanoutPublishOptions,
  ): Promise<FanoutEvent>;
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
  const [aMs = 0, aSeq = 0] = a.split("-").map((n) => Number.parseInt(n, 10));
  const [bMs = 0, bSeq = 0] = b.split("-").map((n) => Number.parseInt(n, 10));
  if (aMs !== bMs) return aMs - bMs;
  return aSeq - bSeq;
}

/** Default per-bucket byte budget for the WS replay ring. A long-lived
 *  process with thousands of subscribed (org, channel) tuples and large
 *  event payloads (telemetry batches, ML explainability blobs) could
 *  retain hundreds of MB even with the 10k-event count cap. The byte
 *  cap is checked on append; oldest events are evicted until the
 *  bucket fits the budget. Read with `REPLAY_RING_MAX_BYTES_PER_BUCKET`
 *  at module load so ops can tune without a code change. */
const DEFAULT_REPLAY_BYTES_PER_BUCKET = 5 * 1024 * 1024;
function envBytes(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Best-effort byte cost of a FanoutEvent. We don't JSON.stringify on
 *  every append (hot path) — instead we estimate by walking primitive
 *  shapes and falling back to a coarse stringify only when the payload
 *  is non-primitive. The estimate intentionally over-counts slightly
 *  (object overhead, key strings) so we evict early rather than late. */
function estimateEventBytes(event: FanoutEvent): number {
  let bytes = 64; // eventId + orgId + channel + timestamp overhead
  bytes += event.eventId.length * 2;
  bytes += event.orgId.length * 2;
  bytes += event.channel.length * 2;
  const p = event.payload;
  if (p == null) {
    return bytes;
  }
  if (typeof p === "string") {
    return bytes + p.length * 2;
  }
  if (typeof p === "number" || typeof p === "boolean") {
    return bytes + 8;
  }
  try {
    return bytes + JSON.stringify(p).length * 2;
  } catch {
    return bytes + 256;
  }
}

interface RingBucket {
  events: FanoutEvent[];
  bytes: number;
}

/** Bounded ring buffer keyed by (orgId, channel). Drops events older
 *  than the configured window on every read AND enforces a hard
 *  per-bucket byte budget on every append so memory cannot grow
 *  unboundedly in long-lived processes — even with large payloads. */
class ReplayRing {
  private readonly buckets = new Map<string, RingBucket>();
  private readonly maxBytesPerBucket: number;

  constructor(
    private readonly windowMs: number,
    private readonly maxPerBucket: number = 10_000,
    maxBytesPerBucket: number = envBytes(
      "WS_REPLAY_RING_BYTES_PER_BUCKET",
      DEFAULT_REPLAY_BYTES_PER_BUCKET,
    ),
  ) {
    this.maxBytesPerBucket = maxBytesPerBucket;
  }

  private key(orgId: string, channel: string): string {
    return `${orgId}::${channel}`;
  }

  append(event: FanoutEvent): void {
    const key = this.key(event.orgId, event.channel);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { events: [], bytes: 0 };
      this.buckets.set(key, bucket);
    }
    const eventBytes = estimateEventBytes(event);
    bucket.events.push(event);
    bucket.bytes += eventBytes;
    // Enforce count cap.
    while (bucket.events.length > this.maxPerBucket && bucket.events.length > 0) {
      const dropped = bucket.events.shift();
      if (dropped) {
        bucket.bytes = Math.max(0, bucket.bytes - estimateEventBytes(dropped));
      }
    }
    // Enforce byte cap. Always keep at least the just-appended event
    // so a single oversize payload doesn't disappear before any reader
    // can replay it — newest-message preservation.
    while (bucket.bytes > this.maxBytesPerBucket && bucket.events.length > 1) {
      const dropped = bucket.events.shift();
      if (dropped) {
        bucket.bytes = Math.max(0, bucket.bytes - estimateEventBytes(dropped));
      }
    }
  }

  /** Returns events newer than `lastEventId` (exclusive). Null means
   *  "everything still in the window". Trims expired entries on read. */
  since(orgId: string, channel: string, lastEventId: string | null): FanoutEvent[] {
    const key = this.key(orgId, channel);
    const bucket = this.buckets.get(key);
    if (!bucket) return [];

    this.trimExpired(bucket);
    if (bucket.events.length === 0) {
      this.buckets.delete(key);
      return [];
    }

    if (!lastEventId) return bucket.events.slice();
    return bucket.events.filter((e) => compareEventIds(e.eventId, lastEventId) > 0);
  }

  private trimExpired(bucket: RingBucket): void {
    const cutoff = Date.now() - this.windowMs;
    while (bucket.events.length > 0 && (bucket.events[0]?.timestampMs ?? 0) < cutoff) {
      const dropped = bucket.events.shift();
      if (dropped) {
        bucket.bytes = Math.max(0, bucket.bytes - estimateEventBytes(dropped));
      }
    }
  }

  trimAll(): void {
    for (const [key, bucket] of this.buckets) {
      this.trimExpired(bucket);
      if (bucket.events.length === 0) this.buckets.delete(key);
    }
  }

  /** Test/observability hook: total bytes currently retained across
   *  all buckets. Not part of the FanoutBus public contract. */
  totalBytes(): number {
    let sum = 0;
    for (const bucket of this.buckets.values()) {
      sum += bucket.bytes;
    }
    return sum;
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

  async publish(
    channel: string,
    payload: unknown,
    orgId: string = SYSTEM_ORG_ID,
    options?: FanoutPublishOptions,
  ): Promise<FanoutEvent> {
    const event: FanoutEvent = {
      eventId: this.nextEventId(orgId, channel),
      orgId,
      channel,
      payload,
      timestampMs: Date.now(),
      ...(options?.correlationId !== undefined && { correlationId: options.correlationId }),
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
