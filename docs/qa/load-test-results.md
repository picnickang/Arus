# Load Test Results

## Status

**Baseline recorded** (2026-06-10, commit `b6692a1`). All three HTTP k6 scenarios pass their
thresholds, and a telemetry **ingestion-path baseline** was captured via the admin stress-test
endpoint (which the k6 scenarios do not exercise — they only hit health/observability reads).

> **Scope caveat: sandbox/dev baseline — not production capacity.** Numbers below were measured
> in a development sandbox (single host, local PostgreSQL 16.13 + Redis 7, `npm run dev` server,
> k6 v2.0.0, default batch-writer tuning: `TELEMETRY_BATCH_INTERVAL_MS=500`,
> `TELEMETRY_MAX_BUFFER_SIZE=10000`, `TELEMETRY_DB_INSERT_CHUNK_SIZE=500`). They prove the
> harness works end-to-end and provide a first reference point; production capacity must be
> re-measured on production-shaped infrastructure (the nightly CI run is the canonical recurring
> baseline).

## Environment

| Component | Value |
|---|---|
| Server | `npm run dev` (`NODE_ENV=development`, `ARUS_DEV_LOGIN=1`), port 5000 |
| Database | PostgreSQL 16.13 (localhost), schema via `db:push` **+** `db:migrate` |
| Redis | redis 7 (localhost) |
| k6 | v2.0.0 (binary from GitHub releases; `dl.k6.io` was unreachable) |
| Rate limits | `DISABLE_RATE_LIMITS=true` for the recorded runs (see Findings #2) |

## k6 HTTP scenarios

| Scenario | VUs / duration | Endpoints | p95 | http_req_failed | Throughput | Thresholds |
|---|---|---|---|---|---|---|
| smoke | 1 VU, 30s | `/api/healthz`, `/api/readyz` | **7.95 ms** | 0.00% (0/60) | 2 req/s | ✅ p95<500ms, rate<1% |
| steady | 20→50 VUs, 5m | `/api/healthz`, web-vitals ping (authed) | **6.78 ms** | 0.00% (0/16,878) | 56 req/s | ✅ p95<800ms, rate<1% |
| spike | burst 100 VUs, ~90s | `/api/healthz` | **4.67 ms** | 0.00% (0/68,382) | **855 req/s** | ✅ p95<1500ms, rate<5% |

`node tests/load/check-thresholds.mjs artifacts/load` → all summaries contain passing thresholds.
Summary JSONs: `artifacts/load/{smoke,steady,spike}-summary.json` (not committed).

**ws_fanout: intentionally skipped** in this pass. It proves *cross-instance* WebSocket fan-out
and requires two server instances behind a shared Redis (`WS_REDIS_FANOUT=true`, ports 5001/5002);
a single-instance run would only measure loopback delivery and produce a misleading "pass". It has
a dedicated nightly (`.github/workflows/ws-fanout-nightly.yml`).

## Telemetry ingestion baseline (batch-writer path)

Driven via `POST /api/admin/telemetry/stress-test` (`useBatchWriter: true`), which queues into the
real `telemetryBatchWriter` singleton — the same path the SQLite bridge uses. 60s per rate step,
one equipment, default sensor set.

| Target rate | Achieved | Messages | Errors | Evicted | Dropped | Avg flush |
|---|---|---|---|---|---|---|
| 100 msg/s | 100/s | 6,000 | 0 | 0 | 0 | 206 ms |
| 500 msg/s | 500/s | 30,000 | 0 | 0 | 0 | 239 ms |
| 1,000 msg/s | 1,000/s | 60,000 | 0 | 0 | 0 | 198 ms |
| 2,000 msg/s | **2,000/s** | 120,000 | 0 | 0 | 0 | 140 ms |

- **The batch writer sustained the endpoint's maximum configurable rate (2,000 msg/s) with zero
  evictions, zero drops, zero errors** in this environment. The saturation point is above what
  this harness can generate; flush latency stayed well under the 500 ms flush interval at every
  step (i.e., the writer kept draining faster than it filled).
- **Dedup note (not data loss):** `equipment_telemetry` rows after the ladder = 11,971 vs 216k
  messages queued. Inserts conflict-skip on the natural key `(org_id, equipment_id, sensor_type, ts)`
  (`uq_equipment_telemetry_natural`, migration 0024), and the stress generator reuses timestamps
  within a tick, so most generated readings are natural-key duplicates. `totalFlushed` counts
  attempted rows; PostgreSQL silently skips duplicates by design. The collapse rate is now
  surfaced as `arus_telemetry_natural_key_conflicts_total` (`server/telemetry-batch-writer.ts`),
  because millisecond-resolution timestamps mean two GENUINE samples for one sensor in the
  same millisecond also collapse — acceptable at the documented 10 Hz per-sensor target,
  a hazard for future high-rate sources. Escalation path if a source legitimately needs
  sub-millisecond cadence: µs-resolution timestamps, or a sequence component added to the
  natural key by the agent.
- **Direct-write comparison** (`useBatchWriter: false`, per-row INSERTs): requested 200 msg/s,
  **achieved 122 msg/s** (3,663 rows in 30s, 0 errors) — the per-row path saturates ~16× below
  the batched path, confirming the batch writer is the right production default.

Raw responses and metric snapshots: `artifacts/load/ingest-*.json`,
`artifacts/load/ingest-metrics-*.txt` (not committed).

## Post-partitioning re-baseline (migrations/0038)

After `equipment_telemetry` was rebuilt as a natively partitioned table (monthly RANGE on `ts`,
migration 0038), the ingestion ladder was re-run against the live server with no restart:

| Target rate | Achieved | Errors | Evicted | Dropped | Avg flush (partitioned) | Avg flush (plain table) |
|---|---|---|---|---|---|---|
| 500 msg/s | 500/s | 0 | 0 | 0 | **149 ms** | 239 ms |
| 2,000 msg/s | 2,000/s | 0 | 0 | 0 | **120 ms** | 140 ms |

No regression — flush latency was equal or better, and `tableoid` checks confirmed every row
routed to the correct monthly partition. Retention's partition fast path was also exercised
end-to-end in this environment: an expired monthly partition (5,000 rows) was DETACH+DROPped and
3,000 backdated DEFAULT-partition rows were deleted in per-org batches.

## Findings & harness fixes made during this pass

1. **`db:push` alone is not a runnable schema.** A fresh database bootstrapped only with
   `npm run db:push` lacks `uq_equipment_telemetry_natural` (drizzle-kit does not see the raw-SQL
   index entries), so every telemetry insert fails on its `ON CONFLICT` target. Fresh
   environments must run `npm run db:push` **then** `npm run db:migrate`. `load-nightly.yml`
   was updated accordingly. (Migration `0002` was given column-existence guards so the historical
   ledger replays cleanly on fresh, current-schema databases.)
2. **The steady scenario cannot pass its own thresholds against default rate limits.** At 50 VUs
   (~55 req/s from one client IP), `GENERAL_API` (300 req/min) returns 429s → `http_req_failed`
   28–50%. First run recorded 9,462 `RATE_LIMIT_GENERAL` rejections — the limiter works as
   configured; the scenario thresholds assume it is off. Load runs must set
   `DISABLE_RATE_LIMITS=true` (added to `load-nightly.yml`). Limiter behavior itself is covered
   by unit tests, not load tests.
3. **Dev-login tokens are Bearer-only.** `steady.js` sent the session token solely as an
   `arus_session` cookie (the SSO format), so dev-login tokens never authenticated (50% 4xx).
   The script now sends `Authorization: Bearer` alongside the cookie.
4. **`requireAdminRole` rejects `super_admin`** (`server/security/authorization.ts:17` checks
   `role !== "admin"` strictly), so the dev-login admin persona (role `super_admin`) cannot call
   `/api/admin/telemetry/stress-test`. Baseline used a real `role='admin'` user via
   `/api/portal/login`. Flagged for a future authz review — not changed in this pass.

## Reproducing

```bash
# infra
service postgresql start && service redis-server start
createdb arus_test  # + CREATE EXTENSION vector;
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/arus_test
npm run db:push && npm run db:migrate
# seed: organizations(default-org-id), equipment(lt-equip-1), an is_active role='admin' user

# server
DISABLE_RATE_LIMITS=true NODE_ENV=development ARUS_DEV_LOGIN=1 npm run dev

# k6 (binary from https://github.com/grafana/k6/releases if dl.k6.io is blocked)
BASE_URL=http://localhost:5000 npm run test:load:smoke
BASE_URL=http://localhost:5000 K6_SESSION_TOKEN=<token> npm run test:load:steady
BASE_URL=http://localhost:5000 npm run test:load:spike
node tests/load/check-thresholds.mjs artifacts/load

# ingestion ladder (admin session token from /api/portal/login)
for RATE in 100 500 1000 2000; do
  curl -X POST http://localhost:5000/api/admin/telemetry/stress-test \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"equipmentId\":\"lt-equip-1\",\"orgId\":\"default-org-id\",\"durationSeconds\":60,\"messagesPerSecond\":$RATE,\"useBatchWriter\":true}"
done
```

## Required before full production

- Re-run all profiles on production-shaped infrastructure (managed Postgres, realistic latency).
- Run the ws_fanout profile with two instances + shared Redis (covered by its nightly).
- Re-measure the ingestion ladder after the `equipment_telemetry` partitioning migration and
  with multiple vessels/equipment (per-vessel buffers shard the 10k buffer).
