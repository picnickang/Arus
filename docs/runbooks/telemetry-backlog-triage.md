# Runbook — Telemetry ingestion backlog triage

Telemetry flows through an in-memory batch writer (`server/telemetry-batch-writer.ts`) and, in
vessel mode, a SQLite→Postgres bridge (`server/services/sqlite-bridge.ts`). A backlog shows up as a
growing buffer, rising eviction/drop counters, or bridge lag.

## 1. Read the health endpoint

`GET /api/health/telemetry` (now **org-scoped** — authenticate). Key fields:

- `batchWriter.bufferSize` vs `totalQueued` — buffer near `totalQueued` ⇒ flush not keeping up.
- `batchWriter.totalEvicted` / `totalDropped` rising ⇒ shedding load (data loss risk).
- `batchWriter.totalErrors` > 0 ⇒ flush failures (inspect logs for `TelemetryBatchWriter`).
- `sqliteBridge.lagFrames` climbing or `pgOffline: true` ⇒ Postgres unreachable from the vessel.

## 2. Diagnose

- **`pgOffline: true`** — the bridge buffers locally and replays when PG returns. Check network /
  `DATABASE_URL`; no action needed if transient. Sustained offline ⇒ watch SQLite disk usage.
- **High errors, PG online** — likely a schema/constraint mismatch or a slow PG. Check the flush
  error logs; confirm migrations are applied (`npm run db:push`).
- **Eviction/drops with healthy PG** — ingestion outpaces flush. Tune via env:
  `TELEMETRY_BATCH_INTERVAL_MS` (lower = flush more often), `TELEMETRY_MAX_BUFFER_SIZE`
  (raise to absorb bursts), `TELEMETRY_EVICTION_PERCENT`, `TELEMETRY_MAX_RETRIES`.

## 3. Recover

1. Restore the bottleneck (PG connectivity / capacity) first.
2. The bridge replays its SQLite cursor automatically once PG is back; confirm `lagFrames` falls
   and `cursorLastId` advances.
3. If the buffer was shedding, expect a gap for the eviction window — note it; the batch writer
   does not backfill evicted frames.

## Escalate

Persistent `totalErrors` with PG healthy, or `lagFrames` that never drains after connectivity is
restored, indicates a writer/bridge bug — capture the `/api/health/telemetry` body and the
`TelemetryBatchWriter` / `sqlite-bridge` logs.
