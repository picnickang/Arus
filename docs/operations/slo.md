# ARUS — Service Level Objectives (SLOs)

Status: LR-3 launch baseline. Owner: Platform Engineering.
Review cadence: monthly (first Monday). Alerting rules in
[`ops/prometheus/rules.yaml`](../../ops/prometheus/rules.yaml) reference
the same metric names used here.

All percentages are evaluated on a 28-day rolling window unless noted.
The budget column is `1 - SLO` expressed in minutes per 28 days.

## 1. Definitions

- **SLI** — Service Level Indicator: a directly measured ratio (e.g.
  `1 - failed_requests / total_requests`).
- **SLO** — the target value for an SLI over a window.
- **Error budget** — `(1 - SLO) × window`. Burn alerts in `rules.yaml`
  page the on-call when the budget burns ≥14× in 1h or ≥6× in 6h
  (Google SRE multi-burn-rate thresholds).
- **Freshness** — wall-clock age of the newest record observed by the
  consumer. Computed from `*_freshness_seconds` gauges.

## 2. SLO table

| #   | Surface                                                                        | SLI                                                                  | SLO                                 | 28-day budget                                     |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| 1   | Auth — `/api/auth/login` + session validate                                    | `1 - 5xx_rate` p99 ≤ 400 ms                                          | 99.9 % availability, 99.0 % latency | 40 min / 403 min                                  |
| 2   | Telemetry ingest — `POST /api/telemetry/bulk` and writer batches               | `1 - (batch_failures + DLQ_in_total) / batches`                      | 99.5 % success                      | 201 min                                           |
| 3   | Telemetry freshness — newest row visible to query path                         | `max(telemetry_freshness_seconds) ≤ 120 s` for 99 % of 1-min samples | 99 % freshness                      | 403 min                                           |
| 4   | WebSocket fan-out — `tests/load/ws_fanout.js` counters                         | `ws_events_missed == 0 ∧ ws_gaps_detected == 0` per nightly run      | 100 % nightly                       | hard gate                                         |
| 5   | Work-order critical path — `POST /api/work-orders`, `…/complete-with-feedback` | `1 - 5xx_rate` p99 ≤ 800 ms                                          | 99.9 % availability, 99.0 % latency | 40 min                                            |
| 6   | RAG / AI chat — `POST /api/agent/chat`, `…/chat-multimodal`                    | First token ≤ 3 s, full response ≤ 30 s, error rate ≤ 1 %            | 99 % latency, 99 % availability     | 403 min                                           |
| 7   | Imports — AMOS + SBN adapters end-to-end                                       | `import_runs_success_total / import_runs_total` per 24 h             | 98 %                                | 13.4 h / 28 d                                     |
| 8   | Reports — scheduled PDF / KPI exports                                          | Job completes within scheduled window                                | 99 %                                | 6.7 h / 28 d (see §3.8 — instrumentation pending) |
| 9   | Warehouse export — daily Parquet roll-up                                       | `arus_telemetry_warehouse_export_success_total` increments every day | 100 % daily                         | hard gate                                         |

## 3. Per-surface specifications

### 3.1 Auth

- Probes: synthetic login from CI region every 60 s; production logins.
- Excludes: rate-limited 429s (intentional), client-side timeouts.
- Burn alert metric: `arus_http_requests_total{route=~"/api/auth/.*",code=~"5.."}`.

### 3.2 Telemetry ingest

- SLI numerator: `arus_telemetry_processed_total`
  (telemetry-ingestion-metrics.ts). Failures:
  `arus_telemetry_errors_total`. Per-org
  `arus_telemetry_batch_quota_blocked_total` is tracked separately and
  counts toward _capacity_, **not** toward the error budget — a
  quota-blocked write is a billing event, not a regression.
- Alert: `TelemetryErrorRate` (rules.yaml) trips at > 0.5 % ratio
  over 10 min.

### 3.3 Telemetry freshness

- Probe: `arus_dq_channel_freshness_seconds` (max across channels)
  exported by `server/observability/data-quality.ts`.
- Excludes: maintenance windows declared via `MAINTENANCE_MODE=1`.
- Alert: `TelemetryFreshnessStale` in `ops/prometheus/rules.yaml`
  (threshold 300 s).

### 3.4 WebSocket fan-out

- The nightly k6 scenario (`tests/load/ws_fanout.js`) enforces
  `ws_events_missed == 0`, `ws_gaps_detected == 0`,
  `ws_handshake_failures == 0`. Any breach fails the workflow and
  pages the on-call. There is no error budget — fan-out gaps mean
  silent data loss to operators.
- In-process gauge: `arus_websocket_connections_active`, per-org
  `arus_websocket_connections_active_per_org{org_id}`.

### 3.5 Work-order critical path

- Latency excludes user-facing PDF rendering, which is async.
- Critical routes are pinned in `rules.yaml` via the
  `route=~"/api/work-orders.*"` selector so refactors do not silently
  redefine the SLO.

### 3.6 RAG / AI chat

- First-token SLO measured from server-side stream start.
- Excludes OpenAI rate-limit 429 propagation (logged separately as a
  vendor-availability SLI, not counted against ours).

### 3.7 Imports

- Success = manifest row reaches `status='succeeded'` with no
  `validation_errors`. Dry-run + real-write idempotency covered by
  `tests/integration/import-{amos,shipmate}-golden.test.ts`.

### 3.8 Reports

- Scheduled jobs queued via `scripts/reports/*`. Window = the cron
  cell + 15-min grace.
- **Instrumentation gap (LR-4):** today the job-queue metrics
  track duration and outcome but not "delay relative to schedule".
  Until that gauge is added, this SLO is computed off-line from
  audit logs once per week. The 99 % target is the launch
  commitment; the in-band alert lands in LR-4.

### 3.9 Warehouse export

- See [`docs/telemetry-warehouse-export.md`](../telemetry-warehouse-export.md).
- Today's alert `WarehouseExportFailed` (rules.yaml) catches an
  _observed_ failure within 26 h. A `WarehouseExportMissed`
  alert (no success in 26 h, even silent) is on the LR-4 backlog
  pending a `last_success_unixtime` gauge.

## 4. What is **not** an SLO

- Mockup sandbox / canvas previews — internal tooling.
- Tauri / Capacitor build pipelines — release engineering, not runtime.
- Knowledge-base semantic search recall — quality metric, not
  availability.

## 5. Instrumentation gaps (LR-4 backlog)

The following SLO machinery is intentionally **not** wired in LR-3
because the underlying metric is not yet emitted by the server.
Each will land in LR-4. Listing them here so we never claim
coverage we don't have.

| Gap                              | Needed metric                                           | Affected SLO / alert                                 |
| -------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Schedule-vs-actual report delay  | `arus_report_job_delay_seconds`                         | SLO #8 — Reports                                     |
| Last-success warehouse timestamp | `arus_telemetry_warehouse_export_last_success_unixtime` | `WarehouseExportMissed`                              |
| Schema drift sentinel            | `arus_schema_drift_detected` (gauge 0/1)                | `MigrationDriftDetected`                             |
| Migration apply failures         | `arus_db_migrations_failed_total`                       | `MigrationApplyFailed`                               |
| Per-adapter import counters      | `arus_import_runs_total{adapter}`, `_failed_total`      | SLO #7 — Imports, `ImportFailureRate`                |
| ML promotion failures            | `arus_ml_promotion_failed_total`                        | `AiPromotionFailed`                                  |
| ML inference errors              | `arus_ml_inference_errors_total`                        | `AiInferenceErrorRate`                               |
| Per-org HTTP labels              | `org_id` label on `arus_http_requests_total`            | per-org 429 attribution in Tenant Security dashboard |

## 6. Change control

Changes to this file require:

1. PR review from on-call rotation lead.
2. Corresponding update to `ops/prometheus/rules.yaml` if SLI labels
   or thresholds change.
3. Note in the wave history (`docs/architecture/waves.md`).
4. Any new SLO must reference a metric that **currently** exists in
   `server/observability/*-metrics.ts` — no fake SLOs.
