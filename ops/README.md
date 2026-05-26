# ops/

LR-3 operations artifacts. Owned by Platform Engineering.

## Layout

- `prometheus/rules.yaml` — alert rules. Lint with
  `promtool check rules ops/prometheus/rules.yaml`.
- `grafana/*.json` — eight dashboards, one per surface:
  - `system-health.json` — HTTP, latency, event loop, RSS, SLO burn.
  - `tenant-security.json` — per-org connections, rejections, quota.
  - `telemetry.json` — ingest, freshness, warehouse export.
  - `ws-fanout.json` — WS connections, messages, reconnects, rejects.
  - `imports.json` — AMOS/SBN adapter throughput and failures.
  - `ml-ai.json` — inference rate, shadow divergence, promotions.
  - `queues-dlq.json` — DLQ depth and replay-ring footprint.
  - `db-health.json` — pool, query latency, drift sentinel.

## Importing into Grafana

```bash
for f in ops/grafana/*.json; do
  curl -X POST -H "Authorization: Bearer $GRAFANA_TOKEN" \
       -H "Content-Type: application/json" \
       --data-binary "@$f" \
       "$GRAFANA_URL/api/dashboards/db"
done
```

The dashboards reference metric names emitted by the running server
(see `server/observability/*-metrics.ts`). LR-3 added two:

- `arus_websocket_connections_active_per_org{org_id}`
- `arus_websocket_connections_rejected_total{org_id, reason}`

Where a metric is referenced by a dashboard but is not yet emitted
(e.g. `arus_ml_promotions_total`), the panel will render "No data"
rather than break — that surface is on the LR-4 metrics backlog.

## Linking to runbooks

Alerts in `prometheus/rules.yaml` carry a `runbook:` annotation
pointing into `docs/operations/runbooks/`. Grafana alert manager
should be configured to surface that field in the notification.
