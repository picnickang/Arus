# ADR 002 — WebSocket Fan-out Substrate

**Status:** Accepted
**Date:** 2026-05-19
**Push:** B2 — WebSocket Fan-out & Horizontal Scale
**Deciders:** ARUS Platform engineering

## Context

`server/websocket.ts` runs as a single `TelemetryWebSocketServer` inside
one Node process. Every broadcast iterates a local `Map<clientId, ws>`
and writes to whichever sockets happen to be connected to _this_
instance. The deployment consequences are explicit in the Push B
sequencing doc:

- We cannot scale horizontally — a second Node instance sees a disjoint
  client set and broadcasts disappear into the wrong process.
- The load balancer therefore requires sticky sessions on `/ws`, which
  cascades into needing sticky sessions for everything that shares the
  same hostname.
- A single Node restart drops every WebSocket — the audit's Top-Risk #4.

We need a fan-out substrate that lets N instances share one logical
WebSocket surface, plus a short replay buffer so a client reconnecting
after a brief disconnect does not lose events.

## Requirements

1. **Cross-instance delivery in ≤100ms** — an alert published on node A
   reaches a client connected to node B within the same operator
   perception window as today's in-process delivery.
2. **Tenant partitioning** — channels are addressed as
   `arus:ws:${orgId}:${channel}` so each node only subscribes to the
   tenant traffic its connected clients actually need. Honours the Push
   B1 RLS contract: a node that has no client for tenant X never
   receives tenant X's events.
3. **5-minute replay** — a client that disconnects for up to 5 minutes
   can reconnect with `lastEventId` and receive every event it missed,
   ordered, exactly once. Longer windows belong to the event-streaming
   spine (B3), not the WS layer.
4. **Graceful degradation** — when the substrate is unreachable, the
   server must fall back to single-instance broadcast (matching the
   existing `redis-client.ts` circuit-breaker pattern). The application
   keeps working in a degraded "no horizontal scale, no replay" mode
   rather than failing closed.
5. **No new operational system** — adding a fourth stateful service to
   the platform (after Postgres, Redis, optional TimescaleDB) is a
   meaningful tax we should only pay for capabilities we cannot get
   from the existing stack.

## Options considered

### Option A — Redis Pub/Sub + Redis Streams (chosen)

- Redis is already a project dependency (`server/lib/redis-client.ts`,
  rate limiter, cache). No new infra, no new credentials, no new on-call
  rotation.
- `PUBLISH arus:ws:${orgId}:${channel}` fans out to every subscribed
  Node instance in one network hop. Latency on the same VPC is
  consistently sub-10ms.
- Replay piggybacks on **Redis Streams**: every published event is also
  `XADD`ed to `arus:wsstream:${orgId}:${channel}` with `MAXLEN ~ 10000`
  (approx-trim, O(1) amortised) and a periodic `XADD ... MINID ~ <ts>`
  call trims by timestamp to enforce the 5-minute window. Replay is a
  single `XRANGE (lastEventId +`.
- Redis Streams generate monotonic `<ms>-<seq>` IDs server-side, which
  doubles as the `eventId` we hand to clients — no extra ID-generation
  protocol.
- **Risks:** Pub/Sub is fire-and-forget — if a Node instance is GC-
  pausing past its socket buffer, it will miss the live event but
  still has the stream as a recovery surface (each instance can
  periodically `XRANGE (lastSeenId +` to catch up on any missed live
  publishes). Redis itself is not multi-AZ in our current dev
  deployment; production must run Redis with at least one replica.
  The 5-min replay window is a deliberate cap — anything longer goes
  to Push B3.

### Option B — NATS JetStream

- Purpose-built for pub/sub with persistent streams. Replay semantics
  are first-class (durable consumers, ack-based delivery, multi-day
  windows out of the box).
- Adds a second stateful system to the platform — new ops surface, new
  backup/restore runbook, new failure mode for the deployment readme,
  new monitoring/alerting integration. Equivalent to taking on Neo4j
  (rejected for the same reason in ADR 001).
- The capabilities NATS uniquely offers (multi-day replay, ack-based
  delivery, exactly-once across consumers) belong to the event-
  streaming spine (Push B3), not the WS fan-out. Using JetStream for
  WS would mean owning a streaming bus before we've decided what the
  spine substrate is — premature.

### Option C — Sticky sessions + larger single instance

- Considered and rejected. "Just don't scale horizontally" caps the
  platform's growth and forces every UX-noisy tenant (telemetry-heavy
  vessels) to share resource contention with quiet tenants. Also
  defeats the Push B1 SaaS premise.

## Decision

**Adopt Option A — Redis Pub/Sub for live fan-out + Redis Streams for
replay.** The decisive factors are (1) zero new operational systems,
(2) capability-fit: 5-min replay is exactly what Streams' approximate-
trim gives us cheaply, and (3) the cleanest dependency story — Push B3
will introduce a real streaming spine, and we want to keep the WS
layer thin so it can sit on top of whatever spine we pick without
needing to migrate again.

## Consequences

- The fan-out substrate is **opt-in** via `WS_REDIS_FANOUT=true` for the
  same reason the graph and TimescaleDB are opt-in: existing single-
  instance dev deployments must keep booting unchanged. When the flag
  is on and Redis is reachable, broadcasts go via Redis; when the flag
  is off (default) or Redis is circuit-open, broadcasts fall back to
  in-process delivery + an in-memory ring buffer for replay.
- Each event the server emits gets a monotonic `eventId`. Clients
  remember the highest `eventId` per channel and send it on reconnect.
  Replay is **idempotent by `eventId`** — a client that receives the
  same event live and via replay must dedupe on the cursor, not on
  payload identity.
- Per-tenant channel partitioning (`arus:ws:${orgId}:${channel}`) is
  the substrate's first-class addressing scheme. A node only
  `SUBSCRIBE`s to the channels its connected clients actually use, so
  per-tenant traffic stays per-tenant in the wire-protocol — defence-
  in-depth on top of the Push B1 RLS layer.
- **orgId binding at handshake.** Every `/ws` upgrade resolves the
  tenant from the connecting user's session token (passed as
  `?token=…` on the URL, since browsers cannot set Authorization
  headers on the native WebSocket constructor). In
  `REQUIRE_TENANT_AUTH=true` mode anonymous or unknown-token upgrades
  are closed with WebSocket policy-violation (1008). In legacy single-
  tenant mode, a missing token lands in `DEFAULT_ORG_ID` to preserve
  pre-B1 behaviour. The token lookup uses the same session-token
  hashing as the HTTP auth path (`server/security/authentication.ts`),
  so the two paths cannot drift in what they accept.
- **Migration window for existing broadcasts.** The existing
  `broadcast(channel, payload)` API still publishes to `SYSTEM_ORG_ID`
  because the dozens of call sites haven't been migrated to pass an
  explicit `orgId` yet. To keep these reaching their audience, every
  client dual-subscribes: once to `(client.orgId, channel)` for
  tenant-scoped publishers, and once to `(SYSTEM_ORG_ID, channel)` for
  the legacy ones. Migrating a call site to publish per-tenant is a
  one-line change; when every call site is migrated, the
  SYSTEM*ORG_ID sub can be removed and isolation becomes strict at the
  substrate layer. Until that migration completes, operators should
  understand that tenant-scoped \_delivery* is enforced but tenant-
  scoped _publishing_ is best-effort — tracked as a follow-up.
- **Canonical event ids are Redis-assigned.** When the Redis adapter is
  active, `XADD *` assigns the `<ms>-<seq>` id atomically server-side
  and that id is what gets dispatched locally and published to peers.
  This is immune to clock skew or concurrent publish across nodes —
  every subscriber, regardless of which node delivered the frame, sees
  the same `eventId` and the same replay cursor.
- **Reconnect-with-replay is race-safe.** The WS server buffers live
  events on a per-(client, channel) basis while replay is in flight,
  then drains the buffer through a `deliveredUpTo` cursor check so any
  event already covered by the replay window is dropped before reaching
  the socket. The client never has to dedupe payloads; advancing its
  own `lastEventId` is enough.
- Load balancers may now round-robin `/ws` upgrades. Sticky-session
  configuration becomes legacy and is documented for removal in
  `docs/operations/websocket-scale-out.md`.
- Autoscale signal for `/ws`-serving instances is CPU + WS connection
  count (the existing `setWebSocketConnections` Prometheus gauge).
  Replit deployment autoscale config is documented alongside the
  sticky-session removal note.
- Existing non-tenant-scoped broadcasts (e.g. `broadcastUpdateNotification`
  for software updates, which is genuinely system-wide) publish on a
  sentinel `system` org id so every node receives them. These calls are
  rare and explicit.

## Out of scope

- Multi-region WS fan-out. Single Redis primary, single region — multi-
  region is a different problem (geo-routing the upgrade, conflict
  resolution between primaries) and belongs to a later push.
- Replacing the WS protocol with SSE or HTTP/3.
- Per-message persistence beyond 5 minutes — that is Push B3.
- Migrating the existing broadcast call sites away from their channel
  conventions. The fan-out adapter accepts the same `(channel, payload)`
  shape; the orgId partitioning is layered on top, defaulting to the
  authenticated client's claim.

## References

- `server/lib/redis-client.ts` — the circuit-breaker pattern this ADR
  mirrors for graceful degradation.
- `server/websocket.ts` — the in-process broadcast being wrapped.
- `docs/architecture/strategic-pushes-sequencing.md` §B2.
- ADR 001 — Knowledge Graph Substrate Choice (sets the "opt-in
  extension, fall back gracefully" pattern this ADR adopts).
- Redis Streams reference — https://redis.io/docs/data-types/streams/
