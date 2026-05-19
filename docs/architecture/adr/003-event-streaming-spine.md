# ADR 003 — Event-Streaming Spine

**Status:** Accepted
**Date:** 2026-05-19
**Track:** Push B3 (audit Top-Risk #6 — async-coupling becomes spaghetti at fleet scale)
**Depends on:** Push B1 (auth-derived `orgId` on every domain event envelope)

## Context

The consolidated v2 domain event bus (`server/lib/domain-event-bus/`) is an in-process
`EventEmitter` singleton. Today every cross-cutting concern (sync journal, MQTT
fan-out, scheduler bridge, reverse legacy bridge) is a subscriber that runs in the
same Node process as the emitter. That works for a single node but has three
structural problems:

1. **No durability.** If the process crashes between a DB commit and the in-process
   `emit()`, the event is lost. The sync_journal/sync_outbox path runs *after*
   emit and is itself non-transactional w.r.t. the business write.
2. **No analytics substrate.** Telemetry analytics queries hit the OLTP database,
   competing with operational reads. There is nowhere for an analytics consumer
   to subscribe to a durable, partitioned stream without scraping OLTP.
3. **No CDC.** Postgres WAL changes are invisible to downstream consumers.
   Rebuilding a denormalised read model means double-writes from application
   code, which drifts.

This ADR picks the streaming substrate, the publish contract, and the rollout
strategy. **The in-process bus is not replaced** — it stays the fast path for
in-process consumers (sync journal, scheduler, MQTT). The streaming spine is an
*additive* durable layer on top.

## Decision

### 1. Substrate: Redpanda

| Candidate           | Pros                                                                                        | Cons                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Apache Kafka**    | Reference implementation; richest ecosystem (Connect, Streams, Schema Registry); battle-tested at scale. | Heavy ops burden (Zookeeper or KRaft + JVM tuning); 3-node minimum for HA; disk-hungry.            |
| **Redpanda**        | **Kafka API wire-compatible** → same client libraries (`kafkajs`); single Go binary, no Zookeeper; single-node dev mode; per-partition Raft. | Smaller ecosystem than Kafka; commercial features (tiered storage) behind paywall.                  |
| **NATS JetStream**  | Lightweight, simple ops, good for request/reply + streaming.                                | Different protocol — can't reuse Kafka clients; weaker partitioned-ordering story; smaller analytics ecosystem (no Debezium sink). |

**Choice: Redpanda.** Decisive factors:

- **Kafka wire-compatibility** means we depend on `kafkajs` (a stable, popular
  Node client) and can switch to Apache Kafka with zero code change if
  operational reasons demand it later. The application code never knows.
- **Single binary, no Zookeeper** dramatically lowers the bar for self-hosted
  customers and our own staging environment.
- **Debezium has a Kafka-protocol sink** → free CDC story (Step 4 below).

### 2. Publish contract: transactional outbox, partitioned by `orgId`

Direct publish from request handlers is forbidden — a network blip after DB
commit drops the message. Every domain event takes the **outbox-then-publish**
path:

```
┌─────────────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Service layer           │    │ event_outbox     │    │ EventSpineWorker │
│  (inside DB tx)         │───▶│   (Postgres)     │───▶│   (poll, dispatch)│
│  enqueueOutbox(tx, env) │    │                  │    │                  │
└─────────────────────────┘    └──────────────────┘    └────────┬─────────┘
                                                                │
                                                                ▼
                                                       ┌──────────────────┐
                                                       │ EventSpineProducer│
                                                       │ (Kafka API)       │
                                                       │ partition: orgId  │
                                                       └────────┬──────────┘
                                                                │
                                                                ▼
                                                       ┌──────────────────┐
                                                       │ Redpanda topics  │
                                                       │ topic-per-event  │
                                                       └──────────────────┘
```

- **Partition key is always `orgId`.** Never round-robin. Per-tenant ordering
  is a hard invariant — alarms, work-order status changes, and inventory
  movements must be consumed in causal order *within* a tenant. Cross-tenant
  ordering is intentionally not guaranteed.
- **Topic-per-event-type** (`work_order.created`, `telemetry.batch_ingested`,
  etc.). Consumers subscribe to the topics they care about; new consumers
  don't need to filter a firehose.
- **Idempotency key is the envelope's `eventId`** (already a UUID generated
  by `createDomainEvent`). Consumers MUST be idempotent — at-least-once is
  the only honest guarantee with worker retries.
- **In-process bus keeps emitting concurrently.** The outbox table is the
  durable substrate; the in-memory `domainEventBus.emit()` stays as the
  low-latency path for in-process consumers. Both fire on the same envelope.

### 3. First external consumer: telemetry → analytics sink

`telemetry.batch_ingested` and `telemetry.anomaly_detected` are streamed into
a sink consumer that writes NDJSON / Parquet to local disk (dev) or S3 / a
warehouse (prod). The default `LocalNdjsonSink` writes one file per day under
`data/analytics/telemetry/YYYY-MM-DD.ndjson` — good enough to prove the
contract and to let DuckDB / Polars query historical telemetry without
touching the OLTP database. The S3 / warehouse hookup is a follow-up (real
infra, env-gated).

### 4. CDC from Postgres

Out of scope for this PR — the streaming substrate, outbox, and one consumer
are the prerequisites. Once Redpanda is running in staging, **Debezium for
Postgres** plugs in directly because Debezium speaks Kafka protocol → Redpanda
is a drop-in target. The expected layout:

- One CDC topic per table (`pg.public.equipment`, `pg.public.work_orders`, …).
- Partition key on the CDC consumer side is `org_id` (Debezium routing SMT).
- Schema changes appear as Debezium schema-change events on a dedicated topic.

Tracked as a follow-up task (Push B3.4).

## Rollout strategy

1. **This PR.** Schema (`event_outbox`), outbox API, worker, no-op + in-memory
   producers, telemetry NDJSON sink consumer, bridge subscriber that captures
   every in-process domain event into the outbox (best-effort durability for
   emit sites that haven't been migrated to inline `enqueueOutbox`).
2. **Next PR.** Migrate `work-orders` and `maintenance` publisher adapters to
   call `enqueueOutbox(tx, envelope)` *inside* the service transaction. This
   upgrades "best effort capture via bridge" → "true transactional outbox" for
   those domains. Other domains migrate incrementally.
3. **Next PR.** `KafkaProducer` adapter (`kafkajs`), env-gated by
   `EVENT_SPINE_BROKERS`. Default stays `NoopProducer` so dev/test boot is
   unchanged. Production toggles by setting the broker list.
4. **Later.** Debezium for CDC; S3/warehouse sink swap; cutover of analytics
   queries off OLTP.

## Architectural constraints (enforced)

- Outbox-then-publish is the only acceptable pattern. The bridge subscriber
  is a transition mechanism, not the long-term contract — services should
  migrate to inline `enqueueOutbox(tx, envelope)` calls.
- `orgId` is the partition key. Always. Round-robin partitioning of
  tenant-scoped events is a tenant-isolation bug.
- The in-process bus is additive, never replaced. Subscribers that need
  sub-millisecond fan-out (websocket push, scheduler) stay in-process.
- All consumers must be idempotent on `eventId`.

## Consequences

- **Positive.** Durable event log; analytics decoupled from OLTP; CDC unblocked;
  pluggable producer means swapping Kafka↔Redpanda↔(eventually NATS) is a
  config flip; no regression on existing in-process consumers.
- **Negative.** Outbox table grows — needs a retention job (mark-published rows
  pruned after N days). Worker introduces a poll loop; tuned to 500ms by
  default with exponential backoff on empty queue. Operating a real broker is
  a new ops surface for self-hosted customers (mitigated by Redpanda's
  single-binary deploy).
- **Migration cost.** ~25 domain event emit sites. Most can be left to the
  bridge subscriber path indefinitely; only emit sites that need strict
  transactional safety (financial movements, GDPR deletes) need the inline
  `enqueueOutbox(tx, envelope)` migration.
